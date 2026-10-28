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
        const game = runtime.game!
        const original = game.save()
        const targets = game.queries.party(game.state)
        const issue = game.restore({
          ...original,
          snapshot: {
            ...original.snapshot,
            members: original.snapshot.members.map((member) => ({
              ...member,
              exp: targets.find((target) => target.id === member.id)?.next ?? 0,
            })),
          },
        })
        if (issue) throw issue
        await runtime.advance(5500)
        return {
          save: JSON.stringify(game.save()),
          // 主人公は宿では成長しない。成長できる仲間はQueryが決める
          name: game.queries
            .party(game.state)
            .filter((member) => member.levelUpReady)
            .map((member) => member.name)
            .join("・"),
        }
      })
      const perks = page.locator("[data-room-perks]")
      await perks.waitFor({ state: "visible" })
      const expected = [
        room.heal === "full" ? "HP（生命力）全回復" : "HP（生命力）半分回復",
        room.levelUp ? "レベルアップ" : "レベルアップなし",
        "防具の耐久は回復しない",
      ]
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
      const growth = page.locator("[data-room-growth]")
      if ((await growth.count()) !== (room.levelUp ? 1 : 0))
        throw new Error("部屋と成長案内が一致しない")
      if (room.levelUp) {
        if ((await growth.innerText()) !== `レベルアップ予定：${saved.name}`)
          throw new Error("成長する仲間が違う")
        const rectangle = await growth.boundingBox()
        const font = await growth.evaluate((element) =>
          parseFloat(getComputedStyle(element).fontSize)
        )
        if (
          !rectangle ||
          rectangle.x < 0 ||
          rectangle.y < 0 ||
          rectangle.x + rectangle.width > width ||
          rectangle.y + rectangle.height > 760 ||
          font < 11
        )
          throw new Error("成長案内が読めない")
        if (
          rectangle.x < button.x + button.width &&
          rectangle.x + rectangle.width > button.x &&
          rectangle.y < button.y + button.height &&
          rectangle.y + rectangle.height > button.y
        )
          throw new Error("成長案内が泊まるに重なる")
      }
      await page.screenshot({
        path: `/tmp/dnd-room-growth-${width}-${room.slug}.png`,
      })
      const after = await page.evaluate(() =>
        JSON.stringify((window.__devStudio as StudioRuntime).game!.save())
      )
      if (after !== saved.save) throw new Error("部屋の閲覧で保存が変わる")
      console.log(
        `${width}/${room.slug}: 成長対象の名前・部屋ごとの案内・可読性・保存保持`
      )
      await page.close()
    }
  if (errors.length) throw new Error(errors.join("\n"))
} finally {
  await browser.close()
}
