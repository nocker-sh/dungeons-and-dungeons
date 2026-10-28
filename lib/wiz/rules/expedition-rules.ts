import { Bag } from "@/lib/wiz/rules/bag"
import type { EventKind } from "@/lib/wiz/content/constants"
import type { GameCatalog } from "@/lib/wiz/content/game-catalog"
import type { LayerDef, StationDef } from "@/lib/wiz/content/content-schema"
import type { WizDeepReadonly } from "@/lib/wiz/core/immutable-value"
import { between } from "@/lib/wiz/rules/between"
import { pick } from "@/lib/wiz/rules/pick"
import type { Random } from "@/lib/wiz/rules/random"

/** 地点に着いたときの出来事。 */
export class ExpeditionRules {
  constructor(private readonly catalog: GameCatalog) {}

  draw(
    layer: WizDeepReadonly<LayerDef>,
    station: WizDeepReadonly<StationDef>,
    random: Random
  ): EventKind {
    if (station.boss) return "boss"
    if (station.event) return station.event
    const { battle, treasure, trap } = station.weights ?? layer.weights
    const discovery = station.weights?.discovery ?? 0
    const roll = random() * (battle + treasure + trap + discovery)
    if (roll < battle) return "battle"
    if (roll < battle + treasure) return "treasure"
    if (roll < battle + treasure + trap) return "trap"
    return "discovery"
  }

  /** 層の終点を1とした深さの割合（その地点の x ÷ 終点の x）。 */
  depthRatio(
    layer: WizDeepReadonly<LayerDef>,
    station: WizDeepReadonly<StationDef>
  ) {
    let last = 0
    for (const entry of layer.stations) last = Math.max(last, entry.x)
    if (last <= 0) return 0
    return Math.max(0, Math.min(1, station.x / last))
  }

  /** 深さの手当てを掛けた倍率（終点で 1 + rate）。 */
  depthFactor(ratio: number, rate: number) {
    return 1 + ratio * rate
  }

  /** 正体不明の宝箱に潜む敵。固定宝箱は安全なまま。 */
  mimic(
    layer: WizDeepReadonly<LayerDef>,
    station: WizDeepReadonly<StationDef>,
    random: Random
  ): string | null {
    // 正体不明の出来事だけが対象。安全な固定宝箱や確定報酬は守る。
    const mimic = layer.treasure.mimic
    if (station.event || station.rewardGoods?.length || !mimic) return null
    return random() < mimic.chance ? mimic.foe : null
  }

  /** 宝の中身。深い地点ほど金貨が増え、品物の数も増える。 */
  treasure(
    layer: WizDeepReadonly<LayerDef>,
    station: WizDeepReadonly<StationDef>,
    random: Random
  ) {
    const depth = this.catalog.data.balance.depth
    const ratio = this.depthRatio(layer, station)
    const gold = Math.round(
      between(random, layer.treasure.gold[0], layer.treasure.gold[1]) *
        this.depthFactor(ratio, depth.treasure)
    )
    const goods = layer.treasure.goods.length
      ? [pick(random, layer.treasure.goods)]
      : []
    // 深さに応じて品物が増える。端数は確率で1つ足す（浅い地点でもたまに増える）
    const extra = ratio * depth.goods
    const bundle =
      1 + Math.floor(extra) + (random() < extra - Math.floor(extra) ? 1 : 0)
    // 層の奥の宝には、光るガラクタが混ざることがある（進むほど得になる）
    const rareJunk = this.catalog.data.rareJunk
    const shiny =
      rareJunk && ratio >= depth.rareJunkFrom && random() < depth.rareJunkChance
        ? [{ good: rareJunk, count: 1 }]
        : []
    return {
      gold,
      goods: Bag.add(
        Bag.add(
          goods.map((entry) => ({
            good: entry.good,
            count: entry.count * bundle,
          })),
          station.rewardGoods ?? []
        ),
        shiny
      ),
    }
  }

  /** 中ボスを倒してから戻ったときに、持ち帰る金貨へ足す手当て。 */
  retreatBonus(gold: number) {
    return Math.floor(gold * this.catalog.data.balance.depth.retreatBonus)
  }

  trap(layer: WizDeepReadonly<LayerDef>, random: Random) {
    return between(random, layer.trap[0], layer.trap[1])
  }

  /** 出てくる敵の組。 */
  foes(layer: WizDeepReadonly<LayerDef>, random: Random): string[] {
    const [min, max] = layer.group ?? [1, 1]
    const size = between(random, min, max)
    return Array.from({ length: size }, () => pick(random, layer.foes))
  }

  /** 着いた地点を選んだときの疲れと汚れ。 */
  wear() {
    return this.catalog.data.balance.wear
  }

  /** 出撃できない疲れ。 */
  exhausted(fatigue: number) {
    return fatigue >= this.catalog.data.balance.exhaustedAt
  }
}
