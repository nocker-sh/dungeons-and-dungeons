import { useRef } from "react"
import { COLOR, EASE_OUT } from "@/client/components/stage/kit"
import { play } from "@/client/components/canvas/play"
import { useRun } from "@/client/components/stage/fx/use-run"
import type { Done } from "@/client/components/stage/fx/use-run"

/** 三本の斬撃。 */
type Props = { x: number; y: number; size: number; delay?: number } & Done

export function Slash(props: Props) {
  const delay = props.delay === undefined ? 0 : props.delay

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
