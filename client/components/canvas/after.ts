import type { Playback } from "@/client/components/canvas/animation"
import {
  AnimationScope,
  AnimationAborted,
} from "@/client/components/canvas/animation"
import { parallel } from "@/client/components/canvas/parallel"
import { playback } from "@/client/components/canvas/playback"

/** 前の拍が完了したときだけ次へ。キャンセルした古い演出から状態を更新しない。 */
export function after(
  task: Playback,
  next: () => unknown,
  signal?: AbortSignal
): Playback {
  const scope = new AnimationScope(signal)
  scope.add(task)
  const finished = (async () => {
    try {
      await task.finished
      scope.assertActive()
      if (task.state !== "completed") throw new AnimationAborted()
      await scope.capture(() => parallel(next, scope.signal))
      scope.assertActive()
      scope.release()
    } catch (error) {
      scope.cancel()
      throw error
    }
  })()
  return playback(finished, scope.cancel)
}
