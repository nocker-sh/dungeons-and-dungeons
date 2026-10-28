import type { GameCatalog } from "@/lib/wiz/content/game-catalog"
import type { GameState } from "@/lib/wiz/state/state-schema"

/**
 * 仲間との親しさ（`like`）。一緒に出撃する・宿に泊まる・夜の雑談で少しずつ上がる。
 * 戦闘能力を増減させず、会話の解放と関係の表示に使う。
 */
export class MemberBonds {
  /** 会話を解放する段の目安。台本の `minimumBond` に使う。 */
  static readonly steps = [4, 10, 18] as const

  count(state: GameState, member: string) {
    return state.members.find((entry) => entry.id === member)?.like ?? 0
  }

  view(state: GameState, member: string) {
    const count = this.count(state, member)
    const [near, close, dear] = MemberBonds.steps
    const label =
      count >= dear
        ? "大切な仲間"
        : count >= close
          ? "気の置けない仲"
          : count >= near
            ? "話せる仲"
            : "仕事仲間"
    return { count, label }
  }

  /** 出撃の3人（主人公を除く）の親しさを上げる。 */
  static raise(state: GameState, catalog: GameCatalog, amount = 1) {
    return state.members.map((member) =>
      state.party.includes(member.id) && !catalog.member(member.id)?.hero
        ? { ...member, like: member.like + amount }
        : member
    )
  }
}
