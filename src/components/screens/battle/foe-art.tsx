import { foeSvg, Svg } from "@/components/game/art"
import { foeAppearance, foeAttackImage } from "@/lib/content/foe-appearance"
import { COLOR } from "@/components/stage/kit"
import { IMG_BASE } from "@/components/canvas/tokens"

export function FoeArt({
  foe,
  appearanceId,
  attacking = false,
  attackPattern,
  skill,
  defeated = false,
  sleeping = false,
}: {
  foe: string
  appearanceId?: string
  attacking?: boolean
  attackPattern?: number
  skill?: string
  defeated?: boolean
  sleeping?: boolean
}) {
  const appearance = foeAppearance(foe, appearanceId)
  const art = appearance ?? { glow: COLOR.lavender }
  const img = defeated
    ? (art.defeated ?? art.img)
    : sleeping
      ? (art.sleeping ?? art.img)
      : attacking
        ? foeAttackImage(appearance, attackPattern ?? { skill })
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

/** 敵の並び。一体なら画面いっぱい、複数なら横に並べる。 */
export function foeBoxes(count: number, wide: boolean) {
  if (count <= 1)
    return [
      wide
        ? { left: "14%", top: "2%", width: "56%", height: "100%" }
        : { left: "-8%", top: "13%", width: "116%", height: "56%" },
    ]
  const span = wide ? 72 : 108
  const start = wide ? 2 : -4
  const width = span / count
  return Array.from({ length: count }, (_, i) =>
    wide
      ? {
          left: `${start + i * width}%`,
          top: `${14 + (i % 2) * 6}%`,
          width: `${width * 1.05}%`,
          height: "86%",
        }
      : // スマホ：左下から右上へずらして重ねる。手前（左下）ほど前に出し、HPの札の高さもずらして重ならないようにする
        {
          left: `${-6 + (i * 30) / (count - 1)}%`,
          top: `${36 - (i * 20) / (count - 1)}%`,
          width: "78%",
          height: "44%",
          zIndex: count - i,
        }
  )
}
