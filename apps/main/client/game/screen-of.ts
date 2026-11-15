import type { TransitionState } from "@/client/game/screen-transition"

/** 描いている画面。退場の間は前の画面、置いた後は次の画面。 */
export function screenOf(state: TransitionState) {
  return state.kind === "leaving" ? state.from : state.screen
}
