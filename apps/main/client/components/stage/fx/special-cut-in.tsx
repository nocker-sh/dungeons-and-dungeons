import { animationTiming } from "@/client/components/stage/timing"
import { useRef } from "react"
import { Ransom } from "@/client/components/stage/ransom"
import { COMIC, IMG_BASE } from "@/client/components/canvas/tokens"
import { COLOR, EASE_IN, EASE_OUT } from "@/client/components/stage/kit"
import { randomBetween } from "@/client/components/stage/random-between"
import { play } from "@/client/components/canvas/play"
import { HalftoneDots } from "@/client/components/canvas/halftone-dots"
import { useRun } from "@/client/components/stage/fx/use-run"
import type { Done } from "@/client/components/stage/fx/use-run"

/** ワザの立ち絵カットイン：縦の白いスピード線の中を、下から一気に上がり、少し止まって、上へ抜ける。 */
type Props = {
  img: string
  fx: number
  name: string
  wide: boolean
  merge?: string
} & Done

export function SpecialCutIn(props: Props) {
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
  }, props.done)
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
        src={props.img}
        alt=""
        style={{
          ...IMG_BASE,
          position: "absolute",
          left: `${props.wide ? 38 : 50}%`,
          top: props.merge ? "4%" : "-2%",
          height: `${props.merge ? (props.wide ? 90 : 75) : props.wide ? 170 : 130}%`,
          translate: `calc(${props.merge ? 0.5 : props.fx} * -100%) 0`,
          filter: `drop-shadow(calc(var(--u)*1.4) calc(var(--u)*1.4) 0 ${COLOR.blood})`,
        }}
      />
      {props.merge ? (
        <>
          <div
            className="comic"
            style={{
              ...COMIC,
              position: "absolute",
              left: "4%",
              top: props.wide ? "12%" : "4%",
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
              top: props.wide ? "22%" : "11%",
              padding: ".1em .5em",
              background: COLOR.blood,
              color: COLOR.paper,
              fontSize: `calc(var(--u)*${props.wide ? 3 : 3.4})`,
              rotate: "-6deg",
            }}
          >
            {props.merge}
          </div>
        </>
      ) : null}
      <div
        ref={skillName}
        style={{
          position: "absolute",
          ...(props.wide
            ? { right: "4%", top: "40%" }
            : { left: "4%", top: "19%" }),
          rotate: "-8deg",
          whiteSpace: "nowrap",
        }}
      >
        <Ransom text={props.name} size={props.wide ? 11 : 9} />
      </div>
    </div>
  )
}
