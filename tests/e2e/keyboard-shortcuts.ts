import assert from "node:assert/strict"
import { BASE_URL, VIEWPORTS } from "@/tests/e2e/lib"
import { launch } from "@/tests/e2e/launch"
import { openPage } from "@/tests/e2e/open-page"

const browser = await launch()
const errors: string[] = []
try {
  for (const viewport of VIEWPORTS) {
    const page = await openPage(browser, viewport, errors)
    await page.routeWebSocket("**/*", () => {})
    for (const scene of ["town", "outskirts-deep"]) {
      await page.goto(`${BASE_URL}/previews/${scene}?still`)
      await page.locator(".formation .card .hit").first().waitFor()
      await page.waitForTimeout(1200)
      const selection = page.locator('.revolver .dest[aria-selected="true"]')
      const before =
        scene === "outskirts-deep" ? await selection.textContent() : null
      for (const modifier of ["ctrlKey", "metaKey", "altKey"]) {
        for (const key of ["1", "s", "ArrowUp"]) {
          const accepted = await page.evaluate(
            ({ modifier, key }) =>
              window.dispatchEvent(
                new KeyboardEvent("keydown", {
                  key,
                  [modifier]: true,
                  cancelable: true,
                  bubbles: true,
                })
              ),
            { modifier, key }
          )
          assert.equal(
            accepted,
            true,
            `${scene}: ${modifier}+${key}をゲームが奪った`
          )
          assert.equal(
            await page.locator(".stand").count(),
            0,
            "ショートカットで仲間の詳細が開いた"
          )
          if (before !== null)
            assert.equal(await selection.textContent(), before)
        }
      }
      if (before !== null) {
        await page.keyboard.press("ArrowUp")
        assert.notEqual(
          await selection.textContent(),
          before,
          "通常の方向キーが動かない"
        )
      } else {
        await page.keyboard.press("1")
        await page.locator(".stand").waitFor()
      }
    }
    await page.goto(`${BASE_URL}/previews/conversations?id=alda-mayu-inn`)
    const dialogue = page.locator("[data-conversation-dialog]")
    await dialogue.locator("[data-conversation-ready]").waitFor()
    const before = await dialogue.innerText()
    for (const modifier of ["ctrlKey", "metaKey", "altKey"]) {
      for (const key of ["ArrowRight", "Tab", "Enter", " "]) {
        const accepted = await page.evaluate(
          ({ modifier, key }) =>
            document.activeElement!.dispatchEvent(
              new KeyboardEvent("keydown", {
                key,
                [modifier]: true,
                cancelable: true,
                bubbles: true,
              })
            ),
          { modifier, key }
        )
        assert.equal(accepted, true, `会話が${modifier}+${key}を奪った`)
        assert.equal(
          await dialogue.innerText(),
          before,
          "ショートカットで会話が進んだ"
        )
      }
    }
    await page.keyboard.press("Enter")
    await dialogue.locator("[data-conversation-ready]").waitFor()
    assert.notEqual(
      await dialogue.innerText(),
      before,
      "通常のEnterで会話が進まない"
    )
    console.log(
      `${viewport.name}: 修飾キー付き操作で仲間・行き先・会話を変更せず、通常の操作は維持 OK`
    )
    await page.close()
  }
  assert.deepEqual(errors, [])
} finally {
  await browser.close()
}
