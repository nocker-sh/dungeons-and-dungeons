import assert from "node:assert/strict"
import { BASE_URL, VIEWPORTS } from "@/tests/e2e/lib"
import { launch } from "@/tests/e2e/launch"

// 本番ビルドを preview で配信して実行する。開発モードではSWを登録しない。
declare global {
  interface Window {
    __offlineImageStarted?: boolean
  }
}

const browser = await launch()
try {
  for (const mode of ["normal", "slow", "unavailable"]) {
    const slow = mode === "slow"
    for (const viewport of VIEWPORTS) {
      const context = await browser.newContext({ viewport })
      const page = await context.newPage()
      let delayedImage = ""
      let beganUncontrolled = false
      if (slow) {
        await page.addInitScript(() => {
          const register = navigator.serviceWorker.register.bind(
            navigator.serviceWorker
          )
          ServiceWorkerContainer.prototype.register = async function (...args) {
            if (!this.controller && !window.__offlineImageStarted)
              await new Promise<void>((resolve) =>
                window.addEventListener(
                  "offline-image-started",
                  () => resolve(),
                  { once: true }
                )
              )
            return register(...args)
          }
        })
        await page.route("**/tmp/**/*.webp", async (route) => {
          if (!delayedImage) {
            delayedImage = route.request().url()
            beganUncontrolled = await page.evaluate(() => {
              const uncontrolled = !navigator.serviceWorker.controller
              window.__offlineImageStarted = true
              dispatchEvent(new Event("offline-image-started"))
              return uncontrolled
            })
            const response = await route.fetch()
            await page.waitForFunction(
              () => !!navigator.serviceWorker.controller
            )
            await page.waitForTimeout(200)
            await route.fulfill({ response })
            return
          }
          await route.continue()
        })
      }
      if (mode === "unavailable") {
        await page.addInitScript(() => {
          ServiceWorkerContainer.prototype.register = () =>
            Promise.reject(
              new DOMException("ブラウザが登録を拒否した", "SecurityError")
            )
        })
      }
      const errors: string[] = []
      const failed: { url: string; error: string | undefined }[] = []
      const completed = new Set<string>()
      page.on("response", (response) => {
        if (response.ok())
          void response
            .finished()
            .then((error) => {
              if (!error) completed.add(response.url())
            })
            .catch(() => {})
      })
      const assertResources = async () => {
        await page.waitForFunction(() =>
          [...document.images].every(
            (image) => image.complete && image.naturalWidth > 0
          )
        )
        for (const failure of failed) {
          assert.equal(failure.error, "net::ERR_ABORTED", failure.url)
          assert.ok(
            completed.has(failure.url),
            `中断された資源の取得完了を確認できない: ${failure.url}`
          )
        }
      }
      page.on("pageerror", (error) => errors.push(error.message))
      page.on("requestfailed", (request) => {
        if (new URL(request.url()).origin === new URL(BASE_URL).origin)
          failed.push({
            url: request.url(),
            error: request.failure()?.errorText,
          })
      })
      await page.goto(BASE_URL)
      const dialogue = page.locator("[data-conversation-dialog]")
      await dialogue.waitFor()
      await dialogue.locator("[data-conversation-ready]").waitFor()
      if (mode === "unavailable") {
        const before = await dialogue.innerText()
        const saved = await page.evaluate(() =>
          localStorage.getItem("dungeons-and-dungeons/save")
        )
        assert.ok(saved)
        // 表示済みの絵とは別に読み込む立ち絵も完了させ、再読込による中断と取得失敗を混同しない。
        await page.waitForLoadState("networkidle")
        await page.reload()
        await dialogue.locator("[data-conversation-ready]").waitFor()
        assert.equal(
          await dialogue.innerText(),
          before,
          "SW登録拒否後の保存再開が違う"
        )
        assert.equal(
          await page.evaluate(() =>
            localStorage.getItem("dungeons-and-dungeons/save")
          ),
          saved
        )
        await dialogue
          .getByRole("button", { name: "会話を進める", exact: true })
          .click()
        await dialogue.locator("[data-conversation-ready]").waitFor()
        const after = await dialogue.innerText()
        assert.notEqual(after, before, "SW登録を拒否されると会話を進められない")
        await assertResources()
        assert.deepEqual(errors, [], "SW登録失敗が未処理の例外になった")
        console.log(
          `${viewport.name}/${mode}: SW登録拒否でも会話進行・保存再開 OK`
        )
        await context.close()
        continue
      }
      if (slow)
        assert.equal(
          beganUncontrolled,
          true,
          "遅延する画像がSW有効化前に開始していない"
        )
      await page.waitForFunction(() => !!navigator.serviceWorker.controller)
      await page.waitForFunction(async () => {
        if (
          ![...document.images].every(
            (image) => image.complete && image.naturalWidth > 0
          )
        )
          return false
        const urls = performance
          .getEntriesByType("resource")
          .map((entry) => entry.name)
          .filter((url) => new URL(url).origin === location.origin)
        return (await Promise.all(urls.map((url) => caches.match(url)))).every(
          Boolean
        )
      })
      if (slow) assert.ok(delayedImage, "遅延画像の取得が発生していない")
      const text = await dialogue.innerText()
      const saved = await page.evaluate(() =>
        localStorage.getItem("dungeons-and-dungeons/save")
      )
      assert.ok(saved, "開始状態が保存されていない")
      await page.waitForLoadState("networkidle")
      await context.setOffline(true)
      await page.reload()
      await dialogue.waitFor()
      await dialogue.locator("[data-conversation-ready]").waitFor()
      assert.equal(
        await dialogue.innerText(),
        text,
        "オフライン再開で会話が変わった"
      )
      assert.equal(
        await page.evaluate(() =>
          localStorage.getItem("dungeons-and-dungeons/save")
        ),
        saved,
        "再開だけで保存内容が変わった"
      )
      await assertResources()
      assert.deepEqual(errors, [])
      if (viewport.name === "phone")
        await page.screenshot({ path: "/tmp/dnd-offline-resume-phone.png" })
      console.log(
        `${viewport.name}/${mode}: 本番成果物の初回読み込み→オフライン再開・会話と保存の保持・画像読込 OK`
      )
      await context.close()
    }
  }
} finally {
  await browser.close()
}
