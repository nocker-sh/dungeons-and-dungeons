import { useLayoutEffect, useRef } from "react"
import { AnimationScope } from "@/client/components/canvas/animation"
import type { Playback } from "@/client/components/canvas/animation"

export type Done = { done: () => void }

/** 子の全再生を所有する。有限の動きが全て完了したら退場し、無限の装飾も停止する。 */
export function useRun(
  run: (
    element: HTMLElement,
    scope: AnimationScope
  ) => (Playback | Promise<unknown> | undefined)[] | void,
  done: () => void
) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    const scope = new AnimationScope()
    const entries = scope.capture(() => run(element, scope)) ?? []
    void (async () => {
      await Promise.all(
        entries.flatMap((entry) => {
          if (!entry) return []
          if ("infinite" in entry) return entry.infinite ? [] : [entry.finished]
          return [entry]
        })
      )
      await scope.wait()
      scope.release()
      if (!scope.signal.aborted) done()
    })().catch((error) => {
      if (!scope.signal.aborted) throw error
    })
    return scope.cancel
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return ref
}
