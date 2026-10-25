import type { GameAction } from "@/lib/wiz"
import type { SeededRandom } from "../random"
import type { Session } from "../session"
import { bestPotion } from "./healing"

/** 探索の進め方。 */
export type ExpeditionPlan = {
  /** 全員のHPの合計がこの割合を下回ったら撤退。push なら撤退しない。 */
  retreatBelow: number
  /** ボスの手前でこの割合を下回っていたら撤退。 */
  bossReady: number
  push: boolean
  /** 戦闘の外で回復薬を使う。 */
  heal: boolean
  /** ボスの手前で必ず引き返す（育つまで挑まない）。 */
  avoidBoss?: boolean
  /** この深さ（地点の x）まで進んだら引き返す。進むほど得かを測るための方針。 */
  stopAt?: number
}

export const DEFAULT_PLAN: ExpeditionPlan = {
  retreatBelow: 0.35,
  bossReady: 0.7,
  push: false,
  heal: true,
}

export const PUSH_PLAN: ExpeditionPlan = {
  retreatBelow: 0,
  bossReady: 0,
  push: true,
  heal: true,
}

/** 探索中（戦闘の外）に送る操作。 */
export function expeditionAction(
  session: Session,
  plan: ExpeditionPlan,
  random: SeededRandom
): GameAction {
  const { state, queries } = session
  const expedition = queries.expedition(state)
  const route = queries.route(state)
  if (!expedition || !route) throw new Error("探索中ではない")
  if (expedition.pending?.kind === "discovery" && route.discovery) {
    const hurt = queries
      .party(state)
      .some((member) => member.hp > 0 && member.hp / member.maxHp < 0.75)
    const choices = route.discovery.choices.filter((choice) => choice.available)
    const altar = choices.find((choice) => choice.blessings?.length)
    if (
      altar?.blessings &&
      !(hurt && choices.some((choice) => choice.healRatio))
    ) {
      const recipient =
        state.members.find(
          (member) => state.party.includes(member.id) && !member.blessing
        ) ?? state.members.find((member) => member.id === state.party[0])!
      return {
        type: "discover",
        choice: altar.id,
        skill: altar.blessings[0].id,
        member: recipient.id,
      }
    }
    const choice = hurt
      ? (choices.find((choice) => choice.healRatio) ??
        choices.find((choice) => !choice.damageRatio))
      : choices.find(
          (choice) =>
            choice.goods?.length && !choice.cost && !choice.damageRatio
        )
    return { type: "discover", choice: (choice ?? choices[0]).id }
  }
  if (expedition.pending) return { type: "acknowledge" }
  if (expedition.cleared || route.atEnd) return { type: "retreat" }
  // 決めた深さまで来たら引き返す（深さごとの稼ぎを測るため）
  const here = route.stations.find((station) => station.id === route.at)
  if (plan.stopAt !== undefined && (here?.x ?? 0) >= plan.stopAt)
    return { type: "retreat" }
  const party = queries.party(state)
  const alive = party.filter((member) => member.hp > 0)
  if (plan.heal) {
    const hurt = alive
      .filter((member) => member.hp / member.maxHp < 0.5)
      .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0]
    const potion =
      hurt &&
      bestPotion(
        session,
        queries
          .items(state)
          .filter(
            (item) =>
              item.field && queries.good(item.id)?.effect?.type === "heal"
          ),
        hurt.maxHp - hurt.hp
      )
    if (potion && hurt) return { type: "use", good: potion.id, member: hurt.id }
  }
  const ratio =
    party.reduce((sum, member) => sum + member.hp, 0) /
    party.reduce((sum, member) => sum + member.maxHp, 0)
  if (!plan.push) {
    if (ratio < plan.retreatBelow || alive.length < party.length)
      return { type: "retreat" }
    const next = route.stations.filter((station) =>
      route.choices.includes(station.id)
    )
    const bossNext = next.some((station) => station.boss)
    if (bossNext && (plan.avoidBoss || ratio < plan.bossReady))
      return { type: "retreat" }
    // 中ボスの手前でも、消耗していれば引き返す
    if (next.some((station) => station.midboss) && ratio < plan.bossReady)
      return { type: "retreat" }
  }
  const to = route.choices[Math.floor(random.next() * route.choices.length)]
  return { type: "advance", to }
}
