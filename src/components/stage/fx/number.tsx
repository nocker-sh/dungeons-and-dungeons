import { after, tween } from "@/components/canvas/animation"
import { animationTiming } from "@/components/stage/timing"
import { COLOR, EASE_IN, EASE_OUT } from "@/components/stage/kit"
import { play } from "@/components/canvas/play"
import { useRun, type Done } from "@/components/stage/fx/use-run"

/** 大きな文字を叩きつけて、上へ抜ける。 */
export function NumberAt({
  x,
  y,
  text,
  size = 18,
  color = COLOR.paper,
  delay = 0,
  done,
}: {
  x: number
  y: number
  text: string
  size?: number
  color?: string
  delay?: number
} & Done) {
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
    done
  )
  return (
    <div
      ref={ref}
      style={
        {
          position: "absolute",
          left: x,
          top: y,
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
      {text}
    </div>
  )
}

/** ダメージ数：0から一気に数え上がって叩きつけ、揺れてから狙った先（敵の体力の数字）へ吸い込まれる。 */
export function DamageAt({
  x,
  y,
  value,
  big = false,
  delay = 0,
  to,
  done,
}: {
  x: number
  y: number
  value: number
  big?: boolean
  delay?: number
  to?: { x: number; y: number }
} & Done) {
  const ref = useRun((el) => {
    const tx = (to?.x ?? x) - x
    const ty = (to?.y ?? y - 80) - y
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
      value,
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
  }, done)
  return (
    <div
      ref={ref}
      style={
        {
          position: "absolute",
          left: x,
          top: y,
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
