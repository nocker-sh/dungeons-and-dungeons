import { useLayoutEffect, useRef } from "react"
import { AnimationAborted, AnimationScope, parallel } from "./animation"

/** 操作から始めた演出もコンポーネントの寿命に結び付ける。 */
export function useAnimationScope() {
  const reference = useRef(new AnimationScope())
  useLayoutEffect(() => {
    if (reference.current.signal.aborted)
      reference.current = new AnimationScope()
    return () => reference.current.cancel()
  }, [])
  return reference
}

/** 中断は通常終了。その他の失敗は隠さない。 */
export function reportAnimationError(error: unknown) {
  if (!(error instanceof AnimationAborted)) throw error
}

export function useAnimationEffect(
  run: () => unknown,
  dependencies: readonly unknown[]
) {
  useLayoutEffect(() => {
    const task = parallel(run)
    void task.finished.catch(reportAnimationError)
    return task.cancel
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies)
}
