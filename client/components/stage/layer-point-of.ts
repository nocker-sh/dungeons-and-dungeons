import type { Shot } from "@/client/components/stage/camera"
import type { FocusFrame } from "@/client/components/stage/focus-zoom"
import { ARTBOARD_DEPTH, ORIGIN } from "@/client/components/stage/focus-zoom"

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
