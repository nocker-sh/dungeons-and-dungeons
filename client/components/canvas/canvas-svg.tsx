import { omitProps } from "@/client/utils/omit-props"
import { forwardRef } from "react"
import { motion } from "motion/react"
import type { SVGMotionProps } from "motion/react"
import { REVERT } from "@/client/components/canvas/tokens"

type Props = SVGMotionProps<SVGSVGElement>

export const CanvasSvg = forwardRef<
  SVGSVGElement,
  SVGMotionProps<SVGSVGElement>
>(function CanvasSvg(props: Props, ref) {
  const restProps = omitProps(props, ["style"])

  return (
    <motion.svg
      ref={ref}
      style={{ ...REVERT, display: "block", ...props.style }}
      {...restProps}
    />
  )
})
