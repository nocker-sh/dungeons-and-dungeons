import type { Move } from "@/components/game/nav"
import type { Camera, Shot } from "@/components/stage/camera"
import { stillClock } from "@/components/stage/kit"
import type { StageApi } from "@/components/stage/stage-context"
import { animationTiming } from "@/components/stage/timing"

/** 行き先へ寄るときの背景の拡大率（背景の面での倍率）。 */
export const FOCUS_SCALE = 2.2
/** 寄った先のぼかし。背景の面では奥行きの分だけ弱くなる。 */
const FOCUS_BLUR = 16
/** 背景の面の奥行き（stage.tsx の ArtSet の最初の層）。 */
const ARTBOARD_DEPTH = 0.5
/** 背景の面の拡大・回転の中心（stage.tsx の LAYER の transformOrigin）。 */
const ORIGIN = { x: 0.5, y: 0.55 }
/** 手持ちの揺れで端の外が見えないように残す余白（px）。 */
const EDGE_MARGIN = 40

/** 背景の面と画面の大きさ。面の位置は画面の左上からの、カメラの変形前の値。 */
export type FocusFrame = {
  layerLeft: number
  layerTop: number
  layerWidth: number
  layerHeight: number
  viewportWidth: number
  viewportHeight: number
}

/**
 * 背景の面の一点（面の左上からの変形前のpx）を画面の中央へ運ぶカメラ。
 * 寄ったときに面の外が見えない範囲へ中心を寄せる。
 */
export function focusShot(
  point: { x: number; y: number },
  frame: FocusFrame,
  scale = FOCUS_SCALE,
  depth = ARTBOARD_DEPTH
): Shot {
  const originX = frame.layerLeft + frame.layerWidth * ORIGIN.x
  const originY = frame.layerTop + frame.layerHeight * ORIGIN.y
  const centerX = frame.viewportWidth / 2
  const centerY = frame.viewportHeight / 2
  // 面の中心（拡大の中心）から見た位置。画面の中央はこの位置の面の外を映さない範囲に収める
  const clamp = (value: number, low: number, high: number) =>
    low > high ? (low + high) / 2 : Math.min(high, Math.max(low, value))
  const x = clamp(
    point.x - frame.layerWidth * ORIGIN.x,
    frame.layerLeft - originX + (centerX + EDGE_MARGIN) / scale,
    frame.layerLeft +
      frame.layerWidth -
      originX -
      (frame.viewportWidth - centerX + EDGE_MARGIN) / scale
  )
  const y = clamp(
    point.y - frame.layerHeight * ORIGIN.y,
    frame.layerTop - originY + (centerY + EDGE_MARGIN) / scale,
    frame.layerTop +
      frame.layerHeight -
      originY -
      (frame.viewportHeight - centerY + EDGE_MARGIN) / scale
  )
  // 層の変形は translate(-cam*depth) scale(1+(z-1)*depth)。中心へ来る移動量から逆算する
  return {
    x: (scale * x - (centerX - originX)) / depth,
    y: (scale * y - (centerY - originY)) / depth,
    z: 1 + (scale - 1) / depth,
    r: 0,
    blur: FOCUS_BLUR,
  }
}

/** 画面上の一点を、今のカメラの変形を戻して背景の面の点にする（回転と手持ちの揺れは無視）。 */
export function layerPointOf(
  view: { x: number; y: number },
  frame: FocusFrame,
  camera: Pick<Shot, "x" | "y" | "z">,
  depth = ARTBOARD_DEPTH
) {
  const scale = 1 + (camera.z - 1) * depth
  const originX = frame.layerLeft + frame.layerWidth * ORIGIN.x
  const originY = frame.layerTop + frame.layerHeight * ORIGIN.y
  return {
    x:
      frame.layerWidth * ORIGIN.x +
      (view.x - originX + camera.x * depth) / scale,
    y:
      frame.layerHeight * ORIGIN.y +
      (view.y - originY + camera.y * depth) / scale,
  }
}

function prefersReducedMotion() {
  return (
    typeof matchMedia === "function" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches
  )
}

function frameOf(stage: Pick<StageApi, "artboard" | "canvas">) {
  const artboard = stage.artboard
  const viewport = stage.canvas.current
  if (!artboard || !viewport) return null
  return {
    layerLeft: artboard.offsetLeft,
    layerTop: artboard.offsetTop,
    layerWidth: artboard.clientWidth,
    layerHeight: artboard.clientHeight,
    viewportWidth: viewport.clientWidth,
    viewportHeight: viewport.clientHeight,
  } satisfies FocusFrame
}

/**
 * 行き先を選んだときの画面の切り替え方。背景のその場所へ寄ってから次の画面へ移り、
 * 次の画面は寄る動きの続き（dolly：ぼけた寄りから落ち着く）で受ける。
 * 動きを減らす設定と静止画モードでは寄らず、要素の退場だけで切り替える。
 */
export function focusMove(
  stage: Pick<StageApi, "artboard" | "canvas"> & { camera: Camera },
  target:
    | { layer: { x: number; y: number } }
    | { element: Element | null | undefined }
): Move {
  if (stillClock.on || prefersReducedMotion()) return { enter: "none" }
  const frame = frameOf(stage)
  if (!frame) return { enter: "dolly" }
  let point: { x: number; y: number }
  if ("layer" in target) point = target.layer
  else {
    const viewport = stage.canvas.current
    if (!target.element || !viewport) return { enter: "dolly" }
    const rect = target.element.getBoundingClientRect()
    const origin = viewport.getBoundingClientRect()
    point = layerPointOf(
      {
        x: rect.left - origin.left + rect.width / 2,
        y: rect.top - origin.top + rect.height / 2,
      },
      frame,
      stage.camera.cam
    )
  }
  return {
    exit: { ...focusShot(point, frame), ms: animationTiming.focus },
    enter: "dolly",
  }
}
