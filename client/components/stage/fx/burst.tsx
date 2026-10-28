import { useRef } from "react"
import { COMIC } from "@/client/components/canvas/tokens"
import {
  COLOR,
  EASE_IN,
  EASE_OUT,
  EASE_POP,
} from "@/client/components/stage/kit"
import { randomBetween } from "@/client/components/stage/random-between"
import { play } from "@/client/components/canvas/play"
import { useRun } from "@/client/components/stage/fx/use-run"
import type { Done } from "@/client/components/stage/fx/use-run"

/** トゲトゲの爆発吹き出しに擬音を乗せる。 */
type Props = {
  x: number
  y: number
  size: number
  text?: string
  fill?: string
  ink?: string
  delay?: number
  spin?: number
  hold?: number
} & Done

export function Burst(props: Props) {
  const text = props.text === undefined ? "" : props.text
  const fill = props.fill === undefined ? COLOR.paper : props.fill
  const ink = props.ink === undefined ? COLOR.ink : props.ink
  const delay = props.delay === undefined ? 0 : props.delay
  const spin = props.spin === undefined ? -12 : props.spin
  const hold = props.hold === undefined ? 620 : props.hold

  const points = useRef<string>("")
  if (!points.current) {
    const n = 14
    let pts = ""
    for (let i = 0; i < n * 2; i++) {
      const a = (i / (n * 2)) * Math.PI * 2 + randomBetween(-0.08, 0.08)
      const r = i % 2 ? randomBetween(26, 34) : randomBetween(44, 50)
      pts += `${(50 + Math.cos(a) * r).toFixed(1)},${(50 + Math.sin(a) * r).toFixed(1)} `
    }
    points.current = pts
  }
  const ref = useRun(
    (el) => [
      play(
        el,
        [
          {
            transform: `scale(.1) rotate(${spin * 3}deg)`,
            opacity: 1,
            easing: EASE_OUT,
          },
          {
            transform: `scale(1.18) rotate(${spin / 2}deg)`,
            opacity: 1,
            offset: 0.18,
            easing: EASE_POP,
          },
          {
            transform: "scale(1) rotate(0deg)",
            opacity: 1,
            offset: 0.32,
            easing: "linear",
          },
          {
            transform: "scale(1.04) rotate(0deg)",
            opacity: 1,
            offset: 0.82,
            easing: EASE_IN,
          },
          { transform: "scale(.6) rotate(8deg)", opacity: 0 },
        ],
        { duration: hold, delay, fill: "both" }
      ),
    ],
    props.done
  )
  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        left: props.x - props.size / 2,
        top: props.y - props.size / 2,
        width: props.size,
        height: props.size,
        zIndex: 40,
      }}
    >
      <svg
        viewBox="0 0 100 100"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          overflow: "visible",
        }}
      >
        <polygon
          points={points.current}
          fill={COLOR.blood}
          transform="translate(4 4)"
        />
        <polygon
          points={points.current}
          fill={fill}
          stroke={ink}
          strokeWidth={3.5}
          strokeLinejoin="miter"
        />
      </svg>
      {text ? (
        <span
          className="comic"
          style={
            {
              ...COMIC,
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              fontSize: props.size * (text.length > 6 ? 0.15 : 0.2),
              rotate: `${spin}deg`,
            } as React.CSSProperties
          }
        >
          {text}
        </span>
      ) : null}
    </div>
  )
}
