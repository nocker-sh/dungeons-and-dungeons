import assert from "node:assert/strict"
import type { Route } from "playwright"
import { GameDefinition } from "@/lib/wiz/definition/game-definition"
import { realContent } from "@/lib/wiz/testing/real-content"
import { startedState } from "@/lib/wiz/testing/started-state"
import { BASE_URL } from "@/tests/e2e/lib"
import { launch } from "@/tests/e2e/launch"
import { talkUntil } from "@/tests/e2e/talk-until"

// 通信をブラウザ内で差し替える。実際の共有保存には触れない。
const browser = await launch()
try {
  for (const width of [390, 1280]) {
    const context = await browser.newContext({
      ignoreHTTPSErrors: true,
      viewport: { width, height: 844 },
      serviceWorkers: "block",
    })
    const errors: string[] = []
    const page = await context.newPage()
    page.on("pageerror", (error) => errors.push(error.message))
    await page.routeWebSocket("**/*", () => {})
    const requests: string[] = []
    let failedClear: Route | null = null
    await page.route("**/__dev/save", async (route) => {
      requests.push(route.request().method())
      if (route.request().method() === "DELETE") {
        failedClear = route
        return
      }
      await route.fulfill({ status: 503 })
    })
    await page.goto(`${BASE_URL}/?save=tmp`)
    const alert = page.getByRole("alert")
    await alert.waitFor()
    assert.ok((await alert.innerText()).includes("503"))
    assert.deepEqual(requests, ["GET"])
    await page
      .getByRole("button", { name: "古い保存を消して、はじめから遊ぶ" })
      .click()
    const keep = page.getByRole("button", {
      name: "このまま（保存しない）",
      exact: true,
    })
    assert.equal(
      await keep.isDisabled(),
      true,
      "削除待ちに保存しないプレイへ切り替えられる"
    )
    await page.keyboard.press("Escape")
    assert.equal(await alert.count(), 1, "削除待ちのEscで選択を閉じた")
    assert.equal(await page.locator("[data-conversation-dialog]").count(), 0)
    for (let attempt = 0; attempt < 100 && !failedClear; attempt++)
      await page.waitForTimeout(20)
    assert.ok(failedClear)
    await (failedClear as Route).fulfill({ status: 503 })
    await alert.getByText("・保存を変更できませんでした（503）").waitFor()
    assert.equal(await keep.isEnabled(), true, "削除失敗後に選び直せない")
    assert.deepEqual(requests, ["GET", "DELETE"])
    await page.unroute("**/__dev/save")

    const definition = new GameDefinition(realContent())
    const game = definition.create(undefined, startedState(definition))
    let saved: string | null = JSON.stringify(game.save())
    let deletion: Route | null = null
    let reads = 0
    await page.route("**/__dev/save", async (route) => {
      const method = route.request().method()
      if (method === "GET") {
        reads++
        await route.fulfill(
          saved === null ? { status: 204 } : { status: 200, body: saved }
        )
      } else if (method === "DELETE") {
        assert.equal(deletion, null, "削除を二重送信している")
        deletion = route
      } else {
        saved = route.request().postData()
        await route.fulfill({ status: 204 })
      }
    })
    const chooseReset = async () => {
      await talkUntil(page, page.locator('button[aria-label="設定"]:enabled'))
      await page.getByRole("button", { name: "設定", exact: true }).click()
      await page
        .getByRole("button", { name: "はじめから遊ぶ", exact: true })
        .click()
      await page
        .getByRole("button", { name: "消して始める", exact: true })
        .click()
    }
    const pendingDeletion = async () => {
      for (let attempt = 0; attempt < 100 && !deletion; attempt++)
        await page.waitForTimeout(20)
      assert.ok(deletion, "削除リクエストが届かない")
      return deletion as Route
    }
    const checkLocked = async () => {
      const dialog = page.getByRole("dialog", { name: "設定", exact: true })
      assert.equal(await dialog.getAttribute("aria-busy"), "true")
      assert.equal(await dialog.locator("button:enabled").count(), 0)
      assert.ok(
        (await dialog.getByRole("status").innerText()).includes(
          "保存を消しています"
        )
      )
      const before = saved
      for (const key of [
        "Tab",
        "Shift+Tab",
        "Escape",
        "Backspace",
        "Enter",
        "Space",
        "1",
      ])
        await page.keyboard.press(key)
      await page.evaluate(() => {
        const pad = {
          index: 0,
          buttons: Array.from({ length: 16 }, () => ({ pressed: false })),
          axes: [0, 0],
        }
        Object.assign(window, { resetTestPad: pad })
        Object.defineProperty(navigator, "getGamepads", {
          configurable: true,
          value: () => [pad],
        })
      })
      for (const button of [0, 1])
        for (const pressed of [false, true, false]) {
          await page.evaluate(
            ({ button, pressed }) => {
              ;(
                window as unknown as {
                  resetTestPad: { buttons: { pressed: boolean }[] }
                }
              ).resetTestPad.buttons[button]!.pressed = pressed
            },
            { button, pressed }
          )
          await page.waitForTimeout(120)
        }
      await dialog
        .getByRole("button", { name: "消して始める", exact: true })
        .evaluate((button) => (button as HTMLButtonElement).click())
      assert.equal(await dialog.count(), 1, "削除待ちに設定を閉じた")
      assert.ok(
        await dialog.evaluate((node) => node === document.activeElement)
      )
      assert.equal(saved, before, "削除待ちの操作で保存が変わった")
      await page.screenshot({
        path: `/tmp/dnd-settings-reset-pending-${width}.png`,
      })
    }
    await page.reload()
    await chooseReset()
    const failedDelete = await pendingDeletion()
    const beforeFailure = reads
    const beforeFailureSave = saved
    await checkLocked()
    await page.waitForTimeout(300)
    assert.equal(reads, beforeFailure, "削除完了前に再読み込みしている")
    await failedDelete.fulfill({ status: 503 })
    deletion = null
    await page
      .getByRole("heading", { name: "保存を消せませんでした" })
      .waitFor()
    assert.equal(reads, beforeFailure, "削除失敗で再読み込みしている")
    assert.equal(saved, beforeFailureSave, "削除失敗で元の保存を変えた")
    await page.getByRole("button", { name: "再読み込み", exact: true }).click()
    await chooseReset()
    const successfulDelete = await pendingDeletion()
    const beforeSuccess = reads
    await checkLocked()
    await page.waitForTimeout(300)
    assert.equal(reads, beforeSuccess, "削除完了前に再読み込みしている")
    saved = null
    await successfulDelete.fulfill({ status: 204 })
    deletion = null
    await page.locator(".create").waitFor()
    assert.equal(reads, beforeSuccess + 1, "削除完了後に再読み込みしていない")
    assert.deepEqual(errors, [])
    console.log(
      `${width}: 保存エラーの表示・上書き防止・削除待ちの操作禁止・削除失敗・二重入力防止・初期状態での再開: OK`
    )
    await context.close()
  }
} finally {
  await browser.close()
}
