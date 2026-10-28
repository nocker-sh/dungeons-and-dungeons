import { after } from "@/client/components/canvas/after"
import { useAnimationEffect } from "@/client/components/canvas/use-animation-effect"
import { animationTiming } from "@/client/components/stage/timing"
import { useRef } from "react"
import { GoodIcon } from "@/client/components/game/good-icon"
import { COLOR, EASE_OUT } from "@/client/components/stage/kit"
import { useFx } from "@/client/components/stage/use-fx"
import { useWide } from "@/client/components/stage/use-wide"
import { BUTTON_BASE } from "@/client/components/canvas/tokens"
import { play } from "@/client/components/canvas/play"
import type { LootItem } from "@/client/components/game/loot-shared"

/** 当たりの品の色。 */
export const RARE_GOLD = "#b8901c"

type Props = {
  item: LootItem
  index: number
  place: { left: string; top: string; r: number; s: number }
  onOpen: () => void
}

export function LootCard(props: Props) {
  const ref = useRef<HTMLButtonElement>(null)
  const fx = useFx()
  const wide = useWide()
  useAnimationEffect(() => {
    const entrance = play(
      ref.current,
      [
        {
          easing: EASE_OUT,
          transform: "translateX(90vw) rotate(30deg) scale(1.4)",
        },
        { transform: "translateX(-2vw) scale(1.05)", offset: 0.7 },
        { transform: "none" },
      ],
      {
        duration: animationTiming.enter,
        delay: animationTiming.feedback + props.index * animationTiming.stagger,
        fill: "both",
      }
    )
    after(entrance, () => {
      const c = fx.center(ref.current?.firstElementChild ?? null)
      fx.burst(c.x, c.y, c.w * (props.item.rare ? 2.2 : 1.5), "", {
        fill: props.item.rare ? RARE_GOLD : COLOR.blood,
        ink: COLOR.paper,
        hold: props.item.rare ? 800 : 520,
      })
      fx.shards(c.x, c.y, {
        n: props.item.rare ? 30 : 10,
        power: props.item.rare ? 2 : 0.8,
        ...(props.item.rare
          ? { colors: [RARE_GOLD, COLOR.paper, COLOR.ink] }
          : {}),
      })
      if (props.item.rare) fx.flash(RARE_GOLD, 0.6)
      fx.shake(props.item.rare ? 1.2 : 0.4)
    })
  }, [fx, props.index, props.item.rare])
  return (
    <button
      ref={ref}
      type="button"
      className="slot-item"
      aria-label={`${props.item.name} ${props.item.n}`}
      onClick={props.onOpen}
      style={{
        ...BUTTON_BASE,
        position: "absolute",
        left: props.place.left,
        top: props.place.top,
        rotate: `${props.place.r}deg`,
        textAlign: "left",
        pointerEvents: "auto",
      }}
    >
      <span
        style={{
          position: "relative",
          display: "block",
          width: `calc(var(--u)*${props.place.s})`,
          aspectRatio: 1.05,
          filter: `drop-shadow(calc(var(--u)*1) calc(var(--u)*1) 0 ${props.item.rare ? RARE_GOLD : COLOR.blood})`,
        }}
      >
        <span
          style={{
            position: "absolute",
            inset: 0,
            background: COLOR.paper,
            clipPath:
              "polygon(6% 10%, 62% 0, 100% 14%, 94% 86%, 40% 100%, 0 88%)",
          }}
        />
        <span
          style={{
            position: "absolute",
            inset: "calc(var(--u)*.9)",
            display: "grid",
            placeItems: "center",
            background: COLOR.ink,
            clipPath:
              "polygon(6% 10%, 62% 0, 100% 14%, 94% 86%, 40% 100%, 0 88%)",
          }}
        >
          <GoodIcon id={props.item.icon} iconSize="60%" />
        </span>
      </span>
      <span
        style={{
          position: "absolute",
          left: "62%",
          top: "58%",
          whiteSpace: "nowrap",
          width: `calc(var(--u)*${wide ? 24 : 32})`,
        }}
      >
        <span
          style={
            {
              display: "block",
              fontSize: `calc(var(--u)*${wide ? 6 : 7})`,
              lineHeight: 1,
              color: COLOR.paper,
              WebkitTextStroke: `.06em ${COLOR.ink}`,
              paintOrder: "stroke fill",
              textShadow: `.06em .06em 0 ${COLOR.blood}`,
            } as React.CSSProperties
          }
        >
          {props.item.n}
        </span>
        <span
          style={{
            display: "inline-block",
            marginTop: ".2em",
            padding: ".05em .5em",
            background: COLOR.paper,
            color: COLOR.ink,
            fontSize: "max(12px, calc(var(--u)*2.6))",
            maxWidth: `calc(var(--u)*${wide ? 24 : 32})`,
            boxSizing: "border-box",
            whiteSpace: "normal",
            overflowWrap: "anywhere",
          }}
        >
          {props.item.name}
        </span>
      </span>
    </button>
  )
}
