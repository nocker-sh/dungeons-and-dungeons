import { omitProps } from "@/client/utils/omit-props"
import { forwardRef } from "react"
import { motion } from "motion/react"
import type { HTMLMotionProps } from "motion/react"
import { BOX } from "@/client/components/canvas/primitives-shared"

type Props = HTMLMotionProps<"div">

export const CanvasBox = forwardRef<HTMLDivElement, HTMLMotionProps<"div">>(
  function CanvasBox(props: Props, ref) {
    const restProps = omitProps(props, ["style"])

    return (
      <motion.div ref={ref} style={{ ...BOX, ...props.style }} {...restProps} />
    )
  }
)
