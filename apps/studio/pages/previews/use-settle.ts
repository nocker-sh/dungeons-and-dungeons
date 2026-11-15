import { useEffect } from "react"
import { setTimeScale } from "@/client/components/canvas/set-time-scale"
import { stillClock } from "@/client/components/canvas/animation"
import { MotionGlobalConfig } from "motion/react"

/** 入りの演出を早送りする。still なら繰り返しの動きも止める。 */
export function useSettle(still: boolean) {
  useEffect(() => {
    if (!still) return
    // 明示的な静止画モードだけ、開いた直後は待ち時間をほぼ0にして、入りの演出を飛ばす
    setTimeScale(0.02)
    // still なら motion の動きは最初から最後の形にする（くり返しも止まる）
    MotionGlobalConfig.skipAnimations = still
    stillClock.on = still
    const settle = () => {
      for (const animation of document.getAnimations()) {
        const timing = animation.effect?.getTiming()
        if (timing?.iterations === Infinity) {
          if (still) {
            animation.pause()
            animation.currentTime = 0
          }
        } else if (animation.playState !== "finished") animation.finish()
      }
    }
    const timer = setInterval(settle, 50)
    const stop = setTimeout(() => {
      clearInterval(timer)
      settle()
      setTimeScale(1)
    }, 1500)
    return () => {
      clearInterval(timer)
      clearTimeout(stop)
      setTimeScale(1)
      MotionGlobalConfig.skipAnimations = false
      stillClock.on = false
    }
  }, [still])
}
