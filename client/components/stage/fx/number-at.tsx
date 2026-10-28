import { animationTiming } from "@/client/components/stage/timing"
import { COLOR, EASE_OUT } from "@/client/components/stage/kit"
import { play } from "@/client/components/canvas/play"
import { useRun } from "@/client/components/stage/fx/use-run"
import type { Done } from "@/client/components/stage/fx/use-run"

/** 大きな文字を叩きつけて、上へ抜ける。 */
type Props = {
  x: number
  y: number
  text: string
  size?: number
  color?: string
  delay?: number
} & Done

export function NumberAt(props: Props) {
  const size = props.size === undefined ? 18 : props.size
  const color = props.color === undefined ? COLOR.paper : props.color
  const delay = props.delay === undefined ? 0 : props.delay

  const ref = useRun(
    (el) => [
      play(
        el,
        [
          {
            easing: EASE_OUT,
            transform: "scale(4) rotate(-20deg)",
            opacity: 0,
          },
          { transform: "scale(1) rotate(-6deg)", opacity: 1, offset: 0.2 },
          { transform: "rotate(-6deg)", opacity: 1, offset: 0.75 },
          { transform: "translateY(-6vh) rotate(-6deg)", opacity: 0 },
        ],
        { duration: animationTiming.number, delay, fill: "both" }
      ),
    ],
    props.done
  )
  return (
    <div
      ref={ref}
      style={
        {
          position: "absolute",
          left: props.x,
          top: props.y,
          translate: "-50% -50%",
          fontSize: `calc(var(--u)*${size})`,
          lineHeight: 1,
          color,
          WebkitTextStroke: `.05em ${COLOR.ink}`,
          paintOrder: "stroke fill",
          textShadow: `.06em .06em 0 ${COLOR.blood}`,
          whiteSpace: "nowrap",
          zIndex: 41,
        } as React.CSSProperties
      }
    >
      {props.text}
    </div>
  )
}
