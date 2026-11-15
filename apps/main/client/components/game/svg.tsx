import type { CSSProperties } from "react"
import { REVERT } from "@/client/components/canvas/tokens"
import { fill } from "@/client/components/game/fill"

/** 手元の定数から作ったSVGを差し込む。外部入力は入れない。 */
export type Props = {
  html: string
  style?: CSSProperties
  className?: string
}

export function Svg(props: Props) {
  return (
    <span
      className={props.className}
      style={{ ...REVERT, display: "block", ...props.style }}
      dangerouslySetInnerHTML={{ __html: fill(props.html) }}
    />
  )
}
