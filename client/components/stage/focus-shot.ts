import type { Shot } from "@/client/components/stage/camera"
import type { FocusFrame } from "@/client/components/stage/focus-zoom"
import { ARTBOARD_DEPTH, ORIGIN } from "@/client/components/stage/focus-zoom"

/** 行き先へ寄るときの背景の拡大率（背景の面での倍率）。 */
export const FOCUS_SCALE = 2.2

/** 寄った先のぼかし。背景の面では奥行きの分だけ弱くなる。 */
export const FOCUS_BLUR = 16

/** 手持ちの揺れで端の外が見えないように残す余白（px）。 */
export const EDGE_MARGIN = 40

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
