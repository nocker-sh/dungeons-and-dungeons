import { omitProps } from "@/client/utils/omit-props"
import { forwardRef } from "react"
import type { CSSProperties } from "react"
import { motion } from "motion/react"
import type { HTMLMotionProps } from "motion/react"
import { REVERT } from "@/client/components/canvas/tokens"

export const IMAGE: CSSProperties = {
  ...REVERT,
  display: "block",
  maxWidth: "none",
  userSelect: "none",
  WebkitUserDrag: "none",
} as CSSProperties

type Props = HTMLMotionProps<"img">

export const CanvasImage = forwardRef<HTMLImageElement, HTMLMotionProps<"img">>(
  function CanvasImage(props: Props, ref) {
    const alt = props.alt === undefined ? "" : props.alt
    const draggable = props.draggable === undefined ? false : props.draggable
    const restProps = omitProps(props, ["style", "alt", "draggable"])

    return (
      <motion.img
        ref={ref}
        alt={alt}
        draggable={draggable}
        style={{ ...IMAGE, ...props.style }}
        {...restProps}
      />
    )
  }
)
