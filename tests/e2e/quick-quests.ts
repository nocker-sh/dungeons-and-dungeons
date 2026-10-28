import { BASE_URL } from "@/tests/e2e/lib"
import { FIRE, fire } from "@/tests/e2e/fire"
import { launch } from "@/tests/e2e/launch"
import { openPage } from "@/tests/e2e/open-page"
import { frameUrl } from "@/development/studio/frame-url"
import { parseStudioConfig } from "@/development/studio/parse-studio-config"
import type { StudioRuntime } from "@/client/dev/studio-runtime"
import effects from "@/concept/data/effects.json"
import world from "@/concept/data/world.json"
import { contentSource } from "@/content/game-content"

const browser = await launch()
const errors: string[] = []
try {
  for (const width of [320, 390, 1280].filter(
    (value) => !process.argv[3] || value === Number(process.argv[3])
  )) {
    for (const quest of contentSource.quests.filter(
      (entry) =>
        entry.encounter && (!process.argv[2] || entry.slug === process.argv[2])
    )) {
      const page = await openPage(browser, { width, height: 844 }, errors)
      // 編集中のHMRで操作中の戦闘を再起動しない。ページは最新のモジュールを読み込む。
      await page.routeWebSocket("**/*", () => {})
      await page.goto(
        BASE_URL +
          frameUrl(
            parseStudioConfig({
              scene: "quick-quests",
              width,
              height: 844,
              duration: 60000,
            })
          )
      )
      await page.waitForFunction(
        () => window.__devStudio?.ready || window.__devStudioError
      )
      await page.evaluate(() => {
        if (window.__devStudioError) throw new Error(window.__devStudioError)
      })
      // 実時間の画像デコードを待ってから仮想時計を進める。戦闘の演出は早送りで検査する。
      await page.evaluate(
        async (paths) => {
          const modulePath = "/client/game/artwork.ts"
          const { loadArtwork } = await import(modulePath)
          await loadArtwork(paths)
        },
        effects.map((effect) => effect.image)
      )
      const before = await page.evaluate(
        async (weapons) => {
          const runtime = window.__devStudio as StudioRuntime
          await runtime.advance(2500)
          const save = JSON.parse(JSON.stringify(runtime.game!.save()))
          save.snapshot.reached = 4
          save.snapshot.gold = 100000
          save.snapshot.members = save.snapshot.members.map(
            (member: { stats: object }) => ({
              ...member,
              hp: 2000,
              stats: { ...member.stats, maxHp: 2000, str: 1000, tec: 1000 },
            })
          )
          const error = runtime.game!.restore(save)
          if (error) throw error
          const game = runtime.game!
          for (const id of game.state.party) {
            const member = game.queries.member(game.state, id)!
            if (member.unique) continue
            const weapon = weapons
              .filter((entry) => entry.type === member.favorite && entry.shop)
              .sort((first, second) => second.power - first.power)[0]
            if (!weapon) throw new Error("確認用の店装備がない")
            if (
              !Array.isArray(
                game.send({ type: "buy", shop: weapon.shop!, good: weapon.id })
              )
            )
              throw new Error("確認用の店装備を買えない")
            const gear = game.state.gear.at(-1)!
            if (
              !Array.isArray(
                game.send({ type: "equip", member: id, gear: gear.id })
              )
            )
              throw new Error("確認用の店装備を着けられない")
          }
          await runtime.advance(3500)
          return {
            gold: runtime.game!.state.gold,
            lastLayer: runtime.game!.state.lastLayer,
            reached: runtime.game!.state.reached,
            cleared: runtime.game!.state.cleared,
          }
        },
        contentSource.goods
          .filter((entry) => entry.kind === "weapon")
          .map((entry) => ({
            id: entry.id,
            type: entry.weaponType,
            power: entry.power ?? 0,
            shop: contentSource.shops.find((shop) =>
              shop.goods.includes(entry.id)
            )?.id,
          }))
      )
      // 依頼は戦う場所で「街なか」「街の外」のタブに分かれる。依頼が載っている方を開く
      for (const [tab, at] of [
        ["街なか", 4000],
        ["街の外", 4500],
      ] as const) {
        await page.getByRole("button", { name: tab, exact: true }).click()
        await page.evaluate(
          (at) => (window.__devStudio as StudioRuntime).advance(at),
          at
        )
        if (
          await page
            .getByRole("button", { name: new RegExp(quest.name) })
            .count()
        )
          break
      }
      await page.getByRole("button", { name: new RegExp(quest.name) }).click()
      await page.evaluate(() =>
        (window.__devStudio as StudioRuntime).advance(5500)
      )
      await page.getByRole("button", { name: "戦う", exact: true }).click()
      await page.evaluate(() =>
        (window.__devStudio as StudioRuntime).advance(7000)
      )
      await page.waitForFunction(
        () =>
          (window.__devStudio as StudioRuntime).game!.state.phase.type ===
          "battle"
      )
      await page.evaluate(() =>
        (window.__devStudio as StudioRuntime).advance(9000)
      )
      if (await page.getByRole("button", { name: /進む|カチコミ/ }).count())
        throw new Error("探索の操作が出ている")
      if (quest.encounter!.place === "farm") {
        const farm = world.find((entry) => entry.slug === "place-farm")!
        const loaded = await page.evaluate(
          (file) =>
            [...document.images].some(
              (image) =>
                image.src.endsWith(file) &&
                image.complete &&
                image.naturalWidth > 0
            ),
          // 戦闘中は戦闘用の背景（なければ場所の絵）
          width === 1280
            ? (farm.battleWideImage ?? farm.wideImage)!
            : (farm.battleImage ?? farm.image)!
        )
        if (!loaded) throw new Error("農場の背景が未読込")
      }
      await page.screenshot({
        path: `/tmp/dnd-quick-${width}-${quest.slug}-battle.png`,
      })
      for (let time = 10500; time <= 58500; time += 1500) {
        const fighting = await page.evaluate(
          () =>
            (window.__devStudio as StudioRuntime).game!.state.phase.type ===
            "battle"
        )
        if (!fighting) {
          await page.evaluate(
            (at) => (window.__devStudio as StudioRuntime).advance(at),
            Math.min(time + 3000, 60000)
          )
          break
        }
        // 「殴る」は使える手が尽きたときだけ出る。ほかはワザを選んだまま狙っている敵を押して放つ
        const brawl = page.getByRole("button", { name: /^殴る/ })
        if ((await brawl.count()) && (await brawl.isEnabled())) {
          const box = await brawl.boundingBox()
          if (
            box &&
            box.x + box.width / 2 >= 0 &&
            box.y + box.height / 2 >= 0 &&
            box.x + box.width / 2 <= width &&
            box.y + box.height / 2 <= 844
          )
            await brawl.click()
        } else if (await page.locator(FIRE).count()) await fire(page, 0)
        await page.evaluate(
          (at) => (window.__devStudio as StudioRuntime).advance(at),
          time
        )
      }
      const after = await page.evaluate((id) => {
        const runtime = window.__devStudio as StudioRuntime
        return {
          phase: runtime.game!.state.phase.type,
          gold: runtime.game!.state.gold,
          quest: runtime.game!.state.quests.find((entry) => entry.id === id),
          reached: runtime.game!.state.reached,
          lastLayer: runtime.game!.state.lastLayer,
          cleared: runtime.game!.state.cleared,
          errors: runtime.errors,
        }
      }, quest.id)
      if (after.phase !== "town") {
        await page.screenshot({
          path: `/tmp/dnd-quick-${width}-${quest.slug}-failure.png`,
        })
        console.log(errors)
        console.log(await page.getByRole("button").allTextContents())
        console.log(
          await page.evaluate(() =>
            (window.__devStudio as StudioRuntime).game!.queries.battle(
              (window.__devStudio as StudioRuntime).game!.state
            )
          )
        )
      }
      if (
        after.phase !== "town" ||
        !after.quest?.claimed ||
        after.gold < before.gold + quest.reward.gold
      )
        throw new Error(`自動精算が違う: ${JSON.stringify(after)}`)
      if (
        after.reached !== before.reached ||
        after.lastLayer !== before.lastLayer ||
        after.cleared !== before.cleared ||
        after.errors.length
      )
        throw new Error("探索進行または演出が壊れた")
      await page
        .getByRole("status")
        .filter({ hasText: `${quest.name}を達成` })
        .waitFor({ state: "visible" })
      await page.screenshot({
        path: `/tmp/dnd-quick-${width}-${quest.slug}-result.png`,
      })
      console.log(
        `PASS ${width} ${quest.slug}: 実UIで開始・戦闘・自動報酬・街へ復帰・探索進行保持`
      )
      await page.close()
    }
  }
  if (errors.length) throw new Error(errors.join("\n"))
} finally {
  await browser.close()
}
