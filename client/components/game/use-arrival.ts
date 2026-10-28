import { parallel } from "@/client/components/canvas/parallel"
import { useEffect, useState } from "react"
import { isAborted } from "@/client/components/stage/is-aborted"
import { useStage } from "@/client/components/stage/use-stage"
import { animationTiming } from "@/client/components/stage/timing"
import type { Establish } from "@/client/components/game/nav"
import { useNav } from "@/client/components/game/use-nav"

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
