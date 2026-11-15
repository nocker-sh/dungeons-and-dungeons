import { PALETTE, REVERT, unit } from "@/client/components/canvas/tokens"
import { LifeSegment } from "@/client/components/game/formation/life-segment"

/**
 * HP（生命力）の帯と、続きにつながる防具の耐久の帯。
 * 幅は最大HPと最大の耐久の比で分け、減った分は右から削る。
 */
type Props = {
  hp: number
  maxHp: number
  armor: { durability: number; maxDurability: number } | null
  width: string
}

export function LifeGauge(props: Props) {
  const segment = (value: number, max: number, color: string, grow: number) => (
    <LifeSegment value={value} maximum={max} color={color} grow={grow} />
  )
  return (
    <span
      aria-hidden="true"
      style={{
        ...REVERT,
        display: "flex",
        width: props.width,
        marginTop: unit(0.7),
        marginLeft: "auto",
        height: unit(1.1),
        background: PALETTE.ink,
        boxShadow: `0 0 0 ${unit(0.2)} ${PALETTE.ink}`,
        clipPath: "polygon(0 0,100% 0,98% 100%,2% 100%)",
      }}
    >
      {segment(
        props.hp,
        props.maxHp,
        props.hp / props.maxHp < 0.3 ? PALETTE.lavender : PALETTE.mist,
        props.maxHp
      )}
      {props.armor ? (
        <>
          <span
            style={{ ...REVERT, width: unit(0.3), background: PALETTE.night }}
          />
          {segment(
            props.armor.durability,
            props.armor.maxDurability,
            PALETTE.dusk,
            props.armor.maxDurability
          )}
        </>
      ) : null}
    </span>
  )
}
