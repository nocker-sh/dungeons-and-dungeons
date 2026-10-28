import { after } from "@/client/components/canvas/after"
import { tween } from "@/client/components/canvas/tween"
import { animationTiming } from "@/client/components/stage/timing"
import { COLOR, EASE_IN, EASE_OUT } from "@/client/components/stage/kit"
import { play } from "@/client/components/canvas/play"
import { useRun } from "@/client/components/stage/fx/use-run"
import type { Done } from "@/client/components/stage/fx/use-run"

/** ダメージ数：0から一気に数え上がって叩きつけ、揺れてから狙った先（敵の体力の数字）へ吸い込まれる。 */
type Props = {
  x: number
  y: number
  value: number
  big?: boolean
  delay?: number
  to?: { x: number; y: number }
} & Done

export function DamageAt(props: Props) {
  const big = props.big === undefined ? false : props.big
  const delay = props.delay === undefined ? 0 : props.delay

  const ref = useRun((el) => {
    const tx = (props.to?.x ?? props.x) - props.x
    const ty = (props.to?.y ?? props.y - 80) - props.y
    const main = play(
      el,
      [
        {
          transform: "scale(.2) rotate(-30deg)",
          opacity: 0,
          easing: "cubic-bezier(.2,1.6,.4,1)",
        },
        {
          transform: "scale(1.25) rotate(-8deg)",
          opacity: 1,
          offset: 0.16,
          easing: EASE_OUT,
        },
        {
          transform: "scale(1) rotate(-6deg)",
          opacity: 1,
          offset: 0.26,
          easing: "steps(1, end)",
        },
        {
          transform: "scale(1) rotate(-6deg)",
          opacity: 1,
          offset: 0.62,
          easing: EASE_IN,
        },
        {
          transform: `translate(${tx}px, ${ty}px) scale(.25) rotate(10deg)`,
          opacity: 0.9,
        },
      ],
      { duration: animationTiming.damage, delay, fill: "both" }
    )
    const count = tween(
      0,
      props.value,
      animationTiming.hp,
      (current) => {
        el.textContent = String(Math.round(current))
      },
      { delay }
    )
    const shake = after(count, () =>
      play(
        el,
        [
          { translate: "-50% -50%" },
          { translate: "calc(-50% - 6px) calc(-50% + 3px)" },
          { translate: "calc(-50% + 5px) calc(-50% - 3px)" },
          { translate: "-50% -50%" },
        ],
        { duration: 160, iterations: 2 }
      )
    )
    return [main, count, shake]
  }, props.done)
  return (
    <div
      ref={ref}
      style={
        {
          position: "absolute",
          left: props.x,
          top: props.y,
          translate: "-50% -50%",
          zIndex: 42,
          fontSize: `calc(var(--u)*${big ? 26 : 20})`,
          lineHeight: 1,
          color: COLOR.paper,
          WebkitTextStroke: `.06em ${COLOR.ink}`,
          paintOrder: "stroke fill",
          textShadow: `.05em .05em 0 ${COLOR.ink},.09em .09em 0 ${COLOR.blood},.13em .13em 0 ${COLOR.ink}`,
          fontVariantNumeric: "tabular-nums",
          whiteSpace: "nowrap",
        } as React.CSSProperties
      }
    >
      0
    </div>
  )
}
