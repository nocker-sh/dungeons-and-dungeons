import type { TargetRequest } from "@/components/game/formation"

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

export type OverlayAction =
  | { type: "lift"; member: string | null }
  /** 札を押した。delegated は場面が押したときの処理を差し替えているか（戦闘）。 */
  | { type: "pressCard"; member: string; delegated: boolean }
  | { type: "toggleBag" }
  /** 閉じる動きが終わった。 */
  | { type: "bagClosed" }
  | { type: "choose"; request: TargetRequest }
  | { type: "cancelChoosing" }

export type OverlayEffect =
  | { type: "pick"; request: TargetRequest; member: string }
  | { type: "cancel"; request: TargetRequest }
  | { type: "delegate"; member: string }

export type OverlayTransition = {
  state: OverlayState
  effect?: OverlayEffect
}

export function initialOverlay(
  start: { bag?: boolean; lifted?: string | null } = {}
): OverlayState {
  return {
    mode: start.bag ? { kind: "bag", closing: false } : { kind: "free" },
    lifted: start.bag ? null : (start.lifted ?? null),
    closeRequests: 0,
  }
}

function modeOf(back: "free" | "bag"): OverlayMode {
  return back === "bag" ? { kind: "bag", closing: false } : { kind: "free" }
}

export function reduceOverlay(
  state: OverlayState,
  action: OverlayAction
): OverlayTransition {
  const mode = state.mode
  switch (action.type) {
    case "lift":
      if (mode.kind !== "free") return { state }
      return { state: { ...state, lifted: action.member } }
    case "pressCard":
      if (mode.kind === "bag") return { state }
      if (mode.kind === "choosing") {
        if (!mode.request.eligible.includes(action.member)) return { state }
        return {
          state: { ...state, mode: modeOf(mode.back) },
          effect: {
            type: "pick",
            request: mode.request,
            member: action.member,
          },
        }
      }
      if (action.delegated)
        return { state, effect: { type: "delegate", member: action.member } }
      return {
        state: {
          ...state,
          lifted: state.lifted === action.member ? null : action.member,
        },
      }
    case "toggleBag":
      if (mode.kind === "free")
        return {
          state: {
            ...state,
            mode: { kind: "bag", closing: false },
            lifted: null,
          },
        }
      if (mode.kind === "bag" && !mode.closing)
        return {
          state: {
            ...state,
            mode: { kind: "bag", closing: true },
            closeRequests: state.closeRequests + 1,
          },
        }
      return { state }
    case "bagClosed":
      if (mode.kind !== "bag") return { state }
      return { state: { ...state, mode: { kind: "free" } } }
    case "choose":
      if (mode.kind === "free")
        return {
          state: {
            ...state,
            mode: { kind: "choosing", request: action.request, back: "free" },
          },
        }
      if (mode.kind === "bag" && !mode.closing)
        return {
          state: {
            ...state,
            mode: { kind: "choosing", request: action.request, back: "bag" },
          },
        }
      return { state }
    case "cancelChoosing":
      if (mode.kind !== "choosing") return { state }
      return {
        state: { ...state, mode: modeOf(mode.back) },
        effect: { type: "cancel", request: mode.request },
      }
  }
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
