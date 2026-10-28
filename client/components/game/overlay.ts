import type { TargetRequest } from "@/client/components/game/formation/context"

/**
 * 画面の上に重なるもの（バッグ・仲間選び）と、下の札の状態の有限オートマトン。
 * 操作はすべて action として reduceOverlay に通し、今の状態で受け付けない操作は何もしない。
 * 例：バッグを開いている間は札を押しても詳細へ移らない。
 *
 * 札を押したときに呼ぶ処理（選んだ仲間に使う・戦闘の詳細を開く）は、状態を返したあとに effect として実行する。
 */
export type OverlayMode =
  /** 何も重なっていない。札を押すと立ち絵が上がる（戦闘では場面が決めた処理）。 */
  | { kind: "free" }
  /** バッグを開いている。札は引っ込み、押せない。closing は閉じる動きの最中。 */
  | { kind: "bag"; closing: boolean }
  /** 下の札から仲間を一人選ばせている。選ぶか取りやめると back へ戻る。 */
  | { kind: "choosing"; request: TargetRequest; back: "free" | "bag" }

export type OverlayState = {
  mode: OverlayMode
  /** 枠の上へ絵が抜けている仲間（街では立ち絵、戦闘では手番の仲間）。 */
  lifted: string | null
  /** バッグに閉じる合図を送った回数（一覧の閉じる動きのきっかけ）。 */
  closeRequests: number
}

/** 表示に使う値。状態から一通りに決まる。 */
export const overlayView = {
  /** バッグの一覧を出しておくか（仲間を選んでいる間も後ろに残す）。 */
  bagMounted: (state: OverlayState) =>
    state.mode.kind === "bag" ||
    (state.mode.kind === "choosing" && state.mode.back === "bag"),
  /** バッグのボタンを「開いている」見た目にするか。 */
  bagOpen: (state: OverlayState) =>
    (state.mode.kind === "bag" && !state.mode.closing) ||
    (state.mode.kind === "choosing" && state.mode.back === "bag"),
  /** 下の札を引っ込めるか。 */
  cardsHidden: (state: OverlayState) =>
    state.mode.kind === "bag" && !state.mode.closing,
  target: (state: OverlayState) =>
    state.mode.kind === "choosing" ? state.mode.request : null,
}
