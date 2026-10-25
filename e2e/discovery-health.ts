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
    for (const encounter of [
      {
        station: "l5",
        title: "見捨てられた野営地",
        artwork: "discovery-camp-fisheye-comic-v3",
        choice: "rest",
        reward: "619ae895-2e95-4f01-ba6b-b78835debae7",
        count: 0,
      },
      {
        station: "l10",
        title: "封じられた宝箱",
        artwork: "discovery-sealed-chest-fisheye-comic-v4",
        choice: "force",
        reward: "619ae895-2e95-4f01-ba6b-b78835debae7",
        count: 4,
      },
    ]) {
      const page = await openPage(browser, viewport, errors)
      page.setDefaultTimeout(15000)
      console.log(`start: ${viewport.name} ${encounter.title}`)
      await page.goto(
        BASE_URL +
          frameUrl(
            parseStudioConfig({
              scene: "route-discovery",
              width: viewport.width,
              height: viewport.height,
            })
          )
      )
      await page.waitForFunction(
        () => window.__devStudio?.ready || window.__devStudioError
      )
      // Diagnostic setup only: use validated saves and actual event content, without altering rules.
      await page.evaluate(async (station) => {
        const runtime = window.__devStudio as StudioRuntime
        const game = runtime.game!
        const saved = game.save()
        if (saved.snapshot.phase.type !== "expedition")
          throw new Error("探索ではない")
        const problem = game.restore({
          ...saved,
          snapshot: {
            ...saved.snapshot,
            members: saved.snapshot.members.map((member) =>
              member.id === saved.snapshot.party[0]
                ? { ...member, hp: 1 }
                : member
            ),
            phase: {
              type: "expedition",
              expedition: {
                ...saved.snapshot.phase.expedition,
                at: station,
                visited: ["s", station],
                pending: { kind: "discovery" },
              },
            },
          },
        })
        if (problem) throw new Error(String(problem))
        await runtime.advance(2500)
      }, encounter.station)
      const dialog = page.getByRole("dialog", {
        name: encounter.title,
        exact: true,
      })
      await dialog.waitFor()
      const picture = dialog.locator(
        `img[src="/art/scenes/${encounter.artwork}.webp"]`
      )
      await picture.waitFor()
      if (
        !(await picture.evaluate(
          (image) =>
            (image as HTMLImageElement).complete &&
            (image as HTMLImageElement).naturalWidth === 1536
        ))
      )
        throw new Error("画像を読み込めない")
      const bounds = await picture.boundingBox()
      if (
        !bounds ||
        bounds.width < 50 ||
        bounds.x < 0 ||
        bounds.x + bounds.width > viewport.width
      )
        throw new Error("画像が画面からはみ出す")
      const before = await page.evaluate((id) => {
        const game = (window.__devStudio as StudioRuntime).game!
        const choice = game.queries
          .route(game.state)!
          .discovery!.choices.find((choice) => choice.id === id)!
        return {
          gold: game.state.gold,
          cost: choice.cost ?? 0,
          label: choice.label,
          healthChanges: choice.healthChanges,
        }
      }, encounter.choice)
      const contents = await dialog.textContent()
      for (const change of before.healthChanges)
        if (
          !contents?.includes(
            `${change.name} HP ${change.before}→${change.after}`
          )
        )
          throw new Error("実画面にHPの変化がない")
      await page.screenshot({
        path: `/tmp/dnd-discovery-health-${encounter.artwork}-${viewport.name}.png`,
      })
      await dialog.getByRole("button").filter({ hasText: before.label }).click()
      await page.evaluate(async () => {
        await window.__devStudio!.advance(4500)
      })
      const after = await page.evaluate(() => {
        const game = (window.__devStudio as StudioRuntime).game!
        if (game.state.phase.type !== "expedition")
          throw new Error("探索ではない")
        return {
          gold: game.state.gold,
          pending: game.state.phase.expedition.pending,
          members: game.state.members,
        }
      })
      if (
        after.gold !== before.gold - before.cost ||
        after.pending?.kind !== "treasure"
      )
        throw new Error("取引の精算が一致しない")
      if (
        (after.pending.goods.find((entry) => entry.good === encounter.reward)
          ?.count ?? 0) !== encounter.count
      )
        throw new Error("実際の回収数が一致しない")
      for (const change of before.healthChanges)
        if (
          after.members.find((member) => member.id === change.id)?.hp !==
          change.after
        )
          throw new Error("表示したHPと実際のHPが違う")
      if (
        encounter.choice === "rest" &&
        !after.pending.note?.includes("各人の各ワザの残り回数を3回戻す")
      )
        throw new Error("結果文の野営回復回数が違う")
      if (await dialog.count()) throw new Error("選択が終わらない")
      console.log(
        `${viewport.name}: ${encounter.title}の画像・${before.cost}G精算・報酬${encounter.count}個を確認`
      )
      await page.close()
    }
  }
  if (errors.length) throw new Error(errors.join("\n"))
} catch (error) {
  console.error(errors)
  throw error
} finally {
  await browser.close()
}
