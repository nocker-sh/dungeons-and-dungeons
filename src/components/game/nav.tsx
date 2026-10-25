import { flushSync } from "react-dom"
import { nextFrame, parallel } from "@/components/canvas/animation"
import { useAnimationScope } from "@/components/canvas/use-animation"
import { createContext, useContext, useEffect, useRef, useState } from "react"
import { ease, type Shot } from "@/components/stage/camera"
import { isAborted } from "@/components/stage/kit"
import { useStage } from "@/components/stage/stage-context"

import type { Screen } from "@/lib/game-client/navigation"
export type { Place, ShopId, Screen } from "@/lib/game-client/navigation"
import { animationTiming } from "@/components/stage/timing"
import {
  screenOf,
  transition,
  type TransitionEvent,
  type TransitionState,
} from "@/lib/game-client/screen-transition"

export type Establish = "crane" | "dolly" | "pan" | "tilt" | "none"

export type Move = {
  exit?: Partial<Shot> & { ms?: number; in?: boolean }
  /** 退場の間に流す演出。終わってから次の画面へ。 */
  during?: () => Promise<void>
  enter?: Establish
}

type Nav = {
  screen: Screen
  enter: Establish | undefined
  leaving: boolean
  /** 切り替えの状態（有限オートマトン）。操作できるのは showing のときだけ。 */
  phase: TransitionState<Establish>
  /** 今の画面の要素を画面外へ散らし、カメラを動かしてから次の画面へ。 */
  go: (next: Screen, move?: Move) => Promise<void>
  /** 次の画面の背景の差し替えと入りのショットが終わった（useArrival が送る）。 */
  arrived: () => void
}

export const NavContext = createContext<Nav | null>(null)

export function useNav() {
  const nav = useContext(NavContext)
  if (!nav) throw new Error("useNav must be used inside NavProvider")
  return nav
}

/**
 * 画面の切り替えを、有限オートマトン（lib/game-client/screen-transition）で進める。
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

/**
 * 画面に着いたときの入りのショット。絵を差し替え、カメラを落ち着かせてから ready になる。
 * signal は画面が変わったら中断される。
 */
export function useArrival(
  art: string | null,
  fallback: Establish,
  bars = 4,
  run?: (signal: AbortSignal) => Promise<void>
) {
  const stage = useStage()
  const nav = useNav()
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    const kind = nav.enter ?? fallback
    const arrive = async () => {
      // 背景を読み込んで差し替え終えてから入りのショットを始める（古い背景・黒い隙間を見せない）
      await stage.art(art)
      if (controller.signal.aborted) return
      if (kind !== "none")
        await parallel(
          () => stage.camera.establish(kind, animationTiming.arrival),
          controller.signal
        )
      if (controller.signal.aborted) return
      stage.bars(bars)
      if (run) await run(controller.signal)
      if (controller.signal.aborted) return
      setReady(true)
      nav.arrived()
    }
    arrive().catch((error) => {
      if (!isAborted(error)) throw error
    })
    return () => controller.abort()
    // 着いたときだけ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return ready
}
