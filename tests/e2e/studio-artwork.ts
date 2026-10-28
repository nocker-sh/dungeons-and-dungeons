import assert from "node:assert/strict"
import { waitForStudio } from "@/scripts/studio-browser"
import { BASE_URL } from "@/tests/e2e/lib"
import { launch } from "@/tests/e2e/launch"
import { openPage } from "@/tests/e2e/open-page"
import { tap } from "@/tests/e2e/tap"
import { frameUrl } from "@/development/studio/frame-url"
import { parseStudioConfig } from "@/development/studio/parse-studio-config"
import { FOE_ART } from "@/content/looks/combat-art"
import { foeImagePaths } from "@/content/foe-image-paths"
import { contentSource } from "@/content/game-content"
import type { StudioRuntime } from "@/client/dev/studio-runtime"

const enemyPaths = new Set(
  Object.values(FOE_ART).flatMap((art) =>
    [art, ...(art.appearances ?? [])].flatMap((entry) =>
      [
        entry.img,
        entry.attack,
        entry.sleeping,
        entry.defeated,
        ...(entry.attacks ?? []),
        ...Object.values(entry.skills ?? {}),
      ].filter((path): path is string => !!path)
    )
  )
)
const browser = await launch()
const normalImages = new Set(Object.values(FOE_ART).map((art) => art.img))
try {
  for (const width of [390, 1280]) {
    const errors: string[] = []
    const page = await openPage(browser, { width, height: 844 }, errors)
    await page.routeWebSocket("**/*", () => {})
    const requested = new Set<string>()
    page.on("request", (request) =>
      requested.add(new URL(request.url()).pathname)
    )
    const blocked: string[] = []
    const isEnemy = (url: URL) =>
      enemyPaths.has(url.pathname) && !normalImages.has(url.pathname)
    await page.route(isEnemy, async (route) => {
      blocked.push(route.request().url())
      await route.abort("failed")
    })
    await page.goto(
      BASE_URL +
        frameUrl(
          parseStudioConfig({
            scene: "quick-quests",
            width,
            height: 844,
            duration: 15000,
          })
        )
    )
    await waitForStudio(page)
    assert.equal(await page.evaluate(() => window.__devStudioError), undefined)
    assert.deepEqual(
      blocked,
      [],
      "依頼一覧の起動は敵の攻撃・睡眠・戦闘不能画像に依存しない"
    )
    await page.unroute(isEnemy)
    const advance = (time: number) =>
      page.evaluate(async (time) => window.__devStudio!.advance(time), time)
    await advance(3500)
    await tap(page, page.getByRole("button", { name: "街なか", exact: true }))
    await advance(4500)
    await tap(page, page.getByRole("button", { name: /街の荷箱を守る/ }))
    await advance(5500)
    await tap(page, page.getByRole("button", { name: "戦う", exact: true }))
    await advance(10000)
    const foes = await page.evaluate(() => {
      const game = (window.__devStudio as StudioRuntime).game!
      return game.queries.battle(game.state)!.foes
    })
    assert.ok(foes.length > 0)
    for (const foe of foes)
      for (const path of foeImagePaths(foe.foe, foe.appearanceId))
        assert.ok(requested.has(path), `戦闘突入で必要な画像を読む: ${path}`)
    assert.equal(await page.locator(".foe img").count(), foes.length)
    assert.ok(
      await page
        .locator(".foe img")
        .evaluateAll((images) =>
          images.every(
            (image) =>
              (image as HTMLImageElement).complete &&
              (image as HTMLImageElement).naturalWidth > 0
          )
        )
    )
    assert.deepEqual(errors, [])
    console.log(
      `${width}: 戦闘用の差分画像なしで依頼一覧が起動し、戦闘へ入ると個体の全画像を読み込む`
    )
    await page.close()
  }
  // 登場する画像が壊れている場合は、スタジオのエラーを隠さない。
  const page = await browser.newPage({
    ignoreHTTPSErrors: true,
    serviceWorkers: "block",
  })
  const foe = contentSource.foes.find((foe) => foe.slug === "kamokutsu")!
  const path = foeImagePaths(foe.id)[0]!
  let blocked = false
  await page.route(
    (url) => url.pathname === path,
    async (route) => {
      blocked = true
      await route.abort("failed")
    }
  )
  await page.goto(
    BASE_URL + frameUrl(parseStudioConfig({ foes: ["kamokutsu"] }))
  )
  await waitForStudio(page)
  assert.equal(blocked, true)
  assert.ok((await page.getByRole("alert").innerText()).includes(path))
  assert.equal(await page.evaluate(() => window.__devStudio?.ready), undefined)
  console.log("登場する敵の画像が読めない場合は起動エラーを表示")
  await page.close()
} finally {
  await browser.close()
}
