import { after, hold as pause } from "@/components/canvas/animation"
import { animationTiming, letterDelay } from "@/components/stage/timing"
import { useRef } from "react"
import { Ransom } from "@/components/stage/ransom"
import { COMIC, IMG_BASE } from "@/components/canvas/tokens"
import {
  COLOR,
  EASE_IN,
  EASE_OUT,
  EASE_POP,
  randomBetween,
} from "@/components/stage/kit"
import { play } from "@/components/canvas/play"
import { HalftoneDots } from "@/components/canvas/paper"
import { useRun, type Done } from "@/components/stage/fx/use-run"

/** 画面を横切る帯に大きな文字を叩きつけるカットイン。入りは一瞬、真ん中でピタッと止まり、出るのも一瞬。 */
export function CutIn({
  text,
  delay = 0,
  hold = animationTiming.cutIn,
  onStop,
  done,
}: {
  text: string
  delay?: number
  hold?: number
  onStop?: () => void
} & Done) {
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
          delay: delay + 60 + letterDelay(i, text.length),
          fill: "both",
        }
      )
    if (onStop) after(pause(delay + 160), onStop)
    return list
  }, done)
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
        {text}
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
        {Array.from(text).map((c, i) => (
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

/** ワザの立ち絵カットイン：縦の白いスピード線の中を、下から一気に上がり、少し止まって、上へ抜ける。 */
export function SpecialCutIn({
  img,
  fx,
  name,
  wide,
  merge,
  done,
}: {
  img: string
  fx: number
  name: string
  wide: boolean
  merge?: string
} & Done) {
  const lines = useRef<
    { x: number; w: number; h: number; o: number; dur: number; delay: number }[]
  >([])
  if (!lines.current.length)
    for (let i = 0; i < 26; i++)
      lines.current.push({
        x: randomBetween(0, 100),
        w: randomBetween(0.3, 2.2),
        h: randomBetween(30, 90),
        o: randomBetween(0.35, 0.95),
        dur: randomBetween(180, 420),
        delay: randomBetween(-400, 0),
      })
  const backdrop = useRef<HTMLDivElement>(null)
  const lineBox = useRef<HTMLDivElement>(null)
  const lineParts = useRef<(HTMLElement | null)[]>([])
  const figure = useRef<HTMLImageElement>(null)
  const skillName = useRef<HTMLDivElement>(null)
  const ref = useRun(() => {
    for (const [i, line] of lineParts.current.entries())
      play(
        line,
        [
          { transform: "translateY(110vh)" },
          { transform: "translateY(-100vh)" },
        ],
        {
          duration: lines.current[i].dur,
          delay: lines.current[i].delay,
          iterations: Infinity,
        }
      )
    play(
      backdrop.current,
      [
        { opacity: 0 },
        { opacity: 0.9, offset: 0.12 },
        { opacity: 0.9, offset: 0.85 },
        { opacity: 0 },
      ],
      { duration: animationTiming.special, fill: "both" }
    )
    play(
      lineBox.current,
      [
        { opacity: 0 },
        { opacity: 1, offset: 0.1 },
        { opacity: 1, offset: 0.85 },
        { opacity: 0 },
      ],
      { duration: animationTiming.special, fill: "both" }
    )
    play(
      figure.current,
      [
        { transform: "translateY(100%)", easing: EASE_OUT },
        { transform: "translateY(3%)", offset: 0.22, easing: "linear" },
        { transform: "translateY(0%)", offset: 0.78, easing: EASE_IN },
        { transform: "translateY(-130%)" },
      ],
      { duration: animationTiming.special, fill: "both" }
    )
    play(
      skillName.current,
      [
        { transform: "translateX(80vw) scale(1.4)", easing: EASE_OUT },
        { transform: "none", offset: 0.25, easing: "linear" },
        { transform: "translateX(-2vw)", offset: 0.78, easing: EASE_IN },
        { transform: "translateX(-120vw)" },
      ],
      { duration: animationTiming.special, fill: "both" }
    )
    return []
  }, done)
  return (
    <div
      ref={ref}
      style={{ position: "absolute", inset: 0, zIndex: 31, overflow: "hidden" }}
    >
      <div
        ref={backdrop}
        style={{ position: "absolute", inset: 0, background: COLOR.ink }}
      />
      <div ref={lineBox} style={{ position: "absolute", inset: 0 }}>
        {lines.current.map((line, i) => (
          <i
            key={i}
            ref={(element) => {
              lineParts.current[i] = element
            }}
            style={{
              position: "absolute",
              left: `${line.x}%`,
              top: 0,
              width: `${line.w}vw`,
              height: `${line.h}vh`,
              background: COLOR.paper,
              opacity: line.o,
            }}
          />
        ))}
      </div>
      <HalftoneDots
        color={COLOR.ink}
        fade="linear-gradient(90deg, #000, transparent 35%, transparent 65%, #000)"
        gap="8px 8px"
        radius={["38%", "40%"]}
      />
      <img
        ref={figure}
        src={img}
        alt=""
        style={{
          ...IMG_BASE,
          position: "absolute",
          left: `${wide ? 38 : 50}%`,
          top: merge ? "4%" : "-2%",
          height: `${merge ? (wide ? 90 : 75) : wide ? 170 : 130}%`,
          translate: `calc(${merge ? 0.5 : fx} * -100%) 0`,
          filter: `drop-shadow(calc(var(--u)*1.4) calc(var(--u)*1.4) 0 ${COLOR.blood})`,
        }}
      />
      {merge ? (
        <>
          <div
            className="comic"
            style={{
              ...COMIC,
              position: "absolute",
              left: "4%",
              top: wide ? "12%" : "4%",
              fontSize: "calc(var(--u)*5)",
              rotate: "-8deg",
            }}
          >
            MERGE!
          </div>
          <div
            style={{
              position: "absolute",
              left: "4%",
              top: wide ? "22%" : "11%",
              padding: ".1em .5em",
              background: COLOR.blood,
              color: COLOR.paper,
              fontSize: `calc(var(--u)*${wide ? 3 : 3.4})`,
              rotate: "-6deg",
            }}
          >
            {merge}
          </div>
        </>
      ) : null}
      <div
        ref={skillName}
        style={{
          position: "absolute",
          ...(wide ? { right: "4%", top: "40%" } : { left: "4%", top: "19%" }),
          rotate: "-8deg",
          whiteSpace: "nowrap",
        }}
      >
        <Ransom text={name} size={wide ? 11 : 9} />
      </div>
    </div>
  )
}
