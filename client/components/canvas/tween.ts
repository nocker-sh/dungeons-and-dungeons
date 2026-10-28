import { animate } from "motion"
import type { Playback } from "@/client/components/canvas/animation"
import { scaledMs } from "@/client/components/canvas/scaled-ms"
import { playback } from "@/client/components/canvas/playback"

/** 数字・カメラ・文字送りもMotionの時計と完了通知で動かす。 */
export function tween(
  from: number,
  to: number,
  duration: number,
  update: (value: number) => void,
  options: {
    delay?: number
    ease?: (value: number) => number
    repeat?: number
  } = {}
): Playback {
  const controls = animate(from, to, {
    duration: scaledMs(duration) / 1000,
    delay: scaledMs(options.delay ?? 0) / 1000,
    ease: options.ease ?? "linear",
    repeat: options.repeat,
    onUpdate: update,
  })
  return playback(controls.finished, () => controls.stop(), {
    infinite: options.repeat === Infinity,
  })
}
