import { useLayoutEffect, useRef } from "react"
import { playback, type AnimationBarrier } from "@/components/canvas/animation"
import { useStage } from "./stage-context"

/** Motionが知らせる退場の開始・完了を画面遷移へ返す。 */
export function useExitAnimation(leaving: boolean) {
  return useAnimationCompletion(useStage().exits, leaving)
}

export function useAnimationCompletion(
  barrier: AnimationBarrier,
  enabled = true
) {
  const active = useRef<{ definition: unknown; finish: () => void } | null>(
    null
  )
  useLayoutEffect(
    () => () => {
      active.current?.finish()
      active.current = null
    },
    []
  )
  return {
    onAnimationStart(definition: unknown) {
      if (!enabled) return
      active.current?.finish()
      let finish!: () => void
      const finished = new Promise<void>((resolve) => {
        finish = resolve
      })
      barrier.track(playback(finished, finish))
      active.current = { definition, finish }
    },
    onAnimationComplete(definition: unknown) {
      if (active.current?.definition !== definition) return
      active.current?.finish()
      active.current = null
    },
  }
}
