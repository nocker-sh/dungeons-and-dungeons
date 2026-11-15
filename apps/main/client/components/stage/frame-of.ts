import type { StageApi } from "@/client/components/stage/use-stage"
import type { FocusFrame } from "@/client/components/stage/focus-zoom"

export function frameOf(stage: Pick<StageApi, "artboard" | "canvas">) {
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
