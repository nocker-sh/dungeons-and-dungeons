import type { CSSProperties } from "react"
import { PALETTE, REVERT, unit } from "@/client/components/canvas/tokens"
import { Counted } from "@/client/components/game/formation/counted"
import { LifeGauge } from "@/client/components/game/formation/life-gauge"
import type { Game } from "@/lib/wiz/game/game"

export type Member = NonNullable<ReturnType<Game["queries"]["member"]>>

/** HP、防具の耐久、武器と状態の表示。隊列の操作と画像には触れない。 */
type Props = {
  member: Member
  wide: boolean
  up: boolean
  lift: CSSProperties["translate"]
}

export function FormationVitals(props: Props) {
  return (
    <div
      style={{
        ...REVERT,
        position: "absolute",
        right: "calc(var(--hidden-right, 0px) + 2vw)",
        bottom: "30%",
        zIndex: props.up ? 7 : 3,
        textAlign: "right",
        lineHeight: 0.9,
        whiteSpace: "nowrap",
        pointerEvents: "none",
        rotate: "calc(var(--r) * 1deg)",
        translate: props.lift,
      }}
    >
      <Counted
        value={props.member.hp}
        style={{
          fontSize: unit(props.wide ? 6.4 : 4.8),
          color:
            props.member.hp / props.member.maxHp < 0.3
              ? PALETTE.lavender
              : PALETTE.mist,
          textShadow: `${unit(0.4)} ${unit(0.4)} 0 ${PALETTE.ink}`,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        <small style={{ ...REVERT, fontSize: "0.38em", color: PALETTE.stone }}>
          /{props.member.maxHp}
        </small>
      </Counted>
      <LifeGauge
        hp={props.member.hp}
        maxHp={props.member.maxHp}
        armor={props.member.armor}
        width={unit(props.wide ? 22 : 17)}
      />
      {props.member.armor ? (
        <div
          data-formation-armor={props.member.id}
          style={{
            ...REVERT,
            display: "block",
            marginTop: unit(0.5),
            fontSize: `max(10px, ${unit(props.wide ? 2.2 : 2)})`,
            color: props.member.armor.durability ? PALETTE.dusk : PALETTE.paper,
            background: props.member.armor.durability
              ? undefined
              : PALETTE.blood,
            padding: props.member.armor.durability ? undefined : "2px 4px",
            letterSpacing: "0.05em",
            whiteSpace: "nowrap",
          }}
        >
          {props.member.armor.durability === 0 ? (
            "耐久切れ"
          ) : (
            <>
              耐久 {props.member.armor.durability}
              <small style={{ ...REVERT, color: PALETTE.stone }}>
                /{props.member.armor.maxDurability}
              </small>
            </>
          )}
        </div>
      ) : null}
      <div
        style={{
          ...REVERT,
          display: "block",
          marginTop: unit(0.6),
          fontSize: unit(props.wide ? 2.2 : 2),
          color: PALETTE.mist,
          opacity: 0.75,
          letterSpacing: "0.05em",
          whiteSpace: "nowrap",
        }}
      >
        {props.member.hp <= 0
          ? "たおれている"
          : (props.member.weapon?.name ?? "素手")}
        {props.member.status.map((entry) => (
          <b
            key={entry.kind}
            style={{
              ...REVERT,
              marginLeft: ".4em",
              padding: "0 .3em",
              background: "#6b1723",
              color: "#eeebe3",
            }}
          >
            {entry.name}
          </b>
        ))}
      </div>
    </div>
  )
}
