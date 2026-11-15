import { useLayoutEffect } from "react"
import { parallel } from "@/client/components/canvas/parallel"
import { reportAnimationError } from "@/client/components/canvas/report-animation-error"

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
