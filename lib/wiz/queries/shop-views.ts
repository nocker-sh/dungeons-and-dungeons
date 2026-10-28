import type { GameCatalog } from "@/lib/wiz/content/game-catalog"
import { Bag } from "@/lib/wiz/rules/bag"
import type { GameState } from "@/lib/wiz/state/state-schema"
import type { GoodViews } from "@/lib/wiz/queries/good-views"
import { memberName } from "@/lib/wiz/queries/member-name"

/** 店と宿の見え方。買えるか・泊まれるかを添える。 */
export class ShopViews {
  constructor(
    private readonly catalog: GameCatalog,
    private readonly goods: GoodViews
  ) {}

  shop(state: GameState, shopId: string) {
    const shop = this.catalog.shop(shopId)
    if (!shop) return null
    const pool = this.catalog.appraisalPool(shopId, state.reached)
    return {
      appraise: pool.length > 0,
      /** 現在の通常鑑定で出る、購入・生産できない防具。 */
      appraisalArmor: pool.flatMap((id) => {
        const good = this.catalog.good(id)
        if (
          good?.kind !== "armor" ||
          this.catalog.data.shops.some((entry) => entry.goods.includes(id)) ||
          this.catalog.data.smithy?.recipes.some((entry) => entry.good === id)
        )
          return []
        return [
          this.goods.entry(good, {
            own: state.gear.filter((entry) => entry.good === id).length,
          }),
        ]
      }),
      /** 光るガラクタ（武器だけ）を鑑定できるか。 */
      appraiseRare:
        !!this.catalog.data.rareJunk &&
        pool.some((id) => this.catalog.good(id)?.kind === "weapon"),
      // 深い層で並ぶ品物は、その層まで届いてから出す
      goods: shop.goods
        .filter((id) => (this.catalog.good(id)?.unlock ?? 0) <= state.reached)
        .map((id) => {
          const good = this.catalog.good(id)!
          const own = good.stones
            ? state.stones
            : good.kind === "weapon" || good.kind === "armor"
              ? state.gear.filter(
                  (gear) => !gear.unidentified && gear.good === id
                ).length
              : Bag.count(state.bag, id)
          return this.goods.entry(good, {
            key: id,
            price: good.price!,
            own,
            affordable: state.gold >= good.price!,
            appraisalAvailable: pool.includes(id),
            equipMembers:
              good.kind === "weapon" || good.kind === "armor"
                ? state.party.flatMap((id) => {
                    if (
                      this.catalog.isSlotFixed(id, good.kind) ||
                      !this.catalog.canEquip(id, good.id)
                    )
                      return []
                    return [{ id, name: memberName(this.catalog, state, id) }]
                  })
                : null,
          })
        }),
    }
  }

  /** 鑑定で出た品が、到達した層より一つ先の段（掘り出し物）か。 */
  bargain(state: GameState, goodId: string) {
    return this.catalog.appraisalTier(goodId) > state.reached
  }

  rooms(state: GameState) {
    return this.catalog.data.rooms.map((room) => ({
      ...room,
      affordable: state.gold >= room.price,
      missingGold: Math.max(0, room.price - state.gold),
    }))
  }
}
