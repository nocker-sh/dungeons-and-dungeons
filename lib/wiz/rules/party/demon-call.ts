import type { GameCatalog } from "@/lib/wiz/content/game-catalog"
import type { GameState, Member } from "@/lib/wiz/state/state-schema"

type Attack = (
  member: Member,
  state: Pick<GameState, "gear" | "demons" | "contract">
) => number

/**
 * 戦闘で呼ぶ悪魔の必殺技。プレイヤー（戦わない運営役）が、契約した悪魔を1戦闘に1回だけ呼ぶ。
 * 悪魔の最初の攻撃のワザを、敵全員へ放つ。強さは隊列でいちばん高い攻撃力から決まり、仲間の育ちに合わせて上がる。
 */
export class DemonCall {
  constructor(
    private readonly catalog: GameCatalog,
    private readonly attackOf: Attack
  ) {}

  /** 悪魔が呼ばれたときに放つワザ（攻撃のワザがなければ null）。 */
  skillOf(demonId: string) {
    const demon = this.catalog.demon(demonId)
    const skill = demon?.skills
      .map((id) => this.catalog.skill(id))
      .find((entry) => entry?.kind === "hit")
    return skill
      ? { id: skill.id, name: skill.name, power: skill.power ?? 1 }
      : null
  }

  /** 必殺技の威力（ワザの威力 × 倍率）。 */
  power(demonId: string) {
    const skill = this.skillOf(demonId)
    return skill ? skill.power * this.catalog.data.balance.demonCall.power : 0
  }

  /** 必殺技の元にする攻撃力。出撃中で戦える仲間のうち、いちばん高い攻撃力。 */
  attack(state: GameState) {
    let best = 0
    for (const member of state.members)
      if (state.party.includes(member.id) && member.hp > 0)
        best = Math.max(best, this.attackOf(member, state))
    return best
  }
}
