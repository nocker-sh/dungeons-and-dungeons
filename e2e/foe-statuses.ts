import foes from "../src/lib/content/data/foes.json"
import { BASE_URL, assertFoeHpHidden, launch, openPage } from "./lib"
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
    for (const scene of ["boss-resistance"]) {
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
          await runtime.advance(9000)
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
              status: [
                { kind: "poison", turns: 3 },
                { kind: "bind", turns: 2 },
                { kind: "regen", turns: 4 },
                { kind: "taunt", turns: 2 },
                { kind: "charge", turns: 1 },
                { kind: "protect", turns: 1 },
              ],
            }
            delete boss.appearanceId
            const order = battle.order.filter(
              (ref) => ref.kind === "member" || ref.id === first.id
            )
            const problem = game.restore({
              ...saved,
              snapshot: {
                ...saved.snapshot,
                phase: {
                  ...saved.snapshot.phase,
                  battle: {
                    ...battle,
                    foes: [boss],
                    order,
                    // 状態の札を見る間にボスが動いて手番が減らないよう、仲間の手番から始める
                    turn: order.findIndex((ref) => ref.kind === "member"),
                  },
                },
              },
            })
            if (problem) throw problem
          }
          await runtime.advance(9001)
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
      // 敵の名前は出さないので、札の一番上に来る状態が上部の見出しに重ならないこと
      await assertFoeHpHidden(
        page,
        expected.foes.map((foe) => foe.name)
      )
      const plateTop = await page
        .locator("[data-foe-statuses]")
        .evaluate((element) => element.getBoundingClientRect().top)
      if (plateTop < 56)
        throw new Error(
          `敵の札が上部の見出しに重なる: ${viewport.name} ${plateTop}`
        )
      const statuses = page.locator("[data-foe-statuses] i")
      const labels = [
        "毒3手番",
        "縛り2手番",
        "再生4手番",
        "挑発2手番",
        "溜め",
        "守り",
      ]
      if ((await statuses.count()) !== labels.length)
        throw new Error(
          `状態の札が足りない: ${await statuses.count()} / ${JSON.stringify(expected.foes.map((foe) => foe.status))}`
        )
      for (let index = 0; index < labels.length; index++) {
        const chip = statuses.nth(index)
        if ((await chip.innerText()).replace(/\s/g, "") !== labels[index])
          throw new Error("残り手番の案内が違う")
        const bounds = await chip.boundingBox()
        if (
          !bounds ||
          bounds.x < 0 ||
          bounds.x + bounds.width > viewport.width ||
          bounds.y < 0
        )
          throw new Error("状態が画面外")
        if (
          !(await chip
            .locator("b")
            .evaluate(
              (element) => parseFloat(getComputedStyle(element).fontSize) >= 10
            ))
        )
          throw new Error("状態の文字が小さい")
        const title = await chip.getAttribute("title")
        if (index >= 4 && !title?.includes("使うまで有効"))
          throw new Error("使うまで残る状態を誤表示")
      }
      if (
        !(await page.locator("[data-foe-statuses]").evaluate((element) => {
          const statuses = element as HTMLElement
          const resistances =
            statuses.parentElement!.querySelector<HTMLElement>(
              "[data-foe-resistances]"
            )
          return (
            !resistances ||
            statuses.offsetTop + statuses.offsetHeight <= resistances.offsetTop
          )
        }))
      )
        throw new Error("状態が耐性の札と重なる")
      await page.screenshot({
        path: `/tmp/dnd-foe-statuses-${viewport.name}.png`,
      })
      if (
        (await page.evaluate(() =>
          JSON.stringify((window.__devStudio as StudioRuntime).game!.save())
        )) !== expected.save
      )
        throw new Error("耐性の閲覧で保存が変わる")
      console.log(`${viewport.name}/${scene}: 6状態の名前・残り手番・保存保持`)
      await page.close()
    }
  }
  if (errors.length) throw new Error(errors.join("\n"))
} finally {
  await browser.close()
}
