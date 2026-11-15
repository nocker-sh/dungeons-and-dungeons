import { useSyncExternalStore } from "react"
import { useStage } from "@/client/components/stage/use-stage"
import type { StageView } from "@/client/components/stage/director"

/** 今の場面の見せ方（何が画面を占めているかから決まる）。 */
export function useStageView(): StageView {
  const { director } = useStage()
  return useSyncExternalStore(
    director.subscribe,
    director.snapshot,
    director.snapshot
  )
}
