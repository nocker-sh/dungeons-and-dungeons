import assert from "node:assert/strict"
import { GameDefinition } from "@/lib/wiz/definition/game-definition"
import { realContent } from "@/lib/wiz/testing/real-content"
import { startedState } from "@/lib/wiz/testing/started-state"
import { BASE_URL } from "@/tests/e2e/lib"
import { launch } from "@/tests/e2e/launch"
import { openPage } from "@/tests/e2e/open-page"
import { talkUntil } from "@/tests/e2e/talk-until"

const definition = new GameDefinition(realContent())
const saved = JSON.stringify(
  definition.create(undefined, startedState(definition)).save()
)
const browser = await launch()
const errors: string[] = []
try {
  for (const width of [390, 1280]) {
    const page = await openPage(browser, { width, height: 844 }, errors)
    await page.routeWebSocket("**/*", () => {})
    await page.addInitScript(
      (value) => localStorage.setItem("dungeons-and-dungeons/save", value),
      saved
    )
    await page.goto(BASE_URL)
    const trigger = page.getByRole("button", { name: "設定", exact: true })
    await talkUntil(
      page,
      page.locator('button[aria-label="設定"]:enabled')
    ).catch(async (error) => {
      console.error({
        width,
        errors,
        text: await page.locator("body").innerText(),
      })
      await page.screenshot({ path: `/tmp/dnd-settings-${width}-failure.png` })
      throw error
    })
    const before = await page.evaluate(() =>
      localStorage.getItem("dungeons-and-dungeons/save")
    )
    await trigger.click()
    const dialog = page.getByRole("dialog", { name: "設定", exact: true })
    await dialog.waitFor()
    const inside = () =>
      dialog.evaluate((node) => node.contains(document.activeElement))
    assert.equal(await inside(), true, "設定を開いたら中にフォーカスする")
    for (const key of ["Tab", "Tab", "Shift+Tab", "Shift+Tab", "Tab"]) {
      await page.keyboard.press(key)
      assert.equal(
        await inside(),
        true,
        `${width}: ${key}で設定の背面へ移動した`
      )
    }
    await dialog
      .getByRole("button", { name: "はじめから遊ぶ", exact: true })
      .click()
    assert.equal(
      await dialog
        .getByRole("button", { name: "やめる", exact: true })
        .evaluate((node) => node === document.activeElement),
      true,
      "削除確認では取消にフォーカスする"
    )
    for (const key of ["Tab", "Tab", "Tab", "Shift+Tab"]) {
      await page.keyboard.press(key)
      assert.equal(await inside(), true, "確認中も設定の中で循環する")
    }
    await dialog.getByRole("button", { name: "やめる", exact: true }).click()
    assert.equal(
      await dialog
        .getByRole("button", { name: "はじめから遊ぶ", exact: true })
        .evaluate((node) => node === document.activeElement),
      true,
      "取消後は元のボタンへ戻る"
    )
    await page.keyboard.press("Escape")
    await dialog.waitFor({ state: "detached" })
    assert.equal(
      await trigger.evaluate((node) => node === document.activeElement),
      true,
      "閉じたら設定ボタンへ戻る"
    )
    assert.equal(
      await page.evaluate(() =>
        localStorage.getItem("dungeons-and-dungeons/save")
      ),
      before,
      "操作だけで保存が変わった"
    )
    await trigger.click()
    await dialog.waitFor()
    await page.keyboard.press("Backspace")
    await dialog.waitFor({ state: "detached" })
    assert.equal(
      await trigger.evaluate((node) => node === document.activeElement),
      true
    )
    await trigger.click()
    await dialog.waitFor()
    await page.evaluate(() => {
      const pad = {
        index: 0,
        buttons: Array.from({ length: 16 }, () => ({ pressed: false })),
        axes: [0, 0],
      }
      Object.assign(window, { settingsTestPad: pad })
      Object.defineProperty(navigator, "getGamepads", {
        configurable: true,
        value: () => [pad],
      })
    })
    await page.waitForTimeout(120)
    await page.evaluate(() => {
      const pad = (
        window as unknown as {
          settingsTestPad: { buttons: { pressed: boolean }[] }
        }
      ).settingsTestPad
      pad.buttons[1]!.pressed = true
    })
    await dialog.waitFor({ state: "detached" })
    assert.equal(
      await trigger.evaluate((node) => node === document.activeElement),
      true
    )
    assert.equal(
      await page.evaluate(() =>
        localStorage.getItem("dungeons-and-dungeons/save")
      ),
      before
    )
    console.log(
      `${width}: Tab循環・確認と取消のフォーカス・Escape/Backspace・パッドB・保存保持 OK`
    )
    await page.close()
  }
  assert.deepEqual(errors, [])
} finally {
  await browser.close()
}
