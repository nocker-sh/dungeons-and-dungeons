import type { Screen } from "@/client/game/navigation"
import type { TransitionState } from "@/client/game/screen-transition"

export type TransitionEvent<Enter = unknown> =
  /** 次の画面へ切り替えを始める。 */
  | { type: "go"; to: Screen; enter?: Enter }
  /** 今の画面の退場が終わった。 */
  | { type: "left" }
  /** 次の画面の背景の差し替えと入りのショットが終わった。 */
  | { type: "arrived" }

export function transition<Enter>(
  state: TransitionState<Enter>,
  event: TransitionEvent<Enter>
): TransitionState<Enter> | null {
  switch (state.kind) {
    case "showing":
      return event.type === "go"
        ? {
            kind: "leaving",
            from: state.screen,
            to: event.to,
            enter: event.enter,
          }
        : null
    case "leaving":
      return event.type === "left"
        ? { kind: "arriving", screen: state.to, enter: state.enter }
        : null
    case "arriving":
      return event.type === "arrived"
        ? { kind: "showing", screen: state.screen }
        : null
  }
}
