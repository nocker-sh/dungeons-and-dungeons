import { useLayoutEffect } from "react"
import { useStage } from "@/client/components/stage/use-stage"
import type { Takeover } from "@/client/components/stage/director"

/** 出ている間（active の間）、画面を占めるものとして登録する。 */
export function useTakeover(takeover: Takeover, active = true) {
  const { director } = useStage()
  useLayoutEffect(
    () => (active ? director.enter(takeover) : undefined),
    [director, takeover, active]
  )
}
