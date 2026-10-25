import { frame, cancelFrame } from "motion"
import { useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { play } from "@/components/canvas/play"
import { STAGE_LAYER } from "@/components/canvas/tokens"

type Line = { x1: number; y1: number; x2: number; y2: number }
/** 矢印の形。近接は低い弧の太い矢、遠距離は高い弧の細い矢と弾道の点。 */
export type ArrowStyle = "melee" | "ranged"

/**
 * 手番の仲間の札の中心から、狙う敵へ伸びる矢印。全体のワザは生きている敵すべてへ伸ばす。
 * 画面全体（.game）へ重ね、スキルの指示と下の隊列の札の後ろに置く。
 */
export function TurnArrow({
  from,
  to,
  arrowStyle,
}: {
  /** 矢印の根元になる要素（手番の仲間の札）。 */
  from: () => Element | null
  /** 矢印の先になる要素（狙う敵）。 */
  to: () => readonly Element[]
  arrowStyle: ArrowStyle
}) {
  const [root, setRoot] = useState<Element | null>(null)
  const [lines, setLines] = useState<readonly Line[]>([])
  const group = useRef<SVGGElement>(null)

  useLayoutEffect(() => {
    const measure = () => {
      const start = from()
      const ends = to()
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
  }, [from, to])

  const shapes = lines.flatMap((line, index) => {
    const shape = curvedArrow(line, arrowStyle, index)
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
  }, [root, from, to, arrowStyle, shapes.length])

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

type Point = { x: number; y: number }

/**
 * 弧を描く矢印の形。根元から先へ細→太にふくらむ軸と、曲がりの向きに沿った頭。
 * 根元は札の中心から少し離し、先は敵の手前で止める。
 */
function curvedArrow(line: Line, arrowStyle: ArrowStyle, index: number) {
  const ranged = arrowStyle === "ranged"
  const dx = line.x2 - line.x1
  const dy = line.y2 - line.y1
  const distance = Math.hypot(dx, dy)
  if (distance < 80) return null
  const unit = { x: dx / distance, y: dy / distance }
  // 進む向きの左手側へ、外へふくらむ弧にする
  const side = dx >= 0 ? -1 : 1
  const normal = { x: -unit.y * side, y: unit.x * side }
  const start = { x: line.x1 + unit.x * 30, y: line.y1 + unit.y * 30 }
  const end = { x: line.x2 - unit.x * 30, y: line.y2 - unit.y * 30 }
  const span = Math.hypot(end.x - start.x, end.y - start.y)
  // 遠距離は山なりに高く、全体のワザは矢ごとに少しずつ曲がりを変えて重ならないようにする
  const bend = span * ((ranged ? 0.42 : 0.2) + index * 0.06)
  const control = {
    x: (start.x + end.x) / 2 + normal.x * bend,
    y: (start.y + end.y) / 2 + normal.y * bend,
  }
  const at = (t: number): Point => ({
    x: (1 - t) ** 2 * start.x + 2 * (1 - t) * t * control.x + t ** 2 * end.x,
    y: (1 - t) ** 2 * start.y + 2 * (1 - t) * t * control.y + t ** 2 * end.y,
  })
  const tangent = (t: number): Point => {
    const x = 2 * (1 - t) * (control.x - start.x) + 2 * t * (end.x - control.x)
    const y = 2 * (1 - t) * (control.y - start.y) + 2 * t * (end.y - control.y)
    const size = Math.hypot(x, y) || 1
    return { x: x / size, y: y / size }
  }
  // 弧の長さで頭の付け根を決める
  const steps = 40
  const lengths = [0]
  for (let step = 1; step <= steps; step++) {
    const a = at((step - 1) / steps)
    const b = at(step / steps)
    lengths.push(lengths[step - 1] + Math.hypot(b.x - a.x, b.y - a.y))
  }
  const total = lengths[steps]
  const head = Math.min(ranged ? 42 : 60, total * 0.28)
  const neckStep = lengths.findIndex((length) => length >= total - head)
  const neck = neckStep / steps
  const sample = (from: number, to: number, count: number) =>
    Array.from(
      { length: count + 1 },
      (_, index) => from + ((to - from) * index) / count
    )
  const offset = (t: number, width: number): Point => {
    const point = at(t)
    const direction = tangent(t)
    return {
      x: point.x - direction.y * width,
      y: point.y + direction.x * width,
    }
  }
  // 軸の太さ：根元は細く、頭の手前で太る
  const widthAt = (t: number) =>
    ranged ? 2.5 + 3.5 * (t / neck) : 3 + 9 * Math.pow(t / neck, 1.4)
  // 遠距離は軸の前半を弾道の点にする
  const shaftFrom = ranged ? neck * 0.45 : 0
  const shaft = sample(shaftFrom, neck, 24)
  const upper = shaft.map((t) => offset(t, widthAt(t)))
  const lower = shaft.map((t) => offset(t, -widthAt(t))).reverse()
  const base = at(neck)
  const direction = tangent(neck)
  const across = { x: -direction.y, y: direction.x }
  const barb = ranged ? 18 : 28
  const tip = end
  // 頭の左右の返しは少し後ろへ流し、先へは外にふくらむ曲線で寄せる
  const barbOf = (sign: number): Point => ({
    x: base.x + across.x * barb * sign - direction.x * 10,
    y: base.y + across.y * barb * sign - direction.y * 10,
  })
  const curveOf = (sign: number): Point => ({
    x: (base.x + tip.x) / 2 + across.x * barb * 0.55 * sign,
    y: (base.y + tip.y) / 2 + across.y * barb * 0.55 * sign,
  })
  const left = barbOf(1)
  const right = barbOf(-1)
  const point = (value: Point) => `${value.x.toFixed(1)} ${value.y.toFixed(1)}`
  const body = [
    `M ${point(upper[0])}`,
    ...upper.slice(1).map((value) => `L ${point(value)}`),
    `L ${point(left)}`,
    `Q ${point(curveOf(1))} ${point(tip)}`,
    `Q ${point(curveOf(-1))} ${point(right)}`,
    ...lower.map((value) => `L ${point(value)}`),
    "Z",
  ].join(" ")
  const dots = ranged
    ? sample(0.04, shaftFrom * 0.92, 4).map((t, step) => ({
        ...at(t),
        r: 2.5 + step * 0.8,
      }))
    : []
  return { origin: start, body, dots }
}
