import { useExitAnimation } from "@/client/components/stage/use-exit-animation"
import { useLeaving } from "@/client/components/stage/use-leaving"
import { useIsPresent } from "motion/react"

/**
 * 退場中か。合図（LeavingContext）で下がる場合と、AnimatePresence で消える場合の両方を見る。
 * going の間は押せず、data-leaving を立ててキーボードの選択から外す（focus.ts が見る）。
 */
export function useGoing() {
  const leaving = useLeaving()
  const present = useIsPresent()
  const going = leaving || !present
  const completion = useExitAnimation(leaving)
  return { leaving, going, mark: going ? "1" : undefined, completion }
}
