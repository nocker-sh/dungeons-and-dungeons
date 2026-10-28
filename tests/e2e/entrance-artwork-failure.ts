import assert from "node:assert/strict"
import { BASE_URL } from "@/tests/e2e/lib"
import { launch } from "@/tests/e2e/launch"
import { press } from "@/tests/e2e/press"
import { sceneOf } from "@/content/looks/scene-of"

const paths = new Set(
  ["town", "guild", "shop"].flatMap((place) =>
    [false, true].map((wide) => sceneOf(place, wide))
  )
)
const matching = (url: URL) => paths.has(url.pathname)
const browser = await launch()
try {
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
    { width: 1280, height: 800 },
    { width: 844, height: 390 },
  ]) {
    const page = await browser.newPage({
      viewport,
      ignoreHTTPSErrors: true,
      serviceWorkers: "block",
    })
    const errors: string[] = []
    const blocked = new Set<string>()
    page.on("pageerror", (error) => errors.push(error.message))
    await page.route(matching, async (route) => {
      blocked.add(new URL(route.request().url()).pathname)
      await route.abort("failed")
    })
    try {
      await page.goto(`${BASE_URL}/previews/town`)
      await page.getByRole("button", { name: "設定", exact: true }).waitFor()
      assert.ok(blocked.has(sceneOf("town", viewport.width > viewport.height)!))
      await page
        .getByRole("button", { name: "ダンジョン", exact: true })
        .waitFor()
      assert.equal(await page.locator("[data-entrance-fallback]").count(), 1)
      await page.waitForTimeout(700)
      const boxes = await page
        .locator("[data-entrance]")
        .evaluateAll((buttons) =>
          buttons.map((button) => ({
            label: button.getAttribute("aria-label"),
            rect: button.getBoundingClientRect().toJSON(),
          }))
        )
      assert.equal(boxes.length, 3)
      const talk = await page
        .getByRole("button", { name: "ロクスと話す", exact: true })
        .boundingBox()
      for (const [index, box] of boxes.entries()) {
        assert.ok(box.rect.width >= 44 && box.rect.height >= 44, box.label!)
        assert.ok(
          box.rect.x >= 0 && box.rect.right <= viewport.width,
          box.label!
        )
        assert.ok(
          box.rect.y >= 0 && box.rect.bottom <= viewport.height,
          box.label!
        )
        if (talk)
          assert.ok(
            box.rect.right <= talk.x ||
              box.rect.x >= talk.x + talk.width ||
              box.rect.bottom <= talk.y ||
              box.rect.y >= talk.y + talk.height,
            `${box.label}がロクスと話すボタンに重ならない`
          )
        for (const other of boxes.slice(index + 1))
          assert.ok(
            box.rect.right <= other.rect.x ||
              box.rect.x >= other.rect.right ||
              box.rect.bottom <= other.rect.y ||
              box.rect.y >= other.rect.bottom,
            `${box.label}と${other.label}が重ならない`
          )
      }
      await page.screenshot({
        path: `/tmp/dnd-entrance-failure-${viewport.width}.png`,
      })
      for (const [entrance, destination] of [
        ["冒険者ギルド", "受付"],
        ["商店街", "武器と防具"],
        ["ダンジョン", "カチコミ"],
      ]) {
        await press(page, entrance)
        await page
          .getByRole("button", { name: destination, exact: true })
          .waitFor()
        if (entrance === "冒険者ギルド") {
          await press(page, "受付")
          await page
            .getByRole("button", { name: "募集", exact: true })
            .waitFor()
          await press(page, "‹ 戻る")
          await page
            .getByRole("button", { name: "受付", exact: true })
            .waitFor()
        }
        await press(page, entrance === "ダンジョン" ? "‹ 街へ" : "‹ 戻る")
        await page
          .getByRole("button", { name: "ダンジョン", exact: true })
          .waitFor()
      }
      assert.ok(blocked.size >= 3)

      // 次の入場では再読込し、通常の背景に戻れる。
      await page.unroute(matching)
      await press(page, "冒険者ギルド")
      await page.getByRole("button", { name: "受付", exact: true }).waitFor()
      await press(page, "‹ 戻る")
      await page
        .getByRole("button", { name: "ダンジョン", exact: true })
        .waitFor()
      await page.waitForFunction(() => {
        const image = document
          .querySelector<HTMLImageElement>("[data-entrance-links]")
          ?.parentElement?.querySelector("img")
        return !!image?.naturalWidth
      })
      assert.equal(await page.locator("[data-entrance-fallback]").count(), 0)
      assert.deepEqual(errors, [])
      console.log(
        `${viewport.width}×${viewport.height}: 背景失敗時の入口配置・施設移動・再読込での復帰 OK`
      )
    } finally {
      await page.close()
    }
  }
} finally {
  await browser.close()
}
