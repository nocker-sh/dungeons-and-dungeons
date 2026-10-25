import type { GameActionOf } from "@/lib/wiz/commands"
import type { GameState } from "@/lib/wiz/state"
import { inTown } from "@/lib/wiz/application/in-town"
import {
  accept,
  reject,
  type Transition,
} from "@/lib/wiz/application/transition"

/**
 * 宿の夜の雑談。選んだ相手の親しみが上がる。
 * 一晩に、仲間ひとりにつき一度だけ。宿に泊まると次の夜になり、また話せる。
 */
export class Chat {
  static readonly featureId = "W016"
  execute(state: GameState, input: GameActionOf<"chat">): Transition {
    if (!inTown(state)) return reject("WRONG_PHASE")
    if (state.nights <= 0) return reject("NOT_READY")
    if (!state.party.includes(input.liked)) return reject("UNKNOWN")
    if (state.chatted.includes(input.liked)) return reject("ALREADY")
    return accept(
      {
        ...state,
        chatted: [...state.chatted, input.liked],
        members: state.members.map((member) =>
          member.id === input.liked
            ? { ...member, like: member.like + 1 }
            : member
        ),
      },
      { type: "chatted", liked: input.liked }
    )
  }
}
