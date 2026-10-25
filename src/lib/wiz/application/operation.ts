import type { WizWorldEnvironment } from "@/lib/wiz/core/world/world"
import type { GameState } from "@/lib/wiz/state"
import type { Transition } from "@/lib/wiz/application/transition"

/** 一つの操作。状態を受け取り、次の状態と出来事、または拒否理由を返す。 */
export type Operation<T> = Readonly<{
  execute: (
    state: GameState,
    input: T,
    environment: WizWorldEnvironment
  ) => Transition
}>
