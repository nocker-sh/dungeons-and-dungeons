import { useLayoutEffect, useRef } from "react"
import type { CSSProperties } from "react"
import { COLOR, EASE_POP } from "@/client/components/stage/kit"
import { play } from "@/client/components/canvas/play"

/** 切り抜いた文字を貼り合わせた見出しの一枚ずつの形。順番に使い回す。 */
export const CUTS = [
  "polygon(4% 0, 100% 8%, 94% 100%, 0 90%)",
  "polygon(0 6%, 92% 0, 100% 94%, 8% 100%)",
  "polygon(10% 0, 100% 0, 90% 100%, 0 96%)",
  "polygon(0 0, 96% 10%, 100% 100%, 4% 88%)",
  "polygon(6% 10%, 100% 0, 96% 90%, 0 100%)",
]

export const TILT = [-8, 6, -3, 10, -6, 3, -11, 5]

export const LIFT = [0, -0.14, 0.1, -0.06, 0.16, -0.12, 0.04]

export const SCALE = [1.14, 0.86, 1, 0.92, 1.08, 0.82, 0.98]

export type Tone = readonly [background: string, color: string]

export const TONES: Record<"blood" | "paper" | "ink", readonly Tone[]> = {
  blood: [
    [COLOR.blood, COLOR.paper],
    [COLOR.paper, COLOR.ink],
    [COLOR.ink, COLOR.paper],
    [COLOR.paper, COLOR.blood],
  ],
  paper: [
    [COLOR.paper, COLOR.ink],
    [COLOR.ink, COLOR.paper],
    [COLOR.paper, COLOR.blood],
    [COLOR.blood, COLOR.paper],
  ],
  ink: [
    [COLOR.ink, COLOR.paper],
    [COLOR.paper, COLOR.ink],
    [COLOR.blood, COLOR.paper],
    [COLOR.paper, COLOR.blood],
  ],
}

/**
 * 見出し：一文字ずつ別の紙から切り抜いたように、色・傾き・大きさ・高さを崩して並べる。
 * 並びは文字の位置で決まり、開くたびに変わらない。
 */
type Props = {
  text: string
  size: number
  tone?: keyof typeof TONES
  delay?: number
  style?: CSSProperties
}

export function Ransom(props: Props) {
  const tone = props.tone === undefined ? "paper" : props.tone
  const delay = props.delay === undefined ? 0 : props.delay

  const cuts = useRef<(HTMLSpanElement | null)[]>([])
  useLayoutEffect(() => {
    for (const [i, cut] of cuts.current.entries())
      play(
        cut,
        [
          {
            opacity: 0,
            transform: `scale(2.4) rotate(${i % 2 ? 24 : -24}deg)`,
          },
          { opacity: 1, offset: 0.25 },
          { opacity: 1, transform: "none" },
        ],
        {
          duration: 420,
          delay: delay + i * 45,
          easing: EASE_POP,
          fill: "backwards",
        }
      )
    // 入場は一度だけ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const tones = TONES[tone]
  let n = 0
  return (
    <span
      role="heading"
      aria-label={props.text}
      style={{
        display: "inline-flex",
        alignItems: "center",
        flexWrap: "nowrap",
        whiteSpace: "nowrap",
        fontSize: `calc(var(--u)*${props.size})`,
        lineHeight: 1,
        ...props.style,
      }}
    >
      {Array.from(props.text).map((char, i) => {
        if (char.trim() === "")
          return <span key={i} aria-hidden="true" style={{ width: ".35em" }} />
        const k = n++
        const [background, color] = tones[k % tones.length]
        return (
          <span
            key={i}
            aria-hidden="true"
            ref={(element) => {
              cuts.current[k] = element
            }}
            style={{
              display: "inline-block",
              marginLeft: k ? "-.04em" : 0,
              padding: ".12em .14em .1em",
              background,
              color,
              fontWeight: 900,
              rotate: `${TILT[k % TILT.length]}deg`,
              translate: `0 ${LIFT[k % LIFT.length]}em`,
              scale: `${SCALE[k % SCALE.length]}`,
              clipPath: CUTS[k % CUTS.length],
            }}
          >
            {char}
          </span>
        )
      })}
    </span>
  )
}
