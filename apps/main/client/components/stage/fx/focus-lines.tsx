import { useRef } from "react"
import { COLOR } from "@/client/components/stage/kit"
import { randomBetween } from "@/client/components/stage/random-between"
import { play } from "@/client/components/canvas/play"
import { useRun } from "@/client/components/stage/fx/use-run"
import type { Done } from "@/client/components/stage/fx/use-run"

/** 画面の縁から中心へ向かう集中線。 */
type Props = {
  cx: number
  cy: number
  width: number
  height: number
  dur?: number
  color?: string
  delay?: number
  count?: number
} & Done

export function FocusLines(props: Props) {
  const dur = props.dur === undefined ? 420 : props.dur
  const color = props.color === undefined ? COLOR.paper : props.color
  const delay = props.delay === undefined ? 0 : props.delay
  const count = props.count === undefined ? 46 : props.count

  const d = useRef("")
  if (!d.current) {
    const R = Math.hypot(props.width, props.height)
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + randomBetween(-0.05, 0.05)
      const inner =
        randomBetween(0.18, 0.34) * Math.min(props.width, props.height)
      const w = randomBetween(0.006, 0.02)
      const x1 = props.cx + Math.cos(a) * R
      const y1 = props.cy + Math.sin(a) * R
      const x2 = props.cx + Math.cos(a - w) * inner
      const y2 = props.cy + Math.sin(a - w) * inner
      const x3 = props.cx + Math.cos(a + w) * inner
      const y3 = props.cy + Math.sin(a + w) * inner
      d.current += `M${x1.toFixed(0)} ${y1.toFixed(0)} L${x2.toFixed(0)} ${y2.toFixed(0)} L${x3.toFixed(0)} ${y3.toFixed(0)}Z `
    }
  }
  const ref = useRun(
    (el) => [
      play(
        el,
        [
          { opacity: 0 },
          { opacity: 0.95, offset: 0.12 },
          { opacity: 0.8, offset: 0.6 },
          { opacity: 0 },
        ],
        { duration: dur, delay, fill: "both" }
      ),
    ],
    props.done
  )
  return (
    <div ref={ref} style={{ position: "absolute", inset: 0, zIndex: 39 }}>
      <svg style={{ width: "100%", height: "100%" }}>
        <path d={d.current} fill={color} />
      </svg>
    </div>
  )
}
