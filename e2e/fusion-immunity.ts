import { BASE_URL, launch, openPage } from "./lib"
import { frameUrl, parseStudioConfig } from "../src/lib/dev/studio/config"
import type { StudioRuntime } from "../src/lib/dev/studio/runtime"

const browser = await launch()
const errors: string[] = []
try {
  for (const viewport of [
    { name: "small", width: 320, height: 760 },
    { name: "phone", width: 390, height: 844 },
    { name: "desktop", width: 1280, height: 900 },
  ]) {
    const page = await openPage(browser, viewport, errors)
    await page.goto(
      BASE_URL +
        frameUrl(
          parseStudioConfig({
            scene: "battle-layer4",
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
      await window.__devStudio!.advance(9000)
    })
    for (const withStatuses of [true, false]) {
      const saved = await page.evaluate(async (withStatuses) => {
        const runtime = window.__devStudio as StudioRuntime
        const game = runtime.game!
        const saved = game.save()
        const member = saved.snapshot.party[0]!
        const issue = game.restore({
          ...saved,
          snapshot: {
            ...saved.snapshot,
            demons: saved.snapshot.demons.map((demon) => ({
              ...demon,
              lv: withStatuses ? 20 : 1,
              exp: 0,
            })),
            members: saved.snapshot.members.map((entry) =>
              entry.id === member
                ? {
                    ...entry,
                    status: withStatuses
                      ? [
                          { kind: "poison", turns: 3 },
                          { kind: "bind", turns: 2 },
                          { kind: "regen", turns: 4 },
                          { kind: "taunt", turns: 2 },
                          { kind: "charge", turns: 1 },
                          { kind: "protect", turns: 1 },
                        ]
                      : [],
                  }
                : entry
            ),
          },
        })
        if (issue) throw issue
        await runtime.advance(withStatuses ? 9001 : 11001)
        return JSON.stringify(game.save())
      }, withStatuses)
      await page.locator(".card .hit").first().click()
      await page.evaluate(async (withStatuses) => {
        await window.__devStudio!.advance(withStatuses ? 10500 : 12500)
      }, withStatuses)
      const peek = page.locator(".peek")
      await peek.waitFor({ state: "visible" })
      if (withStatuses) {
        const labels = {
          poison: "毒：残り3手番",
          bind: "縛り：残り2手番",
          regen: "再生：残り4手番",
          taunt: "挑発：残り2手番",
          charge: "溜め：使うまで有効",
          protect: "守り：使うまで有効",
        }
        for (const [kind, text] of Object.entries(labels)) {
          const label = peek.locator(`[data-member-status="${kind}"]`)
          if ((await label.innerText()) !== text)
            throw new Error(`状態の説明が違う: ${kind}`)
          const bounds = await label.boundingBox()
          if (
            !bounds ||
            bounds.x < 0 ||
            bounds.x + bounds.width > viewport.width ||
            bounds.y < 0 ||
            bounds.y + bounds.height > viewport.height
          )
            throw new Error(`状態が画面外: ${kind}`)
        }
      } else {
        if ((await peek.locator("[data-member-status]").count()) !== 0)
          throw new Error("解除した状態が残る")
        if (!(await peek.innerText()).includes("状態異常なし"))
          throw new Error("状態なしを表示しない")
      }
      const text = await peek.innerText()
      if (withStatuses ? !text.includes("無効") : !text.includes("耐性"))
        throw new Error("合体の耐性の説明が違う")
      await page.screenshot({
        path: `/tmp/dnd-fusion-immunity-${viewport.name}-${withStatuses ? "all" : "none"}.png`,
      })
      await peek.click({ position: { x: 10, y: 10 } })
      if (await page.locator(".peek").count())
        throw new Error("詳細を閉じられない")
      if (
        (await page.evaluate(() =>
          JSON.stringify((window.__devStudio as StudioRuntime).game!.save())
        )) !== saved
      )
        throw new Error("状態の閲覧で保存が変わる")
      console.log(
        `${viewport.name}/${withStatuses ? "6状態" : "状態なし"}: 表示・開閉・保存保持`
      )
    }
    await page.close()
  }
  if (errors.length) throw new Error(errors.join("\n"))
} finally {
  await browser.close()
}
