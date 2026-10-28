import type { CSSProperties } from "react"
import { BUTTON_BASE, PALETTE, unit } from "@/client/components/canvas/tokens"

/** 名前の欄に添える小さなボタン（「おまかせ」など）。 */
type Props = {
  label: string
  onClick: () => void
  style?: CSSProperties
}

export function NameFieldButton(props: Props) {
  return (
    <button
      type="button"
      aria-label={props.label}
      onClick={props.onClick}
      style={{
        ...BUTTON_BASE,
        padding: `${unit(0.5)} ${unit(1.6)}`,
        fontSize: unit(2.6),
        fontWeight: 800,
        color: PALETTE.paper,
        boxShadow: `inset 0 0 0 ${unit(0.35)} ${PALETTE.paper}`,
        clipPath: "polygon(5% 0, 100% 7%, 95% 100%, 0 92%)",
        ...props.style,
      }}
    >
      {props.label}
    </button>
  )
}
