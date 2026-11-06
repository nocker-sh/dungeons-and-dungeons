import { inPhase } from "@/lib/wiz/phases/in-phase"
import { eventsOf } from "@/lib/wiz/phases/events-of"
import type { Game } from "@/lib/wiz/game/game"
import type {
  ConversationSubject,
  ConversationTrigger,
} from "@/lib/wiz/conversations/schema"

/** 会話の終了を待つ。台本選択と既読は Game が所有する。 */
export function playEventConversation(
  game: Game,
  trigger: ConversationTrigger,
  signal?: AbortSignal,
  subject: ConversationSubject = {}
): Promise<void> {
  const active = game.queries.activeConversation(game.state)
  const resuming =
    active?.trigger === trigger &&
    (trigger !== "visit" ||
      subject.place === undefined ||
      active.place === subject.place) &&
    (trigger !== "talk" ||
      subject.resident === undefined ||
      (active.sharedTalk
        ? active.participants.includes(subject.resident)
        : active.participants[0] === subject.resident))
  if (
    signal?.aborted ||
    (!resuming &&
      !game.queries.canStartConversation(game.state, trigger, subject))
  )
    return Promise.resolve()
  return new Promise((resolve) => {
    let unsubscribe = () => {}
    const finish = () => {
      unsubscribe()
      signal?.removeEventListener("abort", finish)
      resolve()
    }
    unsubscribe = game.subscribe(() => {
      if (!game.state.conversation?.active) finish()
    })
    signal?.addEventListener("abort", finish, { once: true })
    if (resuming) return
    const town = inPhase(game, "town")
    const result = eventsOf(
      trigger === "inn"
        ? town?.startConversation(trigger)
        : trigger === "talk"
          ? town?.talkTo(subject.resident ?? "")
          : trigger === "visit"
            ? town?.visit(subject.place ?? "")
            : trigger === "opening"
              ? inPhase(game, "creating")?.startOpening()
              : trigger === "branch"
                ? inPhase(game, "expedition")?.startConversation(trigger)
                : inPhase(game, "pending")?.startConversation(trigger)
    )
    if (!Array.isArray(result)) finish()
  })
}
