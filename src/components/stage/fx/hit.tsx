import { useRef } from "react"
import { COMIC } from "@/components/canvas/tokens"
import {
  COLOR,
  EASE_IN,
  EASE_OUT,
  EASE_POP,
  unitPx,
  randomBetween,
} from "@/components/stage/kit"
import { play } from "@/components/canvas/play"
import { useRun, type Done } from "@/components/stage/fx/use-run"

/** トゲトゲの爆発吹き出しに擬音を乗せる。 */
export function Burst({
  x,
  y,
  size,
  text = "",
  fill = COLOR.paper,
  ink = COLOR.ink,
  delay = 0,
  spin = -12,
  hold = 620,
  done,
}: {
  x: number
  y: number
  size: number
  text?: string
  fill?: string
  ink?: string
  delay?: number
  spin?: number
  hold?: number
} & Done) {
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
    done
  )
  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
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
              fontSize: size * (text.length > 6 ? 0.15 : 0.2),
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

/** 角ばった破片をまき散らす。 */
export function Shards({
  x,
  y,
  n = 14,
  colors = [COLOR.paper, COLOR.blood, COLOR.ink],
  power = 1,
  delay = 0,
  done,
}: {
  x: number
  y: number
  n?: number
  colors?: readonly string[]
  power?: number
  delay?: number
} & Done) {
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
  }, done)
  return (
    <div ref={ref} style={{ position: "absolute", inset: 0, zIndex: 40 }}>
      {parts.current.map((p, i) => (
        <i
          key={i}
          style={{
            position: "absolute",
            left: x,
            top: y,
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

/** 三本の斬撃。 */
export function Slash({
  x,
  y,
  size,
  delay = 0,
  done,
}: { x: number; y: number; size: number; delay?: number } & Done) {
  const strokes = useRef<(SVGPathElement | null)[]>([])
  const ref = useRun(
    () =>
      strokes.current.map((path, i) =>
        play(
          path,
          [
            { strokeDashoffset: 1, opacity: 1 },
            { strokeDashoffset: 0, opacity: 1, offset: 0.35 },
            { strokeDashoffset: 0, opacity: 0 },
          ],
          {
            duration: 480,
            delay: delay + i * 45,
            easing: EASE_OUT,
            fill: "both",
          }
        )
      ),
    done
  )
  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
      }}
    >
      <svg
        viewBox="0 0 100 100"
        style={{ width: "100%", height: "100%", overflow: "visible" }}
      >
        {[0, 1, 2].map((i) => (
          <path
            key={i}
            ref={(element) => {
              strokes.current[i] = element
            }}
            d={`M${-5 + i * 14} ${-8 + i * 10} L${105 - i * 8} ${108 - i * 12}`}
            stroke={COLOR.paper}
            strokeWidth={i === 1 ? 7 : 3}
            strokeLinecap="butt"
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={1}
            fill="none"
          />
        ))}
      </svg>
    </div>
  )
}
