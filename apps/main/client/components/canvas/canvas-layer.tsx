import { omitProps } from "@/client/utils/omit-props"
import { forwardRef } from "react"
import { motion } from "motion/react"
import type { HTMLMotionProps } from "motion/react"
import { BOX } from "@/client/components/canvas/primitives-shared"

/**
 * 画面いっぱいの層。層そのものは押せず、中の CanvasButton などだけが押せる。
 */
type Props = HTMLMotionProps<"div">

export const CanvasLayer = forwardRef<HTMLDivElement, HTMLMotionProps<"div">>(
  function CanvasLayer(props: Props, ref) {
    const restProps = omitProps(props, ["style"])

    return (
      <motion.div
        ref={ref}
        style={{
          ...BOX,
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          ...props.style,
        }}
        {...restProps}
      />
    )
  }
)
