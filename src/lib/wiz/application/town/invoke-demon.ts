import type { GameActionOf } from "@/lib/wiz/commands"
import type { GameDependencies } from "@/lib/wiz/application/game-dependencies"
import type { GameState } from "@/lib/wiz/state"
import type { WizWorldEnvironment } from "@/lib/wiz/core/world/world"
import { Bag } from "@/lib/wiz/rules/bag"
import { reject } from "@/lib/wiz/application/transition"
import { ConversationStartTransition } from "@/lib/wiz/application/conversation-start-transition"

/** 契約書は最初の呼び出しだけ消費する。会話を開始できないときは一切払わない。 */
export class InvokeDemon {
  static readonly featureId = "W044"
  constructor(private readonly deps: Pick<GameDependencies, "catalog">) {}
  execute(
    state: GameState,
    input: GameActionOf<"invoke-demon">,
    environment: WizWorldEnvironment
  ) {
    if (state.phase.type !== "town") return reject("WRONG_PHASE")
    const demon = this.deps.catalog.demon(input.demon)
    if (!demon?.contract?.paper) return reject("UNKNOWN")
    if (state.demons.some((owned) => owned.id === demon.id))
      return reject("ALREADY")
    const flag = `demon-called:${demon.id}`
    const called =
      state.conversation?.flags?.includes(flag) ||
      state.conversation?.seen.includes(demon.contract.encounter)
    const bag = called ? state.bag : Bag.remove(state.bag, demon.contract.paper)
    if (!bag) return reject("NO_MATERIALS")
    const conversation = state.conversation ?? {
      seen: [],
      last: null,
      active: null,
    }
    const next = {
      ...state,
      bag,
      conversation: {
        ...conversation,
        flags: [...new Set([...(conversation.flags ?? []), flag])],
      },
    }
    return new ConversationStartTransition(this.deps).execute(
      next,
      { type: "start-conversation", trigger: "talk", resident: demon.id },
      environment
    )
  }
}
