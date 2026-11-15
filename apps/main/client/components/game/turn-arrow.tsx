import { frame, cancelFrame } from "motion"
import { useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { play } from "@/client/components/canvas/play"
import { STAGE_LAYER } from "@/client/components/canvas/tokens"
import { curvedArrow } from "@/client/components/game/curved-arrow"

export type Line = { x1: number; y1: number; x2: number; y2: number }

/** 矢印の形。近接は低い弧の太い矢、遠距離は高い弧の細い矢と弾道の点。 */
export type ArrowStyle = "melee" | "ranged"

/**
 * 手番の仲間の札の中心から、狙う敵へ伸びる矢印。全体のワザは生きている敵すべてへ伸ばす。
 * 画面全体（.game）へ重ね、スキルの指示と下の隊列の札の後ろに置く。
 */
export type Props = {
  /** 矢印の根元になる要素（手番の仲間の札）。 */
  from: () => Element | null
  /** 矢印の先になる要素（狙う敵）。 */
  to: () => readonly Element[]
  arrowStyle: ArrowStyle
}

export function TurnArrow(props: Props) {
  const [root, setRoot] = useState<Element | null>(null)
  const [lines, setLines] = useState<readonly Line[]>([])
  const group = useRef<SVGGElement>(null)

  useLayoutEffect(() => {
    const measure = () => {
      const start = props.from()
      const ends = props.to()
      const game = start?.closest(".game")
      if (!start || !ends.length || !game) return setLines([])
      const base = game.getBoundingClientRect()
      const a = start.getBoundingClientRect()
      setRoot(game)
      const next = ends.map((end) => {
        const b = end.getBoundingClientRect()
        return {
          x1: a.left + a.width / 2 - base.left,
          y1: a.top + a.height / 2 - base.top,
          x2: b.left + b.width / 2 - base.left,
          y2: b.top + b.height * 0.55 - base.top,
        }
      })
      setLines((previous) =>
        previous.length === next.length &&
        next.every((line, index) =>
          (Object.keys(line) as (keyof Line)[]).every(
            (key) => Math.abs(previous[index][key] - line[key]) < 0.5
          )
        )
          ? previous
          : next
      )
    }
    measure()
    frame.postRender(measure, true)
    window.addEventListener("resize", measure)
    return () => {
      cancelFrame(measure)
      window.removeEventListener("resize", measure)
    }
  }, [props.from, props.to])

  const shapes = lines.flatMap((line, index) => {
    const shape = curvedArrow(line, props.arrowStyle, index)
    return shape ? [shape] : []
  })
  const origin = shapes[0]?.origin

  useLayoutEffect(() => {
    play(
      group.current,
      [
        { transform: "scale(0)", opacity: 0 },
        { transform: "scale(1.06)", opacity: 1, offset: 0.7 },
        { transform: "scale(1)", opacity: 1 },
      ],
      { duration: 360, easing: "cubic-bezier(.16,1,.3,1)", fill: "both" }
    )
  }, [root, props.from, props.to, props.arrowStyle, shapes.length])

  if (!root || !origin) return null
  return createPortal(
    <svg
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        zIndex: STAGE_LAYER.arrow,
        pointerEvents: "none",
        overflow: "visible",
      }}
    >
      <g ref={group} style={{ transformOrigin: `${origin.x}px ${origin.y}px` }}>
        {shapes.map((shape, index) => (
          <g key={index}>
            {/* 遠距離は弾道の点。軸に沿って曲がる */}
            {shape.dots.map((dot, at) => (
              <circle
                key={at}
                cx={dot.x}
                cy={dot.y}
                r={dot.r}
                fill="#eeebe3"
                stroke="#0b0c12"
                strokeWidth={2.5}
                paintOrder="stroke"
              />
            ))}
            <path
              d={shape.body}
              fill="#eeebe3"
              stroke="#0b0c12"
              strokeWidth={5}
              strokeLinejoin="round"
              paintOrder="stroke"
            />
          </g>
        ))}
      </g>
    </svg>,
    root
  )
}
