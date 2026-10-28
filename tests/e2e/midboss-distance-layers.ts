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
      for (const passed of [false, true]) {
        const page = await openPage(browser, viewport, errors)
        await page.goto(
          BASE_URL +
            frameUrl(
              parseStudioConfig({
                scene: layer === 0 ? "route" : "route-layer4",
                duration: 10000,
                width: viewport.width,
                height: viewport.height,
              })
            )
        )
        await page.waitForFunction(
          () => window.__devStudio?.ready || window.__devStudioError,
          undefined,
          { timeout: 60000 }
        )
        const expected = await page.evaluate(async (passed) => {
          const runtime = window.__devStudio as StudioRuntime
          await runtime.advance(2500)
          const game = runtime.game!
          const route = game.queries.route(game.state)!
          if (passed) {
            const midboss = route.stations.find((station) => station.midboss)!
            if (!midboss) throw new Error("中ボスがない")
            const saved = game.save()
            if (saved.snapshot.phase.type !== "expedition")
              throw new Error("探索の前提が違う")
            const issue = game.restore({
              ...saved,
              snapshot: {
                ...saved.snapshot,
                phase: {
                  ...saved.snapshot.phase,
                  expedition: {
                    ...saved.snapshot.phase.expedition,
                    visited: [
                      ...saved.snapshot.phase.expedition.visited,
                      midboss.id,
                    ],
                  },
                },
              },
            })
            if (issue) throw issue
          }
          await runtime.advance(3500)
          const updated = game.queries.route(game.state)!
          if (
            passed
              ? updated.midbossSteps !== null
              : !(updated.midbossSteps! > 0)
          )
            throw new Error("節目の距離判定が違う")
          return {
            steps: updated.midbossSteps,
            endSteps: updated.stepsLeft,
            save: JSON.stringify(game.save()),
          }
        }, passed)
        if (
          !(await page
            .getByText("終点まで（区間）", { exact: true })
            .isVisible())
        )
          throw new Error("終点距離の単位がない")
        if (
          !(await page.locator(".left2").getAttribute("aria-label"))?.includes(
            `終点まであと${expected.endSteps}区間`
          )
        )
          throw new Error("終点距離の読み上げに単位がない")
        if (passed) {
          if (await page.getByText(/^中ボスまであと/).count())
            throw new Error("通過済みの中ボスまでの距離が出る")
        } else {
          const label = page.getByText(`中ボスまであと${expected.steps}区間`, {
            exact: true,
          })
          if (
            !(
              await page.locator(".left2").getAttribute("aria-label")
            )?.includes(`中ボスまであと${expected.steps}区間`)
          )
            throw new Error("距離の読み上げがない")
          if (!(await label.isVisible()))
            throw new Error("中ボスまでの距離がない")
          if (
            (await label.evaluate((node) =>
              parseFloat(getComputedStyle(node).fontSize)
            )) < 11
          )
            throw new Error("補助文字が小さすぎる")
          const bounds = await label.boundingBox()
          if (
            !bounds ||
            bounds.x < 0 ||
            bounds.x + bounds.width > viewport.width
          )
            throw new Error("距離が画面外")
        }
        if (
          (await page.evaluate(() =>
            JSON.stringify((window.__devStudio as StudioRuntime).game!.save())
          )) !== expected.save
        )
          throw new Error("表示で状態が変化")
        await page.screenshot({
          path: `/tmp/dnd-midboss-distance-${viewport.name}-${layer}-${passed ? "passed" : "before"}.png`,
        })
        console.log(
          `${viewport.name}/${layer}層: ${passed ? "通過後の距離を隠す" : `中ボスまで${expected.steps}区間を表示`}`
        )
        await page.close()
      }
    }
  }
  if (errors.length) throw new Error(errors.join("\n"))
} finally {
  await browser.close()
}
