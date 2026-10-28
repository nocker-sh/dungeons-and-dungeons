import type { GameReason } from "@/lib/wiz/state/game-reason"
import type { Transition } from "@/lib/wiz/application/transition"

export function reject(reason: GameReason): Transition {
  return { accepted: false, reason }
}
