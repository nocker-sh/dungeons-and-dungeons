import { useStage } from "@/client/components/stage/use-stage"
import { useLeaving } from "@/client/components/stage/use-leaving"
import { animationTiming } from "@/client/components/stage/timing"
import { letterDelay } from "@/client/components/stage/letter-delay"
import { useEffect, useLayoutEffect, useRef } from "react"
import { COLOR, EASE_IN, EASE_POP } from "@/client/components/stage/kit"
import { play } from "@/client/components/canvas/play"

/** 見出しの文字を一字ずつ回しながら叩きつける。 */
type Props = {
  text: string
  left?: string
  top?: string
  size?: number
  delay?: number
  rotate?: number
}

export function SlamTitle(props: Props) {
  const left = props.left === undefined ? "5%" : props.left
  const top = props.top === undefined ? "8%" : props.top
  const size = props.size === undefined ? 30 : props.size
  const delay = props.delay === undefined ? 0 : props.delay
  const rotate = props.rotate === undefined ? 0 : props.rotate

  const ref = useRef<HTMLDivElement>(null)
  const letters = useRef<(HTMLSpanElement | null)[]>([])
  const leaving = useLeaving()
  const stage = useStage()
  useLayoutEffect(() => {
    for (const [i, s] of letters.current.entries())
      play(
        s,
        [
          {
            opacity: 0,
            transform: `translateY(${i % 2 ? -0.6 : 0.6}em) rotate(${i % 2 ? 30 : -30}deg) scale(3)`,
          },
          { opacity: 1, offset: 0.2 },
          { opacity: 1, transform: "none" },
        ],
        {
          duration: animationTiming.enter,
          delay: delay + letterDelay(i, props.text.length),
          easing: EASE_POP,
          fill: "both",
        }
      )
    // 入場は一度だけ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    if (leaving)
      stage.exits.track(
        play(
          ref.current,
          [
            { transform: "none" },
            { transform: "translateX(-120vw) rotate(-20deg)" },
          ],
          { duration: animationTiming.exit, easing: EASE_IN, fill: "both" }
        )
      )
  }, [leaving])
  return (
    <div
      ref={ref}
      aria-hidden="true"
      style={{
        position: "absolute",
        left,
        top,
        rotate: `${rotate}deg`,
        transformOrigin: "0 100%",
        fontSize: `calc(var(--u)*${size})`,
        lineHeight: 1,
        color: COLOR.mist,
        textShadow: `calc(var(--u)*1.4) calc(var(--u)*1.4) 0 ${COLOR.ink}`,
        pointerEvents: "none",
      }}
    >
      {Array.from(props.text).map((c, i) => (
        <span
          key={i}
          ref={(element) => {
            letters.current[i] = element
          }}
          style={{
            display: "inline-block",
            rotate: `${[-6, 4, -2, 7, -4][i % 5]}deg`,
            scale: `${[1.1, 0.88, 1, 0.94, 1.06][i % 5]}`,
            translate: `0 ${[0, -0.08, 0.06, -0.04, 0.1][i % 5]}em`,
          }}
        >
          {c}
        </span>
      ))}
    </div>
  )
}
