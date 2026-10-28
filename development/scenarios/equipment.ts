import { GameCommandError } from "@/lib/wiz/game/game-command-error"
import { inPhase } from "@/lib/wiz/phases/in-phase"
import type { Game } from "@/lib/wiz/game/game"
import type { PreviewStart } from "@/client/dev/preview-start"
import type { PreviewContext } from "@/development/scenarios/context"
export function createEquipmentScenarios(context: PreviewContext) {
  const { content, play, prepared } = context
  /** ガラクタを鑑定して、R と SR の武器を持った状態（掘り出し物の見た目の確認用）。 */
  function rareWeapons(): Game {
    const shop = content.shops.find((entry) =>
      entry.appraise?.some(
        (id) => content.goods.find((good) => good.id === id)?.kind === "weapon"
      )
    )
    if (!shop) throw new Error("武器を鑑定できる店がない")
    for (let seed = 1; seed < 900; seed++) {
      const game = play(seed)
      // 鑑定の展示用の初期所持品。ゲームの鑑定規則・抽選は変えない。
      const saved = game.save()
      const save = {
        ...saved,
        snapshot: {
          ...saved.snapshot,
          bag: [
            ...saved.snapshot.bag.filter(
              (entry) => entry.good !== content.junk
            ),
            { good: content.junk, count: 12 },
          ],
        },
      }
      const failed = game.restore(save)
      if (failed) throw failed
      for (let times = 0; times < 12; times++)
        inPhase(game, "town")?.appraise(shop.id)
      const rarities = new Set(
        game.queries.gear(game.state).map((entry) => entry.rarity)
      )
      if (rarities.has("R") && rarities.has("SR")) return game
    }
    throw new Error("掘り出し物の武器を作れない")
  }

  /** ガラクタを8個持って街にいる状態（鑑定の結果の札・まとめて鑑定の確認用）。 */
  function withJunk(seed = 1, reached?: number): Game {
    const game = play(seed)
    // 鑑定の展示用の初期所持品。ゲームの鑑定規則・抽選は変えない。
    const saved = game.save()
    const failed = game.restore({
      ...saved,
      snapshot: {
        ...saved.snapshot,
        reached: reached ?? saved.snapshot.reached,
        bag: [
          ...saved.snapshot.bag.filter((entry) => entry.good !== content.junk),
          { good: content.junk, count: 8 },
        ],
      },
    })
    if (failed) throw failed
    return game
  }

  /** 実際の鑑定で防具が出る種を探し、鑑定する前の状態を展示する。 */
  function armorJunk(shop: string): Game {
    for (let seed = 1; seed <= 200; seed++) {
      const game = withJunk(seed)
      const before = new Set(game.state.gear.map((entry) => entry.id))
      inPhase(game, "town")?.appraise(shop)
      if (
        game.queries
          .gear(game.state)
          .some((entry) => !before.has(entry.gear) && entry.kind === "armor")
      )
        return withJunk(seed)
    }
    throw new Error("防具が出る鑑定の場面を作れない")
  }

  /** ユニークの仲間を雇い、素材の武器を持った状態（鍛冶屋の「鍛え直し」の確認用）。 */
  function uniqueTown(): Game {
    const recruit = content.recruits.find((entry) => entry.member.unique)
    if (!recruit) throw new Error("ユニークの募集がない")
    const shop = content.shops.find((entry) =>
      entry.goods.some(
        (id) => content.goods.find((good) => good.id === id)?.kind === "weapon"
      )
    )
    if (!shop) throw new Error("武器を売る店がない")
    const game = play(1)
    const saved = game.save()
    const failed = game.restore({
      ...saved,
      // 展示用の所持金と募集の枠。契約・鍛え直しの規則は本番のまま
      snapshot: { ...saved.snapshot, gold: 2000, board: [recruit.id] },
    })
    if (failed) throw failed
    const hired = inPhase(game, "town")?.recruit(recruit.id)
    if (!hired || hired instanceof GameCommandError)
      throw new Error("ユニークの仲間を雇えない")
    inPhase(game, "town")?.swap(
      game.state.party.find((id) => id !== recruit.member.id)!,
      recruit.member.id
    )
    // 素材にする武器を何本か買っておく
    const weapons = shop.goods.filter(
      (id) => content.goods.find((good) => good.id === id)?.kind === "weapon"
    )
    for (const id of weapons.slice(0, 3))
      inPhase(game, "town")?.buy(shop.id, id)
    return game
  }

  /** 着替えの実操作用。購入と装備候補は本番の規則を通す。 */
  function outfitStand(): PreviewStart {
    const game = play(1)
    const saved = game.save()
    const failed = game.restore({
      ...saved,
      snapshot: { ...saved.snapshot, gold: 4000 },
    })
    if (failed) throw failed
    for (const shop of content.shops) {
      for (const goodId of shop.goods) {
        const good = content.goods.find((entry) => entry.id === goodId)
        if (good?.kind !== "armor" || (good.unlock ?? 0) > game.state.reached)
          continue
        const bought = inPhase(game, "town")?.buy(shop.id, goodId)
        if (!bought || bought instanceof GameCommandError)
          throw new Error("着替え用の防具を買えない")
      }
    }
    const member =
      game.queries.party(game.state).find((entry) => entry.job === "戦士") ??
      game.queries.party(game.state)[0]
    return prepared(
      game,
      { name: "town" },
      { kind: "stand", member: member.id }
    )
  }
  return { rareWeapons, withJunk, armorJunk, uniqueTown, outfitStand }
}
