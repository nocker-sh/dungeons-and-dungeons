import type { CSSProperties } from "react"
import { motion } from "motion/react"
import { REVERT } from "@/client/components/canvas/tokens"

/** 背景の模様が流れ続ける飾り（斜線のトーンなど）。to は一周で動く背景の位置。 */
type Props = {
  className?: string
  to: string
  duration: number
  style?: CSSProperties
}

export function FlowingPattern(props: Props) {
  return (
    <motion.i
      className={props.className}
      aria-hidden="true"
      style={{ ...REVERT, backgroundPosition: "0 0", ...props.style }}
      animate={{ backgroundPosition: ["0 0", props.to] }}
      transition={{
        duration: props.duration / 1000,
        ease: "linear",
        repeat: Infinity,
      }}
    />
  )
}
