import { motion } from "motion/react"
import { forwardRef } from "react"
import type { CSSProperties, ReactNode } from "react"
import { REVERT } from "@/client/components/canvas/tokens"

/**
 * 破れた紙の面。札・板・窓の下地に敷く。形は clip、置き場所と重なりは style で決める。
 * 色を渡さなければ透明なまま（縁や影だけを描くとき）。
 */
type Props = {
  /** 面の色（背景として渡す。グラデーションでもよい）。 */
  background?: string
  /** 破れた形。 */
  clip: string
  style?: CSSProperties
  children?: ReactNode
}

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
>(function TornPlate(props: Props, ref) {
  return (
    <motion.span
      initial={false}
      animate={{ background: props.background ?? "transparent" }}
      transition={{ duration: 0.15 }}
      ref={ref}
      aria-hidden="true"
      style={{
        ...REVERT,
        position: "absolute",
        inset: 0,
        clipPath: props.clip,
        ...props.style,
      }}
    >
      {props.children}
    </motion.span>
  )
})
