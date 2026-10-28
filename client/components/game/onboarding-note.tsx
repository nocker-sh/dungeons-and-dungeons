import type { CSSProperties, ReactNode } from "react"
import { PALETTE, REVERT, unit } from "@/client/components/canvas/tokens"

/** 実際の操作の上に添える、初めての冒険の案内。閉じる操作を増やさない。 */
type Props = {
  title: string
  children: ReactNode
  style?: CSSProperties
  className?: string
}

export function OnboardingNote(props: Props) {
  const className = props.className === undefined ? "" : props.className

  return (
    <div
      className={`onboarding-note ${className}`}
      role="status"
      aria-live="polite"
      style={{
        ...REVERT,
        display: "grid",
        gap: 4,
        padding: "10px 16px",
        background: PALETTE.ink,
        color: PALETTE.paper,
        borderLeft: `5px solid ${PALETTE.sage}`,
        fontSize: `clamp(12px, ${unit(2.7)}, 18px)`,
        lineHeight: 1.5,
        pointerEvents: "none",
        ...props.style,
      }}
    >
      <strong
        style={{
          ...REVERT,
          fontSize: `clamp(16px, ${unit(3.8)}, 25px)`,
          color: PALETTE.sage,
        }}
      >
        {props.title}
      </strong>
      <span style={{ ...REVERT }}>{props.children}</span>
    </div>
  )
}
