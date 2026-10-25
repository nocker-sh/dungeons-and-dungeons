import { COLOR } from "@/components/stage/kit"
import { TornLabel } from "@/components/canvas/paper"

/** レア度の色。SR は金、R は青、N は石。 */
export const RARITY_COLOR: Record<string, string> = {
  SR: "#b8901c",
  R: COLOR.dusk,
  N: COLOR.stone,
}

/** 武器の個体のレア度の札。文字は仕様のレア度の名前（N・R・SR）。 */
export function RarityBadge({
  rarity,
  size,
}: {
  rarity: string
  size: number
}) {
  return (
    <TornLabel
      background={RARITY_COLOR[rarity] ?? COLOR.stone}
      color={COLOR.paper}
      clip="polygon(6% 0,100% 10%,94% 100%,0 88%)"
      style={{
        marginRight: ".4em",
        padding: "0 .45em",
        fontSize: `calc(var(--u)*${size})`,
        lineHeight: 1.5,
        letterSpacing: ".04em",
        verticalAlign: "middle",
      }}
    >
      {rarity}
    </TornLabel>
  )
}
