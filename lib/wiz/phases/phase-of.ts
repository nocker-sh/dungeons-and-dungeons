import { ConversationPhase } from "@/lib/wiz/phases/conversation-phase"
import type { Game } from "@/lib/wiz/game/game"
import type { Phase } from "@/lib/wiz/phases/phase"
import { CreatingPhase } from "@/lib/wiz/phases/creating-phase"
import { TownPhase } from "@/lib/wiz/phases/town-phase"
import { ExpeditionPhase } from "@/lib/wiz/phases/expedition-phase"
import { PendingPhase } from "@/lib/wiz/phases/pending-phase"
import { MemberTurnPhase } from "@/lib/wiz/phases/member-turn-phase"
import { FoeTurnPhase } from "@/lib/wiz/phases/foe-turn-phase"

/** 今のフェーズ。 */
export function phaseOf(game: Game): Phase {
  const state = game.state
  if (state.conversation?.active)
    return new ConversationPhase(game, state, phaseOf)
  switch (state.phase.type) {
    case "creating":
      return new CreatingPhase(game, state, phaseOf)
    case "town":
      return new TownPhase(game, state, phaseOf)
    case "expedition":
      return state.phase.expedition.pending
        ? new PendingPhase(game, state, phaseOf)
        : new ExpeditionPhase(game, state, phaseOf)
    case "battle": {
      const { battle } = state.phase
      const current = battle.order[battle.turn % battle.order.length]
      return current.kind === "member"
        ? new MemberTurnPhase(game, state, phaseOf, current.id)
        : new FoeTurnPhase(game, state, phaseOf, current.id)
    }
  }
}
