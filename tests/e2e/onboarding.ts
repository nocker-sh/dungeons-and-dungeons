import assert from "node:assert/strict"
import { mkdir } from "node:fs/promises"
import { BASE_URL, VIEWPORTS } from "@/tests/e2e/lib"
import { launch } from "@/tests/e2e/launch"
import { openPage } from "@/tests/e2e/open-page"
import { press } from "@/tests/e2e/press"
import { talkUntil } from "@/tests/e2e/talk-until"
import type { Page } from "playwright"
import { PARTY_SLOTS } from "@/lib/wiz/content/constants"

const directory = "/tmp/product-test/visual/onboarding"
await mkdir(directory, { recursive: true })
const save = (page: Page) =>
  page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("dungeons-and-dungeons/save")!).snapshot
  )
/** 隊列の札に出ている名前。 */
const cardNames = async (page: Page) =>
  (
    await page
      .locator(".formation")
      .getByRole("button", { name: / HP/ })
      .evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute("aria-label") ?? "")
      )
  ).map((label) => label.replace(/ HP.*$/, ""))
const STARTING = ["アルダ", "モート", "マユ"]
const browser = await launch()
try {
  for (const viewport of VIEWPORTS.filter(
    (viewport) => !process.argv[2] || viewport.name === process.argv[2]
  )) {
    const errors: string[] = []
    const page = await openPage(browser, viewport, errors)
    await page.routeWebSocket("**/*", () => {})
    await page.goto(BASE_URL)
    // 開幕は屋根裏での会話だけ。名前の入力はない
    await page.locator(".create").waitFor()
    await page.locator("[data-conversation-dialog]").waitFor()
    assert.equal(await page.getByRole("textbox").count(), 0)
    await page.screenshot({ path: `${directory}/${viewport.name}-opening.png` })
    // 会話を終えると、ギルドのホールを経て受付の登録用紙へ自動で進む
    const registration = page.getByRole("region", {
      name: "冒険者の登録用紙",
      exact: true,
    })
    await talkUntil(page, registration)
    const started = await save(page)
    assert.equal(started.hero.registrationPending, true)
    assert.equal(started.party.length, PARTY_SLOTS)
    assert.equal(started.members.length, PARTY_SLOTS)
    // プレイヤーは戦わない運営役。仲間は最初の3人だけで、全員が隊列にいる
    const byId = (a: string, b: string) => a.localeCompare(b)
    assert.deepEqual(
      [...started.party].sort(byId),
      started.members.map((member: { id: string }) => member.id).sort(byId)
    )
    // 登録するまでは街へも谷へも出られない（用紙だけを見せる）
    for (const label of ["ダンジョン", "カチコミ", "冒険者ギルド"])
      assert.equal(await page.locator(`[aria-label="${label}"]`).count(), 0)
    assert.equal(
      await page.locator('[aria-label="‹ 戻る"]').first().isVisible(),
      false
    )
    const nameField = registration.getByRole("textbox", {
      name: "名前（カタカナ）",
      exact: true,
    })
    const submit = registration.getByRole("button", {
      name: "この内容で登録する",
      exact: true,
    })
    // 登録用紙は名前だけ。写真・容姿の選択はない
    assert.equal(await registration.locator("img").count(), 0)
    assert.equal(
      await registration.locator('[aria-label*="写真"]').count(),
      0,
      "登録用紙に写真が残っている"
    )
    assert.equal(await submit.isDisabled(), true)
    await nameField.fill("　 ")
    assert.equal(await submit.isDisabled(), true)
    // 名前はカタカナだけ。英字は残らない
    await nameField.fill("abc")
    assert.equal(await nameField.inputValue(), "")
    assert.equal(await submit.isDisabled(), true)
    await nameField.fill("ノア")
    assert.equal(await submit.isDisabled(), false)
    // IMEの通知順を再現する。変換終了が確定Enterより先でも、登録には進まない。
    await nameField.dispatchEvent("compositionstart")
    await nameField.fill("のあ")
    assert.equal(await nameField.inputValue(), "のあ")
    await nameField.dispatchEvent("keydown", {
      key: "Enter",
      keyCode: 229,
      isComposing: true,
    })
    assert.deepEqual(await save(page), started)
    await nameField.dispatchEvent("compositionend", { data: "のあ" })
    assert.equal(await nameField.inputValue(), "ノア")
    await nameField.dispatchEvent("keydown", {
      key: "Enter",
      keyCode: 229,
      isComposing: false,
    })
    assert.deepEqual(
      await save(page),
      started,
      "日本語変換の確定Enterで名前を登録してしまった"
    )
    assert.deepEqual(await save(page), started)
    await page.waitForTimeout(600)
    await page.screenshot({
      path: `${directory}/${viewport.name}-registration.png`,
    })
    // 書きかけで読み込み直すと、用紙からやり直し（保存は登録前のまま）
    await page.reload()
    await talkUntil(page, registration)
    assert.deepEqual(await save(page), started)
    assert.equal(await nameField.inputValue(), "")
    await nameField.fill("ノア")
    await press(page, "この内容で登録する")
    // 名前は保存に入るが、隊列の札には出ない。登録で所持金・隊列は変わらない
    await page.waitForFunction(() => {
      const hero = JSON.parse(
        localStorage.getItem("dungeons-and-dungeons/save")!
      ).snapshot.hero
      return hero.name === "ノア" && !hero.registrationPending
    })
    const registered = await save(page)
    assert.equal(registered.hero.registrationPending, false)
    assert.equal(registered.gold, started.gold)
    assert.deepEqual(registered.party, started.party)
    assert.deepEqual(registered.members, started.members)
    // 受付・街はずれの会話のあと、3人そろって自動で初出撃する
    const advance = page.getByRole("button", { name: "進む", exact: true })
    await talkUntil(page, advance)
    const departed = await save(page)
    assert.equal(departed.phase.type, "expedition")
    assert.notEqual(departed.lastLayer, null)
    assert.deepEqual(departed.party, started.party)
    assert.equal(departed.party.length, PARTY_SLOTS)
    assert.equal(
      await page
        .locator(".formation")
        .getByRole("button", { name: / HP/ })
        .count(),
      PARTY_SLOTS
    )
    assert.deepEqual((await cardNames(page)).sort(), [...STARTING].sort())
    assert.equal(await page.locator(".onboarding-note").count(), 0)
    // 読み込み直しても、同じ名前・隊列のまま探索から再開する
    await page.reload()
    await advance.waitFor({ timeout: 30_000 })
    const resumed = await save(page)
    assert.equal(resumed.hero.name, "ノア")
    assert.deepEqual((await cardNames(page)).sort(), [...STARTING].sort())
    assert.deepEqual(resumed.party, departed.party)
    assert.equal(resumed.lastLayer, departed.lastLayer)
    // 撤退して街へ戻ると、街を歩ける（谷へも出られる）
    await press(page, "撤退")
    const guild = page.getByRole("button", {
      name: "冒険者ギルド",
      exact: true,
    })
    await talkUntil(page, guild)
    assert.equal(
      await page
        .getByRole("button", { name: "ダンジョン", exact: true })
        .isDisabled(),
      false
    )
    await page.waitForTimeout(800)
    await page.screenshot({ path: `${directory}/${viewport.name}-town.png` })
    // 登録のあとは、設定から名前だけを変えられる
    await page.getByRole("button", { name: "設定", exact: true }).click()
    const settings = page.getByRole("dialog", { name: "設定", exact: true })
    const rename = settings.locator("[data-settings-rename]")
    await rename.waitFor()
    assert.equal(await rename.textContent(), "名前を変える（いま：ノア）")
    const before = await save(page)
    await rename.click()
    const renaming = page.getByRole("dialog", {
      name: "名前を変える",
      exact: true,
    })
    await renaming
      .getByRole("textbox", { name: "名前（カタカナ）", exact: true })
      .fill("ミナ")
    await page.screenshot({
      path: `${directory}/${viewport.name}-rename.png`,
    })
    await renaming
      .getByRole("button", { name: "この名前にする", exact: true })
      .click()
    await renaming.waitFor({ state: "detached" })
    await page.waitForFunction(
      () =>
        JSON.parse(localStorage.getItem("dungeons-and-dungeons/save")!).snapshot
          .hero.name === "ミナ"
    )
    const after = await save(page)
    assert.deepEqual(
      { ...after, hero: { ...after.hero, name: before.hero.name } },
      before
    )
    assert.equal(await rename.textContent(), "名前を変える（いま：ミナ）")
    assert.deepEqual((await cardNames(page)).sort(), [...STARTING].sort())
    assert.deepEqual(errors, [])
    console.log(
      `${viewport.name}: 開幕の会話→登録用紙で名前→${PARTY_SLOTS}人で初出撃→再読込で再開→撤退→設定で改名 OK`
    )
    await page.close()
  }
} finally {
  await browser.close()
}
