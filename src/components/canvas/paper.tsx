import { motion } from "motion/react"
import { forwardRef, type CSSProperties, type ReactNode } from "react"
import { REVERT } from "@/components/canvas/tokens"

/**
 * 紙の見た目の共通部品（網点・破れた面・小さな札）。
 * どれも最初に `all: revert` を当て、ページ側のCSSを打ち消してから必要な値だけを style で書く。
 */

/**
 * 網点（印刷の点の重ね）。色と、どちら側から濃くなるか（fade）で濃淡を付ける。
 * 置き場所は既定で親いっぱい。ずらすときは style で上書きする。
 */
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
>(function HalftoneDots(
  { color, fade, gap = "6px 6px", radius = ["34%", "36%"], style },
  ref
) {
  return (
    <span
      ref={ref}
      aria-hidden="true"
      style={{
        ...REVERT,
        position: "absolute",
        inset: 0,
        backgroundImage: `radial-gradient(circle, ${color} ${radius[0]}, transparent ${radius[1]})`,
        backgroundSize: gap,
        WebkitMaskImage: fade,
        maskImage: fade,
        ...style,
      }}
    />
  )
})

/**
 * 破れた紙の面。札・板・窓の下地に敷く。形は clip、置き場所と重なりは style で決める。
 * 色を渡さなければ透明なまま（縁や影だけを描くとき）。
 */
export const TornPlate = forwardRef<
  HTMLSpanElement,
  {
    /** 面の色（背景として渡す。グラデーションでもよい）。 */
    background?: string
    /** 破れた形。 */
    clip: string
    style?: CSSProperties
    children?: ReactNode
  }
>(function TornPlate({ background, clip, style, children }, ref) {
  return (
    <motion.span
      initial={false}
      animate={{ background: background ?? "transparent" }}
      transition={{ duration: 0.15 }}
      ref={ref}
      aria-hidden="true"
      style={{
        ...REVERT,
        position: "absolute",
        inset: 0,
        clipPath: clip,
        ...style,
      }}
    >
      {children}
    </motion.span>
  )
})

/**
 * 切り抜いた紙の小さな札。名前・状態・行き先などの短い言葉に使う。
 * 文字の大きさ・余白・傾き・置き場所は style で決める。
 */
export function TornLabel({
  background,
  color,
  clip,
  style,
  children,
}: {
  /** 紙の色。 */
  background: string
  /** 文字の色。 */
  color: string
  /** 破れた形。 */
  clip: string
  style?: CSSProperties
  children?: ReactNode
}) {
  return (
    <span
      style={{
        ...REVERT,
        display: "inline-block",
        background,
        color,
        clipPath: clip,
        ...style,
      }}
    >
      {children}
    </span>
  )
}
