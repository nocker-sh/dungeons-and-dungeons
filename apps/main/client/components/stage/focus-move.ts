import type { Move } from "@/client/components/game/nav"
import type { Camera } from "@/client/components/stage/camera"
import { stillClock } from "@/client/components/canvas/animation"
import type { StageApi } from "@/client/components/stage/use-stage"
import { animationTiming } from "@/client/components/stage/timing"
import { prefersReducedMotion } from "@/client/components/stage/prefers-reduced-motion"
import { frameOf } from "@/client/components/stage/frame-of"
import { layerPointOf } from "@/client/components/stage/layer-point-of"
import { focusShot } from "@/client/components/stage/focus-shot"

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
