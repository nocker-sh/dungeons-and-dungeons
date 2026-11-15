import { forwardRef } from "react"
import type { CSSProperties } from "react"
import { REVERT } from "@/client/components/canvas/tokens"

/**
 * 紙の見た目の共通部品（網点・破れた面・小さな札）。
 * どれも最初に `all: revert` を当て、ページ側のCSSを打ち消してから必要な値だけを style で書く。
 */

/**
 * 網点（印刷の点の重ね）。色と、どちら側から濃くなるか（fade）で濃淡を付ける。
 * 置き場所は既定で親いっぱい。ずらすときは style で上書きする。
 */
type Props = {
  /** 点の色。 */
  color: string
  /** 点が濃くなっていく向き（CSS のグラデーション）。 */
  fade: string
  /** 点の間隔。 */
  gap?: string
  /** 点の太さ（内側・外側の半径）。 */
  radius?: readonly [string, string]
  style?: CSSProperties
}

export const HalftoneDots = forwardRef<
  HTMLSpanElement,
  {
    /** 点の色。 */
    color: string
    /** 点が濃くなっていく向き（CSS のグラデーション）。 */
    fade: string
    /** 点の間隔。 */
    gap?: string
    /** 点の太さ（内側・外側の半径）。 */
    radius?: readonly [string, string]
    style?: CSSProperties
  }
>(function HalftoneDots(props: Props, ref) {
  const gap = props.gap === undefined ? "6px 6px" : props.gap
  const radius = props.radius === undefined ? ["34%", "36%"] : props.radius

  return (
    <span
      ref={ref}
      aria-hidden="true"
      style={{
        ...REVERT,
        position: "absolute",
        inset: 0,
        backgroundImage: `radial-gradient(circle, ${props.color} ${radius[0]}, transparent ${radius[1]})`,
        backgroundSize: gap,
        WebkitMaskImage: props.fade,
        maskImage: props.fade,
        ...props.style,
      }}
    />
  )
})
