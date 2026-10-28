import assert from "node:assert/strict"
import { BASE_URL } from "@/tests/e2e/lib"
import { launch } from "@/tests/e2e/launch"
import { openPage } from "@/tests/e2e/open-page"
import { frameUrl } from "@/development/studio/frame-url"
import { parseStudioConfig } from "@/development/studio/parse-studio-config"
import type { StudioRuntime } from "@/client/dev/studio-runtime"
import rooms from "@/content/data/rooms.json"
const browser = await launch()
const errors: string[] = []
try {
  for (const width of [320, 390, 1280])
    for (const room of rooms) {
      const page = await openPage(browser, { width, height: 760 }, errors)
      await page.goto(
        BASE_URL +
          frameUrl(
            parseStudioConfig({
              scene: `room-${room.slug}`,
              duration: 15000,
              width,
              height: 760,
            })
          )
      )
      await page.waitForFunction(
        () => window.__devStudio?.ready || window.__devStudioError
      )
      const saved = await page.evaluate(async () => {
        const runtime = window.__devStudio as StudioRuntime
        await runtime.advance(4500)
        return JSON.stringify(runtime.game!.save())
      })
      const perks = page.locator("[data-room-perks]")
      await perks.waitFor({ state: "visible" })
      const expected = [
        room.heal === "full" ? "HP（生命力）全回復" : "HP（生命力）半分回復",
        "ワザの残り 全回復",
        "clean" in room && room.clean
          ? "疲れ・汚れ 全快"
          : `疲れ ${room.fatigue > 0 ? "+" : "−"}${Math.abs(room.fatigue)}`,
        ...(!("clean" in room && room.clean) && room.dirt
          ? [`汚れ +${room.dirt}`]
          : []),
        room.levelUp ? "レベルアップ" : "レベルアップなし",
        "防具の耐久は回復しない",
      ]
      const accessibility = await page.context().newCDPSession(page)
      const tree = await accessibility.send("Accessibility.getFullAXTree")
      const texts = tree.nodes
        .filter((node) => !node.ignored && node.role?.value === "StaticText")
        .map((node) => String(node.name?.value ?? "").trim())
      for (const label of [
        ...expected,
        "一泊",
        room.price ? String(room.price) : "タダ",
        ...(room.price ? ["G"] : []),
      ])
        assert.ok(
          texts.includes(label),
          `${room.slug}: 読み上げに公開する: ${label}`
        )
      assert.equal(
        await page
          .getByRole("region", { name: `${room.name}の宿泊条件`, exact: true })
          .count(),
        1
      )
      await accessibility.detach()
      for (const label of expected) {
        const item = perks.getByText(label, { exact: true })
        if (!(await item.isVisible()))
          throw new Error(`${room.slug}/${label}がない`)
        const readable = await item.evaluate((element) => {
          const box = element.getBoundingClientRect()
          return (
            parseFloat(getComputedStyle(element).fontSize) >= 11 &&
            box.left >= 0 &&
            box.right <= innerWidth &&
            box.top >= 0 &&
            box.bottom <= innerHeight
          )
        })
        if (!readable) throw new Error(`${room.slug}/${label}が読めない配置`)
      }
      const bounds = await perks.boundingBox()
      const button = await page
        .getByRole("button", { name: "泊まる", exact: true })
        .boundingBox()
      if (
        !bounds ||
        !button ||
        (bounds.x < button.x + button.width &&
          bounds.x + bounds.width > button.x &&
          bounds.y < button.y + button.height &&
          bounds.y + bounds.height > button.y)
      ) {
        await page.screenshot({
          path: `/tmp/dnd-room-perks-overlap-${width}-${room.slug}.png`,
        })
        throw new Error(
          `効果札が宿泊ボタンへ重なる：${JSON.stringify({ bounds, button })}`
        )
      }
      await page.screenshot({
        path: `/tmp/dnd-room-perks-${width}-${room.slug}.png`,
      })
      const after = await page.evaluate(() =>
        JSON.stringify((window.__devStudio as StudioRuntime).game!.save())
      )
      if (after !== saved) throw new Error("部屋の閲覧で保存が変わる")
      console.log(
        `${width}/${room.slug}: 回復・レベル・防具の説明・可読性・保存保持`
      )
      await page.close()
    }
  if (errors.length) throw new Error(errors.join("\n"))
} finally {
  await browser.close()
}
