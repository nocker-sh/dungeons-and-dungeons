import { useRef } from "react"
import { COLOR, EASE_OUT } from "@/client/components/stage/kit"
import { unitPx } from "@/client/components/stage/unit-px"
import { randomBetween } from "@/client/components/stage/random-between"
import { play } from "@/client/components/canvas/play"
import { useRun } from "@/client/components/stage/fx/use-run"
import type { Done } from "@/client/components/stage/fx/use-run"

/** 角ばった破片をまき散らす。 */
type Props = {
  x: number
  y: number
  n?: number
  colors?: readonly string[]
  power?: number
  delay?: number
} & Done

export function Shards(props: Props) {
  const n = props.n === undefined ? 14 : props.n
  const colors =
    props.colors === undefined
      ? [COLOR.paper, COLOR.blood, COLOR.ink]
      : props.colors
  const power = props.power === undefined ? 1 : props.power
  const delay = props.delay === undefined ? 0 : props.delay

  const parts = useRef<
    {
      s: number
      h: number
      c: string
      a: number
      dist: number
      spin: number
      dur: number
    }[]
  >([])
  if (!parts.current.length) {
    const u = unitPx()
    for (let i = 0; i < n; i++) {
      const s = randomBetween(1.2, 3.2) * u * power
      parts.current.push({
        s,
        h: s * randomBetween(0.5, 1.6),
        c: colors[i % colors.length],
        a: randomBetween(0, Math.PI * 2),
        dist: randomBetween(12, 34) * u * power,
        spin: randomBetween(-720, 720),
        dur: randomBetween(450, 750),
      })
    }
  }
  const ref = useRun((root) => {
    const u = unitPx()
    return [...root.children].map((child, i) => {
      const p = parts.current[i]
      return play(
        child as HTMLElement,
        [
          { transform: "translate(-50%,-50%) rotate(0deg) scale(1.4)" },
          {
            transform: `translate(calc(-50% + ${Math.cos(p.a) * p.dist}px), calc(-50% + ${Math.sin(p.a) * p.dist + 8 * u}px)) rotate(${p.spin}deg) scale(.4)`,
            opacity: 0,
          },
        ],
        { duration: p.dur, delay, easing: EASE_OUT, fill: "both" }
      )
    })
  }, props.done)
  return (
    <div ref={ref} style={{ position: "absolute", inset: 0, zIndex: 40 }}>
      {parts.current.map((p, i) => (
        <i
          key={i}
          style={{
            position: "absolute",
            left: props.x,
            top: props.y,
            width: p.s,
            height: p.h,
            background: p.c,
            outline: `2px solid ${COLOR.ink}`,
            clipPath: "polygon(0 0, 100% 20%, 70% 100%)",
          }}
        />
      ))}
    </div>
  )
}
