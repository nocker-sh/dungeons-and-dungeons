import { useLayoutEffect, useSyncExternalStore } from "react"
import { useStage } from "@/components/stage/stage-context"
import type { StageView, Takeover } from "@/components/stage/director"

/** 今の場面の見せ方（何が画面を占めているかから決まる）。 */
export function useStageView(): StageView {
  const { director } = useStage()
  return useSyncExternalStore(
    director.subscribe,
    director.snapshot,
    director.snapshot
  )
}

/** 出ている間（active の間）、画面を占めるものとして登録する。 */
export function useTakeover(takeover: Takeover, active = true) {
  const { director } = useStage()
  useLayoutEffect(
    () => (active ? director.enter(takeover) : undefined),
    [director, takeover, active]
  )
}

/** useTakeover を、フックを呼べない場所（Stage を描く側）から使うための部品。 */
export function TakeoverWhile({
  takeover,
  active,
}: {
  takeover: Takeover
  active: boolean
}) {
  useTakeover(takeover, active)
  return null
}
