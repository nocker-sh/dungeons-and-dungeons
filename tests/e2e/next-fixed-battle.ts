import { BASE_URL } from "@/tests/e2e/lib"
import { launch } from "@/tests/e2e/launch"
import { openPage } from "@/tests/e2e/open-page"
import { frameUrl } from "@/development/studio/frame-url"
import { parseStudioConfig } from "@/development/studio/parse-studio-config"
import type { StudioRuntime } from "@/client/dev/studio-runtime"

const browser = await launch()
const errors: string[] = []
try {
  for (const viewport of [
    { name: "small", width: 320, height: 760 },
    { name: "phone", width: 390, height: 844 },
    { name: "desktop", width: 1280, height: 900 },
  ]) {
    for (const layer of [0, 4]) {
      for (const landmark of ["midboss", "boss"] as const) {
        const page = await openPage(browser, viewport, errors)
        await page.goto(
          BASE_URL +
            frameUrl(
              parseStudioConfig({
                scene: layer === 0 ? "route" : `route-layer${layer}`,
                duration: 10000,
                width: viewport.width,
                height: viewport.height,
              })
            )
        )
        await page.waitForFunction(
          () => window.__devStudio?.ready || window.__devStudioError
        )
        const expected = await page.evaluate(async (landmark) => {
          const runtime = window.__devStudio as StudioRuntime
          await runtime.advance(2500)
          const game = runtime.game!
          const route = game.queries.route(game.state)!
          const goal = route.stations.find((station) => station[landmark])!
          const predecessor = route.stations.find((station) =>
            station.next.includes(goal.id)
          )!
          if (!predecessor) throw new Error("節目の直前がない")
          const saved = game.save()
          if (saved.snapshot.phase.type !== "expedition")
            throw new Error("探索でない")
          const issue = game.restore({
            ...saved,
            snapshot: {
              ...saved.snapshot,
              phase: {
                ...saved.snapshot.phase,
                expedition: {
                  ...saved.snapshot.phase.expedition,
                  at: predecessor.id,
                  visited: [
                    ...saved.snapshot.phase.expedition.visited,
                    predecessor.id,
                  ],
                },
              },
            },
          })
          if (issue) throw issue
          await runtime.advance(3500)
          const updated = game.queries.route(game.state)!
          return {
            steps: updated.midbossSteps,
            endSteps: updated.stepsLeft,
            foes: updated.stations.find((station) => station.id === goal.id)!
              .fixedFoes,
            save: JSON.stringify(game.save()),
          }
        }, landmark)
        const label = page.getByText(
          landmark === "midboss" ? "次は中ボス戦" : "次はボス戦",
          { exact: true }
        )
        if (!(await label.isVisible()))
          throw new Error("次の固定戦闘の表示がない")
        const preview = page.locator("[data-next-fixed-foe]")
        if (
          (await preview.count()) !== expected.foes.length ||
          !expected.foes.length
        )
          throw new Error("次の固定敵の情報がない")
        for (const foe of expected.foes) {
          const text = await preview
            .filter({ hasText: `敵：${foe.name}` })
            .innerText()
          if (
            foe.skills.length &&
            !text.includes(`ワザ：${foe.skills.join("・")}`)
          )
            throw new Error("敵のワザの予告が違う")
          if (
            foe.resistances.length &&
            !text.includes(
              `耐性：${foe.resistances.map((entry) => entry.label).join("・")}`
            )
          )
            throw new Error("敵の耐性の予告が違う")
        }
        const previewBounds = await preview.first().boundingBox()
        if (
          !previewBounds ||
          previewBounds.x < 0 ||
          previewBounds.x + previewBounds.width > viewport.width ||
          previewBounds.y + previewBounds.height > viewport.height * 0.6
        )
          throw new Error("固定敵の予告が画面外か操作に近すぎる")
        const bounds = await label.boundingBox()
        if (!bounds || bounds.x < 0 || bounds.x + bounds.width > viewport.width)
          throw new Error("案内が画面外")
        if (
          (await page.evaluate(() =>
            JSON.stringify((window.__devStudio as StudioRuntime).game!.save())
          )) !== expected.save
        )
          throw new Error("表示で状態が変化")
        await page.screenshot({
          path: `/tmp/dnd-fixed-foe-preview-${viewport.name}-${layer}-${landmark}.png`,
        })
        console.log(`${viewport.name}: ${landmark}直前の案内を確認`)
        const branch = await page.evaluate(async () => {
          const runtime = window.__devStudio as StudioRuntime
          const game = runtime.game!
          const route = game.queries.route(game.state)!
          const branch = route.stations.find(
            (station) =>
              station.next.length > 1 &&
              station.next.every((id) => {
                const next = route.stations.find((entry) => entry.id === id)!
                return !next.boss && !next.midboss
              })
          )!
          if (!branch) throw new Error("通常の分岐がない")
          const saved = game.save()
          if (saved.snapshot.phase.type !== "expedition")
            throw new Error("探索でない")
          const issue = game.restore({
            ...saved,
            snapshot: {
              ...saved.snapshot,
              phase: {
                ...saved.snapshot.phase,
                expedition: {
                  ...saved.snapshot.phase.expedition,
                  at: branch.id,
                  visited: [
                    ...saved.snapshot.phase.expedition.visited,
                    branch.id,
                  ],
                },
              },
            },
          })
          if (issue) throw issue
          await runtime.advance(3500)
          return { choices: branch.next, save: JSON.stringify(game.save()) }
        })
        for (const choice of branch.choices) {
          const button = page.locator(`[data-route-choice="${choice}"]`)
          await button.click()
          if ((await button.getAttribute("aria-pressed")) !== "true")
            throw new Error("分岐の選択が反映されない")
          if (await page.getByText(/^次は(中ボス|ボス)戦$/).count())
            throw new Error("通常の分岐に固定戦闘の案内が残る")
        }
        if (
          (await page.evaluate(() =>
            JSON.stringify((window.__devStudio as StudioRuntime).game!.save())
          )) !== branch.save
        )
          throw new Error("道を選ぶだけで探索状態が変化")
        await page.close()
      }
    }
  }
  if (errors.length) throw new Error(errors.join("\n"))
} finally {
  await browser.close()
}
