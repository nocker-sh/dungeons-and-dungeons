import type { Playback } from "@/client/components/canvas/animation"
import { AnimationScope } from "@/client/components/canvas/animation"
import { playback } from "@/client/components/canvas/playback"

/** 同じ拍の演出をまとめ、最も遅い実際の完了を待つ。 */
export function parallel(run: () => unknown, signal?: AbortSignal): Playback {
  const scope = new AnimationScope(signal)
  let result: unknown
  try {
    result = scope.capture(run)
  } catch (error) {
    scope.cancel()
    throw error
  }
  const finished = (async () => {
    try {
      if (
        result &&
        typeof result === "object" &&
        "then" in result &&
        typeof result.then === "function"
      )
        await (result as PromiseLike<unknown>)
      await scope.wait()
      scope.release()
    } catch (error) {
      scope.cancel()
      throw error
    }
  })()
  return playback(finished, scope.cancel)
}
