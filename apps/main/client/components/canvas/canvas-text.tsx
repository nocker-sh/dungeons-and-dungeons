import { omitProps } from "@/client/utils/omit-props"
import { forwardRef } from "react"
import type { CSSProperties } from "react"
import { motion } from "motion/react"
import type { HTMLMotionProps } from "motion/react"
import { REVERT } from "@/client/components/canvas/tokens"

export const TEXT: CSSProperties = { ...REVERT, boxSizing: "border-box" }

type Props = HTMLMotionProps<"span">

export const CanvasText = forwardRef<HTMLSpanElement, HTMLMotionProps<"span">>(
  function CanvasText(props: Props, ref) {
    const restProps = omitProps(props, ["style"])

    return (
      <motion.span
        ref={ref}
        style={{ ...TEXT, ...props.style }}
        {...restProps}
      />
    )
  }
)
