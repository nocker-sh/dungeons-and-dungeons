import { flushSync } from "react-dom"
import { nextFrame } from "@/client/components/canvas/next-frame"
import { parallel } from "@/client/components/canvas/parallel"
import { useAnimationScope } from "@/client/components/canvas/use-animation-scope"
import { useRef, useState } from "react"
import { ease } from "@/client/components/stage/camera"
import { useStage } from "@/client/components/stage/use-stage"
import type { Screen } from "@/client/game/navigation"
import { animationTiming } from "@/client/components/stage/timing"
import { screenOf } from "@/client/game/screen-of"
import { transition } from "@/client/game/transition"
import type { TransitionEvent } from "@/client/game/transition"
import type { TransitionState } from "@/client/game/screen-transition"
import type { Establish, Move } from "@/client/components/game/nav"

/**
 * 画面の切り替えを、有限オートマトン（client/game/screen-transition）で進める。
 * 最初の画面も「到着中」から始め、背景を差し替えて入りのショットを終えてから操作を受け付ける。
 * 切り替えの途中に来た go は受け付けない（二重の切り替えで画面が混ざらない）。
 */
export function useNavState(initial: Screen) {
  const stage = useStage()
  const [state, setState] = useState<TransitionState<Establish>>({
    kind: "arriving",
    screen: initial,
  })
  const current = useRef(state)
  const lifetime = useAnimationScope()
  const dispatch = (event: TransitionEvent<Establish>, sync = false) => {
    const next = transition(current.current, event)
    if (!next) return false
    current.current = next
    if (sync) flushSync(() => setState(next))
    else setState(next)
    return true
  }
  const go = async (next: Screen, move: Move = {}) => {
    if (!dispatch({ type: "go", to: next, enter: move.enter }, true)) return
    const scope = lifetime.current
    const exit = move.exit
    const movement = parallel(() => {
      if (move.during) return move.during()
      if (exit) {
        const { ms = animationTiming.enter, in: fast = true, ...shot } = exit
        return stage.camera.to(shot, ms, fast ? ease.in : ease.inOut)
      }
    }, scope.signal)
    await nextFrame(scope.signal)
    await Promise.all([movement, stage.exits.wait()])
    scope.assertActive()
    dispatch({ type: "left" })
  }
  const arrived = () => {
    dispatch({ type: "arrived" })
  }

  return {
    screen: screenOf(state),
    enter: state.kind === "arriving" ? state.enter : undefined,
    leaving: state.kind === "leaving",
    phase: state,
    go,
    arrived,
  }
}
