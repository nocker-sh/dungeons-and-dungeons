import type { TransitionState } from "@/client/game/screen-transition"

/** 遊ぶ人の操作を受け付けるか。切り替えの途中は受け付けない。 */
export function interactive(state: TransitionState) {
  return state.kind === "showing"
}
