import assert from "node:assert/strict"
import { BASE_URL, VIEWPORTS } from "@/tests/e2e/lib"
import { launch } from "@/tests/e2e/launch"

// 本番 preview を使い、SW管理下の再読込でHTMLを重複取得しないことを確認する。
const browser = await launch()
try {
  for (const viewport of VIEWPORTS) {
    const context = await browser.newContext({ viewport })
    const page = await context.newPage()
    const errors: string[] = []
    let homeRequests = 0
    context.on("request", (request) => {
      if (request.serviceWorker() && request.url() === `${BASE_URL}/`)
        homeRequests++
    })
    page.on("pageerror", (error) => errors.push(error.message))
    await page.goto(BASE_URL)
    const dialogue = page.locator("[data-conversation-dialog]")
    await dialogue.locator("[data-conversation-ready]").waitFor()
    await page.waitForFunction(() => !!navigator.serviceWorker.controller)
    await page.waitForLoadState("networkidle")
    const before = await dialogue.innerText()
    const saved = await page.evaluate(() =>
      localStorage.getItem("dungeons-and-dungeons/save")
    )
    assert.ok(saved)
    for (let attempt = 0; attempt < 2; attempt++) {
      homeRequests = 0
      await page.reload()
      await dialogue.locator("[data-conversation-ready]").waitFor()
      await page.waitForLoadState("networkidle")
      assert.equal(homeRequests, 1, "再読込でホームのHTMLを重複取得している")
      assert.equal(await dialogue.innerText(), before)
      assert.equal(
        await page.evaluate(() =>
          localStorage.getItem("dungeons-and-dungeons/save")
        ),
        saved
      )
    }
    assert.deepEqual(errors, [])
    console.log(
      `${viewport.name}: 再読込2回ともHTML取得1回・会話と保存の保持 OK`
    )
    await context.close()
  }
} finally {
  await browser.close()
}
