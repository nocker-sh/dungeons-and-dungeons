import type { Playback } from "@/client/components/canvas/animation"
import { tween } from "@/client/components/canvas/tween"

/** 読むための間など、動きの完了待ちではない意図的な保持。 */
export function hold(duration: number, signal?: AbortSignal): Playback {
  const task = tween(0, 1, duration, () => {})
  if (signal) {
    const abort = () => task.cancel()
    signal.addEventListener("abort", abort, { once: true })
    if (signal.aborted) abort()
    void task.finished
      .finally(() => signal.removeEventListener("abort", abort))
      .catch(() => {})
  }
  return task
}
