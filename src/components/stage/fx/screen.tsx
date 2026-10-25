import { useRef } from "react"
import { COLOR, EASE_IN, EASE_OUT, randomBetween } from "@/components/stage/kit"
import { play } from "@/components/canvas/play"
import { HalftoneDots } from "@/components/canvas/paper"
import { useRun, type Done } from "@/components/stage/fx/use-run"

export function Flash({
  color = COLOR.mist,
  strength = 0.6,
  done,
}: { color?: string; strength?: number } & Done) {
  const ref = useRun(
    (el) => [
      play(el, [{ opacity: strength }, { opacity: 0 }], {
        duration: 380,
        easing: EASE_OUT,
        fill: "both",
      }),
    ],
    done
  )
  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        inset: 0,
        background: color,
        mixBlendMode: "screen",
      }}
    />
  )
}

/** 画面の縁から中心へ向かう集中線。 */
export function FocusLines({
  cx,
  cy,
  width,
  height,
  dur = 420,
  color = COLOR.paper,
  delay = 0,
  count = 46,
  done,
}: {
  cx: number
  cy: number
  width: number
  height: number
  dur?: number
  color?: string
  delay?: number
  count?: number
} & Done) {
  const d = useRef("")
  if (!d.current) {
    const R = Math.hypot(width, height)
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + randomBetween(-0.05, 0.05)
      const inner = randomBetween(0.18, 0.34) * Math.min(width, height)
      const w = randomBetween(0.006, 0.02)
      const x1 = cx + Math.cos(a) * R
      const y1 = cy + Math.sin(a) * R
      const x2 = cx + Math.cos(a - w) * inner
      const y2 = cy + Math.sin(a - w) * inner
      const x3 = cx + Math.cos(a + w) * inner
      const y3 = cy + Math.sin(a + w) * inner
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
    done
  )
  return (
    <div ref={ref} style={{ position: "absolute", inset: 0, zIndex: 39 }}>
      <svg style={{ width: "100%", height: "100%" }}>
        <path d={d.current} fill={color} />
      </svg>
    </div>
  )
}

/** 刃の束のような斜めの黒帯。左右から交互に閉じ、閃光のあと逆へ開く。 */
export function Blades({
  glow,
  closed,
  open,
  done,
}: { glow: string; closed: () => void; open: Promise<void> } & Done) {
  const ref = useRun((root, scope) => {
    const rows = [...root.children] as HTMLElement[]
    const shut = rows.map((row, i) =>
      play(
        row,
        [
          { transform: `translateX(${i % 2 ? -110 : 110}%)` },
          { transform: "none" },
        ],
        { duration: 340, delay: i * 35, easing: EASE_IN, fill: "both" }
      )
    )
    const all = Promise.all(shut.map((a) => a.finished))
      .then(() => {
        scope.assertActive()
        closed()
        return open
      })
      .then(() =>
        scope.capture(() =>
          Promise.all(
            rows.map(
              (row, i) =>
                play(
                  row,
                  [
                    { transform: "none" },
                    { transform: `translateX(${i % 2 ? 110 : -110}%)` },
                  ],
                  {
                    duration: 420,
                    delay: (6 - i) * 30,
                    easing: EASE_OUT,
                    fill: "both",
                  }
                ).finished
            )
          )
        )
      )
    return [all]
  }, done)
  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        inset: "-30% -20%",
        rotate: "-14deg",
        display: "grid",
        gridTemplateRows: "repeat(7,1fr)",
      }}
    >
      {Array.from({ length: 7 }, (_, i) => (
        <div
          key={i}
          style={{
            position: "relative",
            background: COLOR.ink,
            margin: "-1px 0",
            overflow: "hidden",
            transform: `translateX(${i % 2 ? -110 : 110}%)`,
          }}
        >
          <HalftoneDots
            color="rgb(238 235 227 / .16)"
            fade={`linear-gradient(${i % 2 ? 90 : 270}deg, transparent 30%, #000)`}
          />
          <b
            style={{
              position: "absolute",
              [i % 2 ? "left" : "right"]: 0,
              top: 0,
              bottom: 0,
              width: "1.2vh",
              background: i === 3 ? glow : COLOR.paper,
            }}
          />
        </div>
      ))}
    </div>
  )
}
