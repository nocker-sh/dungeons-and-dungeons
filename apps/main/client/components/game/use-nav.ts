import { createContext, useContext } from "react"
import type { Screen } from "@/client/game/navigation"
import type { TransitionState } from "@/client/game/screen-transition"
import type { Establish, Move } from "@/client/components/game/nav"

export type Nav = {
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
