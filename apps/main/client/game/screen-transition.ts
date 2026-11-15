import type { Screen } from "@/client/game/navigation"

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
