import type { GameCatalog } from "@/lib/wiz/content"
import type { GameState } from "@/lib/wiz/state"

/** 異なる会話を重ねた親しさ。同じ台本の連打で増えず、返答の好悪で罰しない。 */
export class DemonBonds {
  constructor(private readonly catalog: GameCatalog) {}
  count(state: GameState, demon: string) {
    const seen = new Set(state.conversation?.seen ?? [])
    return (this.catalog.data.conversations ?? []).filter(
      (entry) =>
        entry.trigger === "talk" &&
        entry.participants.includes(demon) &&
        entry.id !== this.catalog.demon(demon)?.contract?.encounter &&
        seen.has(entry.id)
    ).length
  }
  view(state: GameState, demon: string) {
    const count = this.count(state, demon)
    const label =
      count >= 12
        ? "大切な相棒"
        : count >= 6
          ? "気の合う仲間"
          : count >= 3
            ? "顔なじみ"
            : "これから知り合う"
    return { count, label }
  }
}
