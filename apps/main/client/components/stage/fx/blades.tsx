import { COLOR, EASE_IN, EASE_OUT } from "@/client/components/stage/kit"
import { play } from "@/client/components/canvas/play"
import { HalftoneDots } from "@/client/components/canvas/halftone-dots"
import { useRun } from "@/client/components/stage/fx/use-run"
import type { Done } from "@/client/components/stage/fx/use-run"

/** 刃の束のような斜めの黒帯。左右から交互に閉じ、閃光のあと逆へ開く。 */
type Props = { glow: string; closed: () => void; open: Promise<void> } & Done

export function Blades(props: Props) {
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
        props.closed()
        return props.open
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
  }, props.done)
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
              background: i === 3 ? props.glow : COLOR.paper,
            }}
          />
        </div>
      ))}
    </div>
  )
}
