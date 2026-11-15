import type { ReactNode } from "react"
import { COLOR } from "@/client/components/stage/kit"

/** 項目ひとつ。見出しのあとに値を置き、途中で折り返さない。 */
type Props = {
  label: string
  /** 値の大きさ（見出しに対する倍率）。 */
  size?: number
  color?: string
  wrap?: boolean
  children: ReactNode
}

export function Stat(props: Props) {
  const size = props.size === undefined ? 1.5 : props.size
  const color = props.color === undefined ? COLOR.mist : props.color
  const wrap = props.wrap === undefined ? false : props.wrap

  return (
    <span style={{ whiteSpace: wrap ? "normal" : "nowrap" }}>
      {props.label}{" "}
      <span style={{ color, fontSize: `${size}em` }}>{props.children}</span>
    </span>
  )
}
