import type { GameCatalog } from "@/lib/wiz/content/game-catalog"
import type { Reach, Row } from "@/lib/wiz/content/constants"
import type {
  ActorRef,
  Battle,
  GameState,
  Member,
} from "@/lib/wiz/state/state-schema"
import { pick } from "@/lib/wiz/rules/pick"
import { pickWeighted } from "@/lib/wiz/rules/pick-weighted"
import type { Random } from "@/lib/wiz/rules/random"
import { PartyRules } from "@/lib/wiz/rules/party-rules"

/** 戦闘の計算。行動順・被害・敵の狙い。 */
export class BattleRules {
  constructor(
    private readonly catalog: GameCatalog,
    private readonly party: PartyRules
  ) {}

  /** 速さの順。同じ速さなら味方が先、並びの順。 */
  order(
    state: Pick<
      GameState,
      "members" | "party" | "gear" | "demons" | "contract"
    >,
    foes: Battle["foes"]
  ): ActorRef[] {
    const entries = [
      ...state.party.map((memberId, index) => {
        const member = state.members.find((entry) => entry.id === memberId)
        return {
          ref: { kind: "member" as const, id: memberId },
          spd: member ? this.party.stats(member, state).spd : 0,
          rank: index,
        }
      }),
      ...foes.map((foe, index) => ({
        ref: { kind: "foe" as const, id: foe.id },
        spd: this.catalog.foe(foe.foe)?.spd ?? 0,
        rank: 10 + index,
      })),
    ]
    return entries
      .toSorted((a, b) => b.spd - a.spd || a.rank - b.rank)
      .map((entry) => entry.ref)
  }

  /** 被害 = 攻撃力 × 威力 × 振れ幅。防御値はない。 */
  damage(attack: number, power: number, random: Random) {
    const { swing } = this.catalog.data.balance.damage
    const roll = swing[0] + random() * (swing[1] - swing[0])
    return Math.max(1, Math.round(attack * power * roll))
  }

  /**
   * 受けた被害を防具の耐久とHPへ振り分ける。防具の耐久から先に減り、余りがHPへ届く。
   * 防御・守りの加護・後衛の倍率は、振り分ける前に済ませておく。
   */
  static split(amount: number, durability: number) {
    const armor = Math.max(0, Math.min(amount, durability))
    return { armor, hp: amount - armor }
  }

  heal(atk: number, power: number, random: Random) {
    const { base, swing } = this.catalog.data.balance.heal
    const roll = swing[0] + random() * (swing[1] - swing[0])
    return Math.max(1, Math.round((base + atk) * power * roll))
  }

  /** 毒で一度に失うHP。 */
  poison(maxHp: number) {
    return Math.max(
      1,
      Math.floor(maxHp / this.catalog.data.balance.poisonDivisor)
    )
  }

  /** 再生（植物の流派）で一度に戻すHP。 */
  regen(maxHp: number) {
    return Math.max(
      1,
      Math.floor(maxHp / this.catalog.data.balance.regenDivisor)
    )
  }

  /**
   * 敵の狙い。挑発している仲間がいればその中から。近接は前衛だけに届き、前衛が全員倒れたら後衛へ。
   * 遠距離は後衛にも届く（当たるかは hits）。前衛のタンクは balance.tankTarget の重みで狙われやすい。
   * members は出撃の並び順。
   */
  target(
    members: readonly Member[],
    random: Random,
    reach: Reach = "melee"
  ): Member | null {
    const taunters = members.filter(
      (member) =>
        member.hp > 0 && member.status.some((status) => status.kind === "taunt")
    )
    if (taunters.length) return pick(random, taunters)
    const pool = this.reachable(members, reach)
    if (!pool.length) return null
    const tank = this.catalog.data.balance.tankTarget
    return pickWeighted(random, pool, (entry) =>
      entry.front && this.party.equipment.rolesOf(entry.member).includes("tank")
        ? tank
        : 1
    ).member
  }

  /** 敵の攻撃が届く仲間。近接は前衛だけ（前衛が全員倒れたら後衛）、遠距離は全員。 */
  reachable(members: readonly Member[], reach: Reach) {
    const alive = members
      .map((member, index) => ({
        member,
        front: index < PartyRules.FRONT_SLOTS,
      }))
      .filter((entry) => entry.member.hp > 0)
    const front = alive.filter((entry) => entry.front)
    return reach === "melee" && front.length ? front : alive
  }

  /** 敵の遠距離の攻撃が当たるか。後衛は balance.backRow.hit の確率で当たる。前衛と近接は必ず当たる。 */
  hits(row: Row | null, reach: Reach, random: Random) {
    if (row !== "back" || reach !== "ranged") return true
    return random() < this.catalog.data.balance.backRow.hit
  }
}
