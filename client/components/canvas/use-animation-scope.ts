import { useLayoutEffect, useRef } from "react"
import { AnimationScope } from "@/client/components/canvas/animation"

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
