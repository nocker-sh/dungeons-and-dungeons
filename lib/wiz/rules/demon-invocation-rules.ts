import type { GameCatalog } from "@/lib/wiz/content/game-catalog"
import type { GameReason } from "@/lib/wiz/state/game-reason"
import type { GameState } from "@/lib/wiz/state/state-schema"
import { ConversationRules } from "@/lib/wiz/conversations/conversation-rules"
import { Bag } from "@/lib/wiz/rules/bag"

type Invocation =
  | Readonly<{ prepared: true; state: GameState }>
  | Readonly<{ prepared: false; reason: GameReason }>

/** 契約書の支払いと呼び出し済みの印。会話の開始条件は共通の会話規則に委ねる。 */
export class DemonInvocationRules {
  constructor(private readonly catalog: GameCatalog) {}

  called(state: GameState, demonId: string) {
    const encounter = this.catalog.demon(demonId)?.contract?.encounter
    return (
      state.conversation?.flags?.includes(`demon-called:${demonId}`) ||
      (encounter !== undefined &&
        state.conversation?.seen.includes(encounter)) ||
      false
    )
  }

  prepare(state: GameState, demonId: string): Invocation {
    if (state.phase.type !== "town")
      return { prepared: false, reason: "WRONG_PHASE" }
    const demon = this.catalog.demon(demonId)
    if (!demon?.contract?.paper) return { prepared: false, reason: "UNKNOWN" }
    if (state.demons.some((owned) => owned.id === demon.id))
      return { prepared: false, reason: "ALREADY" }
    const bag = this.called(state, demon.id)
      ? state.bag
      : Bag.remove(state.bag, demon.contract.paper)
    if (!bag) return { prepared: false, reason: "NO_MATERIALS" }
    const conversation = state.conversation ?? {
      seen: [],
      last: null,
      active: null,
    }
    const next: GameState = {
      ...state,
      bag,
      conversation: {
        ...conversation,
        flags: [
          ...new Set([
            ...(conversation.flags ?? []),
            `demon-called:${demon.id}`,
          ]),
        ],
      },
    }
    return { prepared: true, state: next }
  }

  canInvoke(state: GameState, demonId: string) {
    const invocation = this.prepare(state, demonId)
    return (
      invocation.prepared &&
      new ConversationRules(this.catalog).canOffer(invocation.state, "talk", {
        resident: demonId,
      })
    )
  }
}
