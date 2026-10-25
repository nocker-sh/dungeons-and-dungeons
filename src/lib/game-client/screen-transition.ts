import type { Screen } from "./navigation"

/**
 * 画面の切り替えの状態（有限オートマトン）。React・DOM に依存しない。
 *
 *   showing ──go──▶ leaving ──left──▶ arriving ──arrived──▶ showing
 *
 * - showing：画面を表示して操作を受け付ける。切り替えを始められるのはここだけ。
 * - leaving：今の画面の要素が退場し、カメラが動いている。次の画面はまだ描かない。
 * - arriving：次の画面を置いた。背景を読み込んで差し替え、入りのショットが終わるまで操作を受け付けない。
 *   画面は背景の差し替えが済んでから描く（古い背景の上に新しい画面が乗る一瞬を作らない）。
 *
 * 決めた遷移以外のイベントは受け付けず、状態を変えない（null を返す）。
 */
export type TransitionState<Enter = unknown> =
  | { kind: "showing"; screen: Screen }
  | { kind: "leaving"; from: Screen; to: Screen; enter?: Enter }
  | { kind: "arriving"; screen: Screen; enter?: Enter }

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

/** 描いている画面。退場の間は前の画面、置いた後は次の画面。 */
export function screenOf(state: TransitionState) {
  return state.kind === "leaving" ? state.from : state.screen
}

/** 遊ぶ人の操作を受け付けるか。切り替えの途中は受け付けない。 */
export function interactive(state: TransitionState) {
  return state.kind === "showing"
}
