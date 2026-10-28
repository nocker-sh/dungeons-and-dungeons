import type { GameCatalog } from "@/lib/wiz/content/game-catalog"
import type { GameState, Stack } from "@/lib/wiz/state/state-schema"
import { Bag } from "./bag"
import type { PartyRules } from "./party-rules"
import { ExplorationRules } from "@/lib/wiz/rules/exploration-rules"

/** 選ぶ前に見せる代償と、実際に支払える条件を共通にする。 */
export class DiscoveryRules {
  /** 代償を払った後の回復と被害。予告と実行で上限・丸め・HP1の下限を揃える。 */
  static healthChange(
    hp: number,
    maximum: number,
    choice: { healRatio?: number; damageRatio?: number }
  ) {
    const healed = Math.min(
      maximum - hp,
      Math.floor(maximum * (choice.healRatio ?? 0))
    )
    const hurt = Math.min(
      hp + healed - 1,
      Math.floor(maximum * (choice.damageRatio ?? 0))
    )
    return { after: hp + healed - hurt, healed, hurt }
  }

  /** 表示文の元の金額を、同じ支払い規則で計算した金額に合わせる。 */
  static priceText(
    text: string,
    originalCost: number | undefined,
    cost: number
  ) {
    return originalCost
      ? text
          .replaceAll(`${originalCost}G`, `${cost}G`)
          .replaceAll(`金貨${originalCost}`, `金貨${cost}`)
      : text
  }

  constructor(
    private readonly catalog: GameCatalog,
    private readonly party: PartyRules
  ) {}

  description(
    state: GameState,
    choice: { description: string; cost?: number; refill?: number },
    cost: number
  ) {
    const text = DiscoveryRules.priceText(choice.description, choice.cost, cost)
    return choice.refill
      ? text.replaceAll(
          `${choice.refill}回`,
          `${new ExplorationRules(this.catalog).refill(state, choice.refill)}回`
        )
      : text
  }

  offer(
    state: GameState,
    choice: {
      cost?: number
      healthCostRatio?: number
      healRatio?: number
      damageRatio?: number
      costGoods?: readonly Stack[]
    }
  ) {
    const cost = new ExplorationRules(this.catalog).cost(
      state,
      choice.cost ?? 0
    )
    const materials = (choice.costGoods ?? []).map((entry) => ({
      ...entry,
      name: this.catalog.good(entry.good)!.name,
      owned: Bag.count(state.bag, entry.good),
    }))
    const payment = state.members
      .filter((member) => state.party.includes(member.id) && member.hp > 0)
      .map((member) => {
        const definition = this.catalog.member(member.id)!
        const cost = choice.healthCostRatio
          ? Math.ceil(
              this.party.stats(member, state).maxHp * choice.healthCostRatio
            )
          : 0
        return {
          id: member.id,
          name: definition.hero ? state.hero.name : definition.name,
          before: member.hp,
          after: member.hp - cost,
          cost,
        }
      })
      .filter((member) => member.cost > 0)
    const reason =
      state.gold < cost
        ? "金貨が足りない"
        : !Bag.pay(state.bag, choice.costGoods ?? [])
          ? "交換する品物が足りない"
          : choice.healthCostRatio && !payment.length
            ? "HPを捧げられる仲間がいない"
            : payment.some((member) => member.after <= 0)
              ? "代償を払うと倒れる仲間がいる"
              : null
    const healthChanges =
      choice.healRatio || choice.damageRatio
        ? state.members
            .filter(
              (member) => state.party.includes(member.id) && member.hp > 0
            )
            .map((member) => {
              const maximum = this.party.stats(member, state).maxHp
              const paidHp =
                payment.find((entry) => entry.id === member.id)?.after ??
                member.hp
              const health = DiscoveryRules.healthChange(
                paidHp,
                maximum,
                choice
              )
              const definition = this.catalog.member(member.id)!
              return {
                id: member.id,
                name: definition.hero ? state.hero.name : definition.name,
                before: member.hp,
                after: health.after,
              }
            })
        : []
    return {
      available: reason === null,
      reason,
      payment,
      healthChanges,
      materials,
      cost,
    }
  }
}
