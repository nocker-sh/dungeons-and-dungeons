import assert from "node:assert/strict"
import { BASE_URL, VIEWPORTS } from "@/tests/e2e/lib"
import { launch } from "@/tests/e2e/launch"
import { openPage } from "@/tests/e2e/open-page"

const browser = await launch()
const errors: string[] = []
const invalid = "{ unreadable save"
const key = "dungeons-and-dungeons/save"
try {
  for (const viewport of VIEWPORTS) {
    const page = await openPage(browser, viewport, errors)
    await page.routeWebSocket("**/*", () => {})
    await page.addInitScript(
      ({ key, invalid }) => {
        if (sessionStorage.getItem("unreadable-save-seeded")) return
        localStorage.setItem(key, invalid)
        sessionStorage.setItem("unreadable-save-seeded", "yes")
      },
      { key, invalid }
    )
    await page.goto(BASE_URL)
    const warning = page.getByRole("alert")
    await warning.waitFor()
    const keep = page.getByRole("button", {
      name: "このまま（保存しない）",
      exact: true,
    })
    await page.waitForTimeout(100)
    assert.equal(
      await keep.evaluate((el) => el === document.activeElement),
      true,
      "読めない保存を残す選択にフォーカスしない"
    )
    for (const key of ["Tab", "Tab", "Shift+Tab", "Shift+Tab"]) {
      await page.keyboard.press(key)
      assert.equal(
        await warning.evaluate((el) => el.contains(document.activeElement)),
        true,
        "保存の選択から背面へ操作が漏れた"
      )
    }
    assert.equal(
      await page.locator("[data-conversation-dialog]").count(),
      0,
      "保存の選択前に会話が入力を受ける"
    )
    assert.equal(
      await page.evaluate((key) => localStorage.getItem(key), key),
      invalid
    )
    await page.keyboard.press("Enter")
    await warning.waitFor({ state: "detached" })
    const dialogue = page.locator("[data-conversation-dialog]")
    await dialogue.locator("[data-conversation-ready]").waitFor()
    await page.keyboard.press("Enter")
    await dialogue.locator("[data-conversation-ready]").waitFor()
    assert.equal(
      await page.evaluate((key) => localStorage.getItem(key), key),
      invalid,
      "保存しないで進めたら古い保存を上書きした"
    )
    console.log(
      `${viewport.name}: 保存を残す初期選択・Tab循環・会話の開始・元の保存保持 OK`
    )
    const installPad = () =>
      page.evaluate(() => {
        const pad = {
          index: 0,
          buttons: Array.from({ length: 16 }, () => ({ pressed: false })),
          axes: [0, 0, 0, 0],
        }
        Object.assign(window, { unreadableSavePad: pad })
        Object.defineProperty(navigator, "getGamepads", {
          configurable: true,
          value: () => [pad],
        })
      })
    const pad = async (button: number) => {
      for (const pressed of [true, false]) {
        await page.evaluate(
          ({ button, pressed }) => {
            ;(
              window as unknown as {
                unreadableSavePad: { buttons: { pressed: boolean }[] }
              }
            ).unreadableSavePad.buttons[button]!.pressed = pressed
          },
          { button, pressed }
        )
        await page.waitForTimeout(120)
      }
    }
    await page.reload()
    await warning.waitFor()
    await installPad()
    await page.waitForFunction(() =>
      document.querySelector("[data-save-keep].is-active")
    )
    await page.screenshot({
      path: `/tmp/dnd-unreadable-save-${viewport.name}.png`,
    })
    await pad(0)
    await warning.waitFor({ state: "detached" })
    await dialogue.locator("[data-conversation-ready]").waitFor()
    await pad(0)
    await dialogue.locator("[data-conversation-ready]").waitFor()
    assert.equal(
      await page.evaluate((key) => localStorage.getItem(key), key),
      invalid
    )
    await page.reload()
    await warning.waitFor()
    await installPad()
    await page.waitForFunction(() =>
      document.querySelector("[data-save-keep].is-active")
    )
    await pad(4)
    const discard = page.getByRole("button", {
      name: "古い保存を消して、はじめから遊ぶ",
      exact: true,
    })
    assert.equal(
      await discard.evaluate((el) => el.classList.contains("is-active")),
      true
    )
    assert.equal(
      await page.evaluate((key) => localStorage.getItem(key), key),
      invalid,
      "選んだだけで保存を消した"
    )
    await pad(0)
    await warning.waitFor({ state: "detached" })
    await dialogue.locator("[data-conversation-ready]").waitFor()
    const fresh = await page.evaluate((key) => localStorage.getItem(key), key)
    assert.ok(fresh && fresh !== invalid, "明示して消した後に新しい保存がない")
    assert.equal(JSON.parse(fresh).snapshot.phase.type, "creating")
    await page.reload()
    await dialogue.locator("[data-conversation-ready]").waitFor()
    assert.equal(await warning.count(), 0, "削除後の保存から再開できない")
    console.log(
      `${viewport.name}: パッドAで保存保持・Lで削除選択・明示削除・新しい保存から再開 OK`
    )
    await page.close()
  }
  assert.deepEqual(errors, [])
} finally {
  await browser.close()
}
