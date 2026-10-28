import assert from "node:assert/strict"
import { mkdir } from "node:fs/promises"
import { BASE_URL, VIEWPORTS } from "@/tests/e2e/lib"
import { launch } from "@/tests/e2e/launch"
import { openPage } from "@/tests/e2e/open-page"
import { press } from "@/tests/e2e/press"
import { tap } from "@/tests/e2e/tap"
import { settleInView } from "@/tests/e2e/settle-in-view"
import { talkUntil } from "@/tests/e2e/talk-until"
import type { Page } from "playwright"
import { PARTY_SLOTS } from "@/lib/wiz/content/constants"
import players from "@/concept/data/players.json"

const directory = "/tmp/product-test/visual/onboarding"
await mkdir(directory, { recursive: true })
const save = (page: Page) =>
  page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("dungeons-and-dungeons/save")!).snapshot
  )
/** 写真の名前（紫髪など）から容姿の id を引く。 */
const lookOf = (name: string) => {
  const found = players.find((player) => player.name === name)
  assert.ok(found, `写真 ${name} の容姿がない`)
  return found.id
}
/** 隊列の札に出ている人の絵。 */
const cardImage = async (page: Page, name: string) =>
  (await page
    .locator(".formation .card")
    .filter({
      has: page.getByRole("button", { name: new RegExp(`^${name} HP`) }),
    })
    .locator("img")
    .first()
    .getAttribute("src")) ?? ""
const imageOf = (look: string) =>
  players.find((player) => player.id === look)?.image
const browser = await launch()
try {
  for (const viewport of VIEWPORTS.filter(
    (viewport) => !process.argv[2] || viewport.name === process.argv[2]
  )) {
    const errors: string[] = []
    const page = await openPage(browser, viewport, errors)
    await page.routeWebSocket("**/*", () => {})
    await page.goto(BASE_URL)
    // 開幕は屋根裏での会話だけ。名前の入力も容姿選びもない
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
    const pasted = registration.locator('[aria-label^="貼った写真 "]')
    const pastedName = async () =>
      (await pasted.getAttribute("aria-label"))!.replace("貼った写真 ", "")
    assert.equal(lookOf(await pastedName()), started.hero.look)
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
    // 手元の写真を貼る。登録するまで保存は変わらない
    const photo = page.locator('[aria-label^="写真 "][aria-label$=" を貼る"]')
    const pickPhoto = async () => {
      const label = (await photo.first().getAttribute("aria-label"))!
      const chosen = label.replace(/^写真 (.+) を貼る$/, "$1")
      await press(page, label)
      await registration
        .locator(`[aria-label="貼った写真 ${chosen}"]`)
        .waitFor()
      return chosen
    }
    const chosenName = await pickPhoto()
    assert.notEqual(lookOf(chosenName), started.hero.look)
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
    assert.equal(lookOf(await pastedName()), started.hero.look)
    await nameField.fill("ノア")
    assert.equal(await pickPhoto(), chosenName)
    const chosenLook = lookOf(chosenName)
    await press(page, "この内容で登録する")
    // 名前と容姿が保存と隊列の札に出る。登録で所持金・隊列は変わらない
    const heroCard = page
      .locator(".formation")
      .getByRole("button", { name: /^ノア HP/ })
    await heroCard.waitFor()
    const registered = await save(page)
    assert.equal(registered.hero.name, "ノア")
    assert.equal(registered.hero.look, chosenLook)
    assert.equal(registered.hero.registrationPending, false)
    assert.equal(registered.gold, started.gold)
    assert.deepEqual(registered.party, started.party)
    assert.deepEqual(registered.members, started.members)
    assert.equal(await cardImage(page, "ノア"), imageOf(chosenLook))
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
    assert.equal(await page.locator(".onboarding-note").count(), 0)
    // 読み込み直しても、同じ名前・容姿・隊列のまま探索から再開する
    await page.reload()
    await advance.waitFor({ timeout: 30_000 })
    await heroCard.waitFor()
    const resumed = await save(page)
    assert.equal(resumed.hero.name, "ノア")
    assert.equal(resumed.hero.look, chosenLook)
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
    // 登録のあとは、主人公の詳細から容姿だけを変えられる
    await settleInView(page, heroCard)
    await tap(page, heroCard)
    await press(page, "容姿")
    const appearance = page.locator(".hero-appearance")
    await appearance.waitFor()
    const before = await save(page)
    await appearance.getByRole("button", { pressed: false }).first().click()
    await page.screenshot({
      path: `${directory}/${viewport.name}-change-look.png`,
    })
    await press(page, "この容姿にする")
    await appearance.waitFor({ state: "detached" })
    const after = await save(page)
    assert.notEqual(after.hero.look, before.hero.look)
    assert.deepEqual(
      { ...after, hero: { ...after.hero, look: before.hero.look } },
      before
    )
    await press(page, "立ち絵を閉じる")
    assert.equal(await cardImage(page, "ノア"), imageOf(after.hero.look))
    assert.deepEqual(errors, [])
    console.log(
      `${viewport.name}: 開幕の会話→登録用紙で名前と写真→${PARTY_SLOTS}人で初出撃→再読込で再開→撤退→容姿変更 OK`
    )
    await page.close()
  }
} finally {
  await browser.close()
}
