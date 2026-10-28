import { frame, cancelFrame } from "motion"
import { AnimationAborted } from "@/client/components/canvas/animation"

/** DOM反映を待つ。時間の推測ではなくMotionの次の描画フレームに同期する。 */
export function nextFrame(signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => signal?.removeEventListener("abort", abort)
    const render = () => {
      cleanup()
      resolve()
    }
    const abort = () => {
      cancelFrame(render)
      cleanup()
      reject(new AnimationAborted())
    }
    if (signal?.aborted) return abort()
    signal?.addEventListener("abort", abort, { once: true })
    frame.postRender(render)
  })
}
