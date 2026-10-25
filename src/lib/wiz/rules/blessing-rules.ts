import type { GameState } from "@/lib/wiz/state"

export class BlessingRules {
  static clear(state: Pick<GameState, "members">) {
    return state.members.map((member) => {
      if (!member.blessing) return member
      const { blessing, ...rest } = member
      return {
        ...rest,
        used: member.used.filter((entry) => entry.skill !== blessing),
      }
    })
  }
}
