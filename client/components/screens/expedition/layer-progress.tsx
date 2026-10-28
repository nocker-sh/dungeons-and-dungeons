import type { CSSProperties, RefObject } from "react"
import { PALETTE, REVERT, unit } from "@/client/components/canvas/tokens"
import type { Game } from "@/lib/wiz/game/game"

export type Route = NonNullable<ReturnType<Game["queries"]["route"]>>

/** 層と残りの区間、次の固定戦闘を表示する。探索の操作は持たない。 */
type Props = {
  route: Pick<Route, "layer" | "stepsLeft" | "midbossSteps">
  compactBranch: boolean
  wide: boolean
  nextBattle: string | null
  nextStation: Route["stations"][number] | undefined
  leftRef: RefObject<HTMLDivElement | null>
}

export function LayerProgress(props: Props) {
  return (
    <div
      ref={props.leftRef}
      className="left2"
      aria-label={`${props.route.layer.no}層・${props.route.layer.name}。${props.route.stepsLeft > 0 ? `終点まであと${props.route.stepsLeft}区間` : "終点"}${props.route.midbossSteps !== null ? `。中ボスまであと${props.route.midbossSteps}区間` : ""}${props.nextBattle ? `。${props.nextBattle}` : ""}`}
      style={{
        ...REVERT,
        position: "absolute",
        left: "3%",
        top: props.compactBranch ? "2%" : "6%",
        rotate: "-6deg",
        pointerEvents: "none",
        color: PALETTE.paper,
        textShadow: `0 0 6px ${PALETTE.ink}`,
        whiteSpace: "nowrap",
      }}
    >
      <small
        data-expedition-layer
        style={{
          ...REVERT,
          display: "block",
          fontSize: `max(12px, ${unit(3)})`,
          fontWeight: 800,
          lineHeight: 1.3,
          marginBottom: props.compactBranch ? 4 : 8,
          maxWidth: unit(55),
          whiteSpace: "normal",
        }}
      >
        {props.route.layer.no}層・{props.route.layer.name}
      </small>
      <small
        style={{
          ...REVERT,
          display: "block",
          fontSize: `max(11px, ${unit(2.6)})`,
          letterSpacing: "0.3em",
        }}
      >
        終点まで（区間）
      </small>
      <b
        style={
          {
            ...REVERT,
            fontSize: unit(props.compactBranch ? 8 : 14),
            lineHeight: 0.85,
            WebkitTextStroke: `0.05em ${PALETTE.ink}`,
            paintOrder: "stroke fill",
            textShadow: `0.05em 0.05em 0 ${PALETTE.blood}`,
          } as CSSProperties
        }
      >
        {props.route.stepsLeft > 0 ? props.route.stepsLeft : "!"}
      </b>
      {props.route.midbossSteps !== null ? (
        <small
          style={{
            ...REVERT,
            display: "block",
            fontSize: `max(11px, ${unit(2.6)})`,
            marginTop: props.compactBranch ? 4 : 8,
          }}
        >
          中ボスまであと{props.route.midbossSteps}区間
        </small>
      ) : null}
      {props.nextBattle ? (
        <>
          <small
            style={{
              ...REVERT,
              display: "block",
              fontSize: `max(11px, ${unit(2.6)})`,
              fontWeight: 900,
              background: PALETTE.blood,
              padding: "4px 8px",
              marginTop: 8,
            }}
          >
            {props.nextBattle}
          </small>
          {props.nextStation?.fixedFoes.map((foe) => (
            <small
              key={foe.name}
              data-next-fixed-foe=""
              style={{
                ...REVERT,
                display: "block",
                maxWidth: props.wide ? 360 : "75vw",
                whiteSpace: "normal",
                fontSize: `max(11px, ${unit(2.6)})`,
                lineHeight: 1.4,
                padding: "4px 8px",
                background: PALETTE.ink,
              }}
            >
              敵：{foe.name}
              {foe.skills.length ? (
                <span style={{ display: "block" }}>
                  ワザ：{foe.skills.join("・")}
                </span>
              ) : null}
              {foe.resistances.length ? (
                <span style={{ display: "block" }}>
                  耐性：
                  {foe.resistances.map((entry) => entry.label).join("・")}
                </span>
              ) : null}
            </small>
          ))}
        </>
      ) : null}
    </div>
  )
}
