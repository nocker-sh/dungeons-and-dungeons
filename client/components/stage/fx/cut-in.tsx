import { after } from "@/client/components/canvas/after"
import { hold as pause } from "@/client/components/canvas/hold"
import { animationTiming } from "@/client/components/stage/timing"
import { letterDelay } from "@/client/components/stage/letter-delay"
import { useRef } from "react"
import { COLOR, EASE_OUT, EASE_POP } from "@/client/components/stage/kit"
import { play } from "@/client/components/canvas/play"
import { HalftoneDots } from "@/client/components/canvas/halftone-dots"
import { useRun } from "@/client/components/stage/fx/use-run"
import type { Done } from "@/client/components/stage/fx/use-run"

/** 画面を横切る帯に大きな文字を叩きつけるカットイン。入りは一瞬、真ん中でピタッと止まり、出るのも一瞬。 */
type Props = {
  text: string
  delay?: number
  hold?: number
  onStop?: () => void
} & Done

export function CutIn(props: Props) {
  const delay = props.delay === undefined ? 0 : props.delay
  const hold = props.hold === undefined ? animationTiming.cutIn : props.hold

  const band = useRef<HTMLDivElement>(null)
  const bandDots = useRef<HTMLSpanElement>(null)
  const topLine = useRef<HTMLDivElement>(null)
  const bottomLine = useRef<HTMLDivElement>(null)
  const ghost = useRef<HTMLDivElement>(null)
  const textBox = useRef<HTMLDivElement>(null)
  const letters = useRef<(HTMLSpanElement | null)[]>([])
  const ref = useRun(() => {
    const inT = 160 / hold
    const outT = 1 - 180 / hold
    const k = (a: string, b: string, d2: string): Keyframe[] => [
      { transform: `translateX(${a})`, easing: "cubic-bezier(.2,1.4,.4,1)" },
      { transform: `translateX(${b})`, offset: inT, easing: "steps(1, end)" },
      {
        transform: `translateX(${b})`,
        offset: outT,
        easing: "cubic-bezier(.7,0,1,.4)",
      },
      { transform: `translateX(${d2})` },
    ]
    const o = { duration: hold, delay, fill: "both" as const }
    const list = [
      play(band.current, k("-140%", "0%", "140%"), o),
      play(bandDots.current, k("-140%", "0%", "140%"), o),
      play(topLine.current, k("140%", "0%", "-140%"), o),
      play(bottomLine.current, k("140%", "0%", "-140%"), {
        ...o,
        delay: delay + 40,
      }),
      play(ghost.current, k("60%", "0%", "-260%"), o),
      play(textBox.current, k("140%", "0%", "-140%"), o),
    ]
    play(
      textBox.current,
      [{ scale: 1 }, { scale: 1.18, offset: 0.35 }, { scale: 1 }],
      {
        duration: 260,
        delay: delay + 160,
        easing: EASE_OUT,
      }
    )
    for (const [i, c] of letters.current.entries())
      play(
        c,
        [
          {
            opacity: 0,
            transform: `translateY(${i % 2 ? -0.5 : 0.5}em) rotate(${i % 2 ? 30 : -30}deg) scale(2.8)`,
            easing: EASE_POP,
          },
          { opacity: 1, transform: "none", offset: 1 },
        ],
        {
          duration: 280,
          delay: delay + 60 + letterDelay(i, props.text.length),
          fill: "both",
        }
      )
    if (props.onStop) after(pause(delay + 160), props.onStop)
    return list
  }, props.done)
  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: "30%",
        height: "34%",
        rotate: "-7deg",
      }}
    >
      <div
        ref={band}
        style={{
          position: "absolute",
          left: "-20%",
          right: "-20%",
          top: "12%",
          bottom: "12%",
          background: COLOR.paper,
        }}
      />
      <HalftoneDots
        ref={bandDots}
        color="rgb(11 12 18 / .35)"
        fade="linear-gradient(90deg, transparent 20%, #000 90%)"
        style={{ left: "-20%", right: "-20%", top: "12%", bottom: "12%" }}
      />
      <div
        ref={topLine}
        style={{
          position: "absolute",
          left: "-20%",
          right: "-20%",
          top: 0,
          height: "6%",
          background: COLOR.blood,
        }}
      />
      <div
        ref={bottomLine}
        style={{
          position: "absolute",
          left: "-20%",
          right: "-20%",
          bottom: 0,
          height: "3%",
          background: COLOR.ink,
        }}
      />
      <div
        ref={ghost}
        style={
          {
            position: "absolute",
            right: "-30%",
            top: "50%",
            translate: "0 -50%",
            fontSize: "calc(var(--u)*34)",
            lineHeight: 1,
            whiteSpace: "nowrap",
            color: "transparent",
            WebkitTextStroke: `2px ${COLOR.ink}`,
            opacity: 0.18,
          } as React.CSSProperties
        }
      >
        {props.text}
      </div>
      <div
        ref={textBox}
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "calc(var(--u)*16)",
          lineHeight: 1,
          color: COLOR.ink,
          whiteSpace: "nowrap",
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
              fontSize: `${i === 0 ? 1.2 : [0.9, 1, 0.86, 1.04][i % 4]}em`,
            }}
          >
            {c}
          </span>
        ))}
      </div>
    </div>
  )
}
