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
      if (window.__devStudioError) throw new Error(window.__devStudioError)
      await window.__devStudio!.advance(9000)
    })
    for (const count of [2, 3]) {
      const saved = await page.evaluate(async (count) => {
        const runtime = window.__devStudio as StudioRuntime
        const game = runtime.game!
        const saved = game.save()
        if (saved.snapshot.phase.type !== "battle")
          throw new Error("戦闘でない")
        const battle = saved.snapshot.phase.battle
        const statuses = [
          { kind: "poison" as const, turns: 3 },
          { kind: "bind" as const, turns: 2 },
          { kind: "regen" as const, turns: 4 },
          { kind: "taunt" as const, turns: 2 },
          { kind: "charge" as const, turns: 1 },
          { kind: "protect" as const, turns: 1 },
        ]
        const foes = Array.from({ length: count }, (_, index) => ({
          ...battle.foes[index % battle.foes.length]!,
          id: `status-probe-${index}`,
          status: statuses.map((entry) => ({ ...entry })),
        }))
        const issue = game.restore({
          ...saved,
          snapshot: {
            ...saved.snapshot,
            phase: {
              ...saved.snapshot.phase,
              battle: {
                ...battle,
                foes,
                order: [
                  ...battle.order.filter((ref) => ref.kind === "member"),
                  ...foes.map((foe) => ({ kind: "foe" as const, id: foe.id })),
                ],
                turn: 0,
              },
            },
          },
        })
        if (issue) throw new Error(`${issue.message}: ${String(issue.cause)}`)
        await runtime.advance(count === 2 ? 9001 : 11001)
        return JSON.stringify(game.save())
      }, count)
      const plates = page.locator("[data-foe-statuses]")
      if ((await plates.count()) !== count)
        throw new Error("敵の状態欄が足りない")
      const labels = [
        "毒3手番",
        "縛り2手番",
        "再生4手番",
        "挑発2手番",
        "溜め",
        "守り",
      ]
      for (let index = 0; index < count; index++) {
        const plate = plates.nth(index)
        const chips = plate.locator("i")
        if ((await chips.count()) !== 6) throw new Error("6状態が表示されない")
        for (let status = 0; status < 6; status++) {
          const chip = chips.nth(status)
          if ((await chip.innerText()).replace(/\s/g, "") !== labels[status])
            throw new Error("残り手番が違う")
          const bounds = await chip.boundingBox()
          if (
            !bounds ||
            bounds.x < 0 ||
            bounds.x + bounds.width > viewport.width ||
            bounds.y < 56 ||
            bounds.y + bounds.height > viewport.height
          )
            throw new Error(
              `状態が画面外か見出しと重なる: ${viewport.name} ${count}体 ${index} ${status} ${JSON.stringify(bounds)}`
            )
          if (
            !(await chip
              .locator("b")
              .evaluate(
                (element) =>
                  parseFloat(getComputedStyle(element).fontSize) >= 10
              ))
          )
            throw new Error("文字が小さい")
        }
      }
      await page.screenshot({
        path: `/tmp/dnd-foe-statuses-multiple-${viewport.name}-${count}.png`,
      })
      if (
        (await page.evaluate(() =>
          JSON.stringify((window.__devStudio as StudioRuntime).game!.save())
        )) !== saved
      )
        throw new Error("状態の閲覧で保存が変わる")
      console.log(`${viewport.name}/${count}体・各6状態: 表示・保存保持`)
    }
    await page.close()
  }
  if (errors.length) throw new Error(errors.join("\n"))
} finally {
  await browser.close()
}
