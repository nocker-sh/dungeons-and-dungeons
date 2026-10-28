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
              duration: 20000,
              width,
              height: 760,
            })
          )
      )
      await page.waitForFunction(
        () => window.__devStudio?.ready || window.__devStudioError
      )
      const balances = room.price ? [0, room.price - 1, room.price] : [0]
      for (const [index, gold] of balances.entries()) {
        const before = await page.evaluate(
          async ({ index, gold, id }) => {
            const runtime = window.__devStudio as StudioRuntime
            await runtime.advance(2500 + index * 4000)
            const game = runtime.game!
            const save = game.save()
            const issue = game.restore({
              ...save,
              snapshot: { ...save.snapshot, gold },
            })
            if (issue) throw issue
            await runtime.advance(4500 + index * 4000)
            const room = game.queries
              .rooms(game.state)
              .find((entry) => entry.id === id)!
            if (room.missingGold !== Math.max(0, room.price - gold))
              throw new Error("不足額Queryが違う")
            return JSON.stringify(game.save())
          },
          { index, gold, id: room.id }
        )
        const missing = Math.max(0, room.price - gold)
        const button = page.getByRole("button", {
          name: missing ? `あと${missing}G必要` : "泊まる",
          exact: true,
        })
        await button.waitFor({ state: "visible" })
        const box = await button.boundingBox()
        if (
          !box ||
          box.x < 0 ||
          box.y < 0 ||
          box.x + box.width > width ||
          box.y + box.height > 760
        )
          throw new Error("宿泊ボタンが画面外")
        if (missing) {
          await button.click()
          await page.evaluate(
            (time) => (window.__devStudio as StudioRuntime).advance(time),
            5500 + index * 4000
          )
          await button.waitFor({ state: "visible" })
        }
        if (
          (await page.evaluate(() =>
            JSON.stringify((window.__devStudio as StudioRuntime).game!.save())
          )) !== before
        )
          throw new Error("不足時の拒否か閲覧で保存が変わる")
        await page.screenshot({
          path: `/tmp/dnd-room-shortage-${width}-${room.slug}-${gold}.png`,
        })
      }
      console.log(
        `${width}/${room.slug}: 不足額・拒否の保存保持・充足で泊まるへ復帰`
      )
      await page.close()
    }
  if (errors.length) throw new Error(errors.join("\n"))
} finally {
  await browser.close()
}
