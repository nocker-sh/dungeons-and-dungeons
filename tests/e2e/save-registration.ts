import assert from "node:assert/strict"
import { GameDefinition } from "@/lib/wiz/definition/game-definition"
import { realContent } from "@/lib/wiz/testing/real-content"
import { startedState } from "@/lib/wiz/testing/started-state"
import { BASE_URL } from "@/tests/e2e/lib"
import { launch } from "@/tests/e2e/launch"
import { openPage } from "@/tests/e2e/open-page"
import { talkUntil } from "@/tests/e2e/talk-until"

const key = "dungeons-and-dungeons/save"
const definition = new GameDefinition(realContent())
const initial = startedState(definition)
const saved = JSON.stringify(
  definition
    .create(undefined, {
      ...initial,
      hero: { ...initial.hero, registrationPending: true },
    })
    .save()
)
declare global {
  interface Window {
    __registrationSave: {
      fail: boolean
      latest: string | null
      attempts: number
    }
  }
}

const browser = await launch()
const errors: string[] = []
try {
  for (const width of [320, 390, 1280]) {
    const page = await openPage(browser, { width, height: 900 }, errors)
    await page.routeWebSocket("**/*", () => {})
    // 独立したブラウザの保存だけを使い、登録へ進む間の保存失敗を再現する。
    await page.addInitScript(
      ({ key, saved }) => {
        localStorage.setItem(key, saved)
        // oxlint-disable-next-line typescript/unbound-method -- 下の write.call(this, ...) で元の保存先を渡す。
        const write = Storage.prototype.setItem
        window.__registrationSave = { fail: true, latest: null, attempts: 0 }
        Storage.prototype.setItem = function (name, value) {
          if (this === localStorage && name === key) {
            const probe = window.__registrationSave
            probe.latest = value
            probe.attempts++
            if (probe.fail)
              throw new DOMException("保存容量不足", "QuotaExceededError")
          }
          write.call(this, name, value)
        }
      },
      { key, saved }
    )
    await page.goto(BASE_URL)
    const registration = page.getByRole("region", {
      name: "冒険者の登録用紙",
      exact: true,
    })
    await talkUntil(page, registration)
    await page.waitForFunction(() =>
      document.querySelector("[data-screen-content]")?.closest("[inert]")
    )
    const warning = page.locator("[data-save-warning]")
    assert.equal(await warning.count(), 1, "登録前の保存失敗が通知されていない")
    assert.equal(
      await warning.isVisible(),
      true,
      "登録用紙を開くと保存失敗の知らせが隠れる"
    )
    assert.equal(
      await warning.evaluate(
        (node) => !!node.closest('[inert], [aria-hidden="true"]')
      ),
      false,
      "保存失敗の知らせが操作・読み上げの対象から外れている"
    )
    assert.equal(
      await page.evaluate((key) => localStorage.getItem(key), key),
      saved,
      "保存失敗で元の保存を書き換えた"
    )

    const name = registration.getByRole("textbox", {
      name: "名前（カタカナ）",
      exact: true,
    })
    await name.fill("ノア")
    const photo = page
      .locator('[aria-label^="写真 "][aria-label$=" を貼る"]')
      .first()
    const chosen = (await photo.getAttribute("aria-label"))!.replace(
      /^写真 (.+) を貼る$/,
      "$1"
    )
    await photo.click()
    const pasted = registration.locator(`[aria-label="貼った写真 ${chosen}"]`)
    await pasted.waitFor()
    const before = await page.evaluate(() => window.__registrationSave.latest)
    assert.ok(before)
    if (width === 390)
      await page.screenshot({ path: "/tmp/dnd-save-registration.png" })
    await page.evaluate(() => {
      window.__registrationSave.fail = false
    })
    const retry = warning.getByRole("button", {
      name: "もう一度保存",
      exact: true,
    })
    await retry.focus()
    assert.equal(
      await retry.evaluate((node) => node === document.activeElement),
      true
    )
    await page.keyboard.press("Enter")
    await warning.waitFor({ state: "detached" })
    assert.equal(
      await page.evaluate((key) => localStorage.getItem(key), key),
      before,
      "再保存で最新のゲーム状態が変わった"
    )
    assert.equal(
      await name.inputValue(),
      "ノア",
      "再保存で書きかけの名前が消えた"
    )
    assert.equal(await pasted.isVisible(), true, "再保存で選んだ写真が戻った")
    assert.equal(await registration.isVisible(), true)
    assert.equal(
      await page.locator('[aria-label="設定"]').isVisible(),
      false,
      "再保存で登録中の背面操作が現れた"
    )
    assert.equal(
      JSON.parse(before).snapshot.hero.registrationPending,
      true,
      "再保存で未確定の登録を進めた"
    )
    console.log(
      `${width}: 登録中も保存失敗を表示・Enterで復旧・名前と写真の下書き保持・背面非表示 OK`
    )
    await page.close()
  }
  assert.deepEqual(errors, [])
} finally {
  await browser.close()
}
