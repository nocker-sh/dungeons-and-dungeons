import { useStage } from "@/client/components/stage/use-stage"
import { useAnimationCompletion } from "@/client/components/stage/use-animation-completion"

/** Motionが知らせる退場の開始・完了を画面遷移へ返す。 */
export function useExitAnimation(leaving: boolean) {
  return useAnimationCompletion(useStage().exits, leaving)
}
