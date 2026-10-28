import foes from "@/content/data/foes.json"
import { BASE_URL } from "@/tests/e2e/lib"
import { assertFoeHpHidden } from "@/tests/e2e/assert-foe-hp-hidden"
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
    for (const scene of [
      "boss-resistance",
      "battle-layer4",
      "battle-layer3",
      "battle-two",
      "battle-slime",
    ]) {
      const page = await openPage(browser, viewport, errors)
      await page.goto(
        BASE_URL +
          frameUrl(
            parseStudioConfig({
              scene: scene === "boss-resistance" ? "battle-layer4" : scene,
              duration: 15000,
              width: viewport.width,
              height: viewport.height,
            })
          )
      )
      await page.waitForFunction(
        () => window.__devStudio?.ready || window.__devStudioError
      )
      const expected = await page.evaluate(
        async (bossFixture) => {
          const runtime = window.__devStudio as StudioRuntime
          const game = runtime.game!
          if (bossFixture) {
            const saved = game.save()
            if (saved.snapshot.phase.type !== "battle")
              throw new Error("戦闘の場面ではない")
            const battle = saved.snapshot.phase.battle
            const first = battle.foes[0]!
            const boss = {
              ...first,
              foe: bossFixture.id,
              hp: bossFixture.hp,
              maxHp: bossFixture.hp,
              status: [],
            }
            delete boss.appearanceId
            const problem = game.restore({
              ...saved,
              snapshot: {
                ...saved.snapshot,
                phase: {
                  ...saved.snapshot.phase,
                  battle: {
                    ...battle,
                    foes: [boss],
                    order: battle.order.filter(
                      (ref) => ref.kind === "member" || ref.id === first.id
                    ),
                    turn: 0,
                  },
                },
              },
            })
            if (problem) throw problem
          }
          await runtime.advance(9000)
          return {
            foes: game.queries.battle(game.state)!.foes,
            save: JSON.stringify(game.save()),
          }
        },
        scene === "boss-resistance"
          ? foes.find((entry) => entry.slug === "slime-swordsman")!
          : null
      )
      if (
        scene === "boss-resistance" &&
        expected.foes[0]!.resistances.find((entry) => entry.kind === "poison")
          ?.percent !== 70
      )
        throw new Error("最深層ボスの毒耐性でない")
      for (const foe of expected.foes) {
        const definition = foes.find((entry) => entry.id === foe.foe)!
        const resistances = Object.entries(definition.resist ?? {})
          .filter(([, value]) => value > 0)
          .map(([kind, value]) => ({ kind, percent: Math.round(value * 100) }))
        if (
          JSON.stringify(
            foe.resistances.map(({ kind, percent }) => ({ kind, percent }))
          ) !== JSON.stringify(resistances)
        )
          throw new Error("耐性の数値が敵の定義と違う")
        const label = page.locator(`[data-foe-resistances="${foe.id}"]`)
        if (!resistances.length) {
          if (await label.count()) throw new Error("耐性なしの敵に表示がある")
          continue
        }
        await label.waitFor({ state: "visible" })
        if (
          (await label.innerText()) !==
          `耐性：${foe.resistances.map((entry) => entry.label).join("・")}`
        )
          throw new Error("耐性の表示がQueryと違う")
        const bounds = await label.boundingBox()
        if (
          !bounds ||
          bounds.x < 0 ||
          bounds.x + bounds.width > viewport.width ||
          bounds.y < 0 ||
          bounds.y + bounds.height > viewport.height
        )
          throw new Error("耐性が画面外へ出る")
        // HPのゲージは出さないので、上に並ぶ状態の札と重ならないことを確かめる
        const readable = await label.evaluate((element) => {
          // 札は傾いているので、傾ける前の並び（offsetTop）で比べる
          const statuses = element.parentElement!.querySelector<HTMLElement>(
            "[data-foe-statuses]"
          )
          return (
            Number.parseFloat(getComputedStyle(element).fontSize) >= 10 &&
            (!statuses ||
              statuses.offsetTop + statuses.offsetHeight <=
                (element as HTMLElement).offsetTop)
          )
        })
        if (!readable) throw new Error("耐性が小さいか状態の札と重なる")
      }
      await assertFoeHpHidden(
        page,
        expected.foes.map((foe) => foe.name)
      )
      await page.screenshot({
        path: `/tmp/dnd-foe-resistances-${viewport.name}-${scene}.png`,
      })
      if (
        (await page.evaluate(() =>
          JSON.stringify((window.__devStudio as StudioRuntime).game!.save())
        )) !== expected.save
      )
        throw new Error("耐性の閲覧で保存が変わる")
      console.log(`${viewport.name}/${scene}: 敵の耐性・数値・表示・保存保持`)
      await page.close()
    }
  }
  if (errors.length) throw new Error(errors.join("\n"))
} finally {
  await browser.close()
}
