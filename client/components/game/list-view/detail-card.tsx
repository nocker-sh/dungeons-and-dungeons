import { useLayoutEffect, useRef } from "react"
import { GoodIcon } from "@/client/components/game/good-icon"
import { COLOR, EASE_POP } from "@/client/components/stage/kit"
import { useWide } from "@/client/components/stage/use-wide"
import { play } from "@/client/components/canvas/play"
import type { Row } from "@/client/components/game/list-view/types"
import { RarityBadge } from "@/client/components/game/list-view/rarity-badge"

type Props = { row: Row }

export function DetailCard(props: Props) {
  const wide = useWide()
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    play(
      ref.current,
      [
        { transform: "translateX(40vw) rotate(10deg)", opacity: 0 },
        { transform: "none", opacity: 1 },
      ],
      { duration: 360, easing: EASE_POP }
    )
  }, [props.row.key])
  return (
    <div
      ref={ref}
      style={{
        display: "flex",
        gap: "calc(var(--u)*2)",
        alignItems: "flex-start",
        padding: "calc(var(--u)*2.4)",
        background: COLOR.paper,
        color: COLOR.ink,
        rotate: "-2deg",
        clipPath: "polygon(2% 4%, 100% 0, 98% 96%, 0 100%)",
      }}
    >
      <span
        style={{
          flex: "none",
          display: "grid",
          placeItems: "center",
          width: `calc(var(--u)*${wide ? 12 : 11})`,
          aspectRatio: 1,
          background: COLOR.ink,
          clipPath:
            "polygon(6% 10%, 62% 0, 100% 14%, 94% 86%, 40% 100%, 0 88%)",
        }}
      >
        <GoodIcon id={props.row.icon} image={props.row.image} iconSize="58%" />
      </span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <span
          style={{
            display: "block",
            fontSize: "calc(var(--u)*4.4)",
            lineHeight: 1.1,
          }}
        >
          {props.row.name}
        </span>
        {props.row.stat ? (
          <span style={{ display: "block", marginTop: ".4em" }}>
            {props.row.rarity ? (
              <RarityBadge rarity={props.row.rarity} size={2.2} />
            ) : null}
            <span
              style={{
                display: "inline-block",
                padding: ".05em .5em",
                background: COLOR.blood,
                color: COLOR.paper,
                fontSize: "max(11px, calc(var(--u)*2.2))",
              }}
            >
              {props.row.stat}
            </span>
          </span>
        ) : null}
        <span
          style={{
            display: "block",
            marginTop: ".6em",
            fontSize: "max(11px, calc(var(--u)*2.2))",
            fontWeight: 700,
            lineHeight: 1.6,
            whiteSpace: "pre-line",
          }}
        >
          {typeof props.row.desc === "function"
            ? props.row.desc()
            : props.row.desc}
          {props.row.owner ? (
            <>
              <br />
              装備：{props.row.owner}
            </>
          ) : null}
        </span>
      </span>
    </div>
  )
}
