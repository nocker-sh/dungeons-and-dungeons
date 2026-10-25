import world from "../src/lib/concept/data/world.json"
import { BASE_URL, launch, openPage } from "./lib"
import { frameUrl, parseStudioConfig } from "../src/lib/dev/studio/config"
import type { StudioRuntime } from "../src/lib/dev/studio/runtime"

// 探索の背景は資料の場所の絵（横長ならその横長版）
const place = world.find((entry) => entry.slug === "place-layer4")!
const browser = await launch()
const errors: string[] = []
try {
  for (const viewport of [
    { name: "small", width: 320, height: 760 },
    { name: "phone", width: 390, height: 844 },
    { name: "desktop", width: 1280, height: 900 },
  ]) {
    const page = await openPage(browser, viewport, errors)
    const background =
      viewport.width > viewport.height
        ? (place.wideImage ?? place.image)!
        : place.image!
    const backgroundLoaded = page.waitForResponse(
      (response) => response.url().endsWith(background) && response.ok()
    )
    await page.goto(
      BASE_URL +
        frameUrl(
          parseStudioConfig({
            scene: "route-layer4",
            duration: 15000,
            width: viewport.width,
            height: viewport.height,
          })
        )
    )
    await page.waitForFunction(
      () => window.__devStudio?.ready || window.__devStudioError
    )
    await page.evaluate(async () => {
      const runtime = window.__devStudio as StudioRuntime
      if (!runtime.game) throw new Error("祭壇の場面が準備できない")
      if (
        runtime.game.queries.expedition(runtime.game.state)?.layer !==
        "3d0fffc3-8e02-42c9-9733-bc1589520f52"
      )
        throw new Error("4層の探索画面でない")
      await runtime.advance(6500)
    })
    await backgroundLoaded
    const expectedLayerName = await page.evaluate(() => {
      const game = (window.__devStudio as StudioRuntime).game!
      const layer = game.queries.route(game.state)!.layer
      return `${layer.no}層・${layer.name}`
    })
    const layerName = page.locator("[data-expedition-layer]")
    if ((await layerName.innerText()) !== expectedLayerName)
      throw new Error("探索中の層名がQueryと一致しない")
    const bounds = await layerName.boundingBox()
    if (!bounds || bounds.x < 0 || bounds.x + bounds.width > viewport.width)
      throw new Error("層名が画面からはみ出す")
    const description = await page.locator(".left2").getAttribute("aria-label")
    if (!description?.startsWith(expectedLayerName))
      throw new Error("探索の読み上げに層名がない")
    await page.screenshot({
      path: `/tmp/dnd-layer4-background-${viewport.name}.png`,
    })
    console.log(`${viewport.name}: 4層への出撃と専用背景の読み込みを確認`)
    await page.close()
  }
  if (errors.length) throw new Error(errors.join("\n"))
} finally {
  await browser.close()
}
