import { foeSvg } from "@/client/components/game/art-shared"
import { Svg } from "@/client/components/game/svg"
import { foeAppearance } from "@/content/foe-appearance"
import { foeAttackImage } from "@/content/foe-attack-image"
import { COLOR } from "@/client/components/stage/kit"
import { IMG_BASE } from "@/client/components/canvas/tokens"

export type Props = {
  foe: string
  appearanceId?: string
  attacking?: boolean
  attackPattern?: number
  skill?: string
  defeated?: boolean
  sleeping?: boolean
}

export function FoeArt(props: Props) {
  const attacking = props.attacking === undefined ? false : props.attacking
  const defeated = props.defeated === undefined ? false : props.defeated
  const sleeping = props.sleeping === undefined ? false : props.sleeping

  const appearance = foeAppearance(props.foe, props.appearanceId)
  const art = appearance ?? { glow: COLOR.lavender }
  const img = defeated
    ? (art.defeated ?? art.img)
    : sleeping
      ? (art.sleeping ?? art.img)
      : attacking
        ? foeAttackImage(
            appearance,
            props.attackPattern ?? { skill: props.skill }
          )
        : art.img
  if (img)
    return (
      <img
        src={img}
        alt=""
        style={{
          ...IMG_BASE,
          width: "100%",
          height: "100%",
          objectFit: "contain",
          display: "block",
          filter: `drop-shadow(calc(var(--u)*1.2) calc(var(--u)*1.2) 0 ${COLOR.ink})`,
        }}
      />
    )
  return (
    <Svg html={foeSvg(art.glow)} style={{ width: "100%", height: "100%" }} />
  )
}
