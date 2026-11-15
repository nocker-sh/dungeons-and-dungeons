import type { CSSProperties, ReactNode } from "react"
import { REVERT } from "@/client/components/canvas/tokens"

/**
 * 切り抜いた紙の小さな札。名前・状態・行き先などの短い言葉に使う。
 * 文字の大きさ・余白・傾き・置き場所は style で決める。
 */
type Props = {
  /** 紙の色。 */
  background: string
  /** 文字の色。 */
  color: string
  /** 破れた形。 */
  clip: string
  style?: CSSProperties
  children?: ReactNode
}

export function TornLabel(props: Props) {
  return (
    <span
      style={{
        ...REVERT,
        display: "inline-block",
        background: props.background,
        color: props.color,
        clipPath: props.clip,
        ...props.style,
      }}
    >
      {props.children}
    </span>
  )
}
