import type { GameCatalog } from "@/lib/wiz/content/game-catalog"
import type { MemberDef } from "@/lib/wiz/content/content-schema"
import type { GameState } from "@/lib/wiz/state/state-schema"

/** 生きている出撃メンバーの探索能力を、一種類につき一度だけ適用する。 */
export class ExplorationRules {
  static readonly surveyLimit = 1

  constructor(private readonly catalog: GameCatalog) {}

  has(state: GameState, ability: MemberDef["exploration"]) {
    return state.members.some(
      (member) =>
        state.party.includes(member.id) &&
        member.hp > 0 &&
        this.catalog.member(member.id)?.exploration === ability
    )
  }

  cost(state: GameState, gold: number) {
    return this.has(state, "bargain")
      ? Math.ceil(
          gold * (1 - (this.catalog.data.balance.exploration?.discount ?? 0.15))
        )
      : gold
  }

  trap(state: GameState, damage: number) {
    return this.has(state, "trapper")
      ? Math.ceil(
          damage *
            (1 - (this.catalog.data.balance.exploration?.trapReduction ?? 0.25))
        )
      : damage
  }

  gold(state: GameState, gold: number) {
    return this.has(state, "hunter")
      ? Math.floor(
          gold * (1 + (this.catalog.data.balance.exploration?.lootGold ?? 0.1))
        )
      : gold
  }

  refill(state: GameState, uses: number) {
    return uses > 0 && this.has(state, "camp")
      ? uses + (this.catalog.data.balance.exploration?.campRefill ?? 1)
      : uses
  }

  description(ability: MemberDef["exploration"]) {
    const settings = this.catalog.data.balance.exploration
    if (ability === "scout")
      return `察知：出撃中${ExplorationRules.surveyLimit}回まで、隣の未知の道の正体を見抜く`
    if (ability === "bargain")
      return `交渉：探索中の金貨の支払いを${Math.round((settings?.discount ?? 0.15) * 100)}％軽減`
    if (ability === "trapper")
      return `罠対策：探索の罠の被害を${Math.round((settings?.trapReduction ?? 0.25) * 100)}％軽減`
    if (ability === "camp")
      return `野営：休息で各人のワザを追加で${settings?.campRefill ?? 1}回戻す`
    if (ability === "hunter")
      return `目利き：探索の宝箱で得る金貨が${Math.round((settings?.lootGold ?? 0.1) * 100)}％増える`
    return "召喚した悪魔のワザで編成を補う"
  }
}
