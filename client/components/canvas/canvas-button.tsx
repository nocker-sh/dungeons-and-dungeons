import { omitProps } from "@/client/utils/omit-props"
import { forwardRef } from "react"
import type { CSSProperties } from "react"
import { motion } from "motion/react"
import type { HTMLMotionProps } from "motion/react"
import { REVERT } from "@/client/components/canvas/tokens"

/** 押せる部品。層（押せない）の中でも押せるように pointerEvents は auto。 */
export const BUTTON: CSSProperties = {
  ...REVERT,
  display: "block",
  boxSizing: "border-box",
  margin: 0,
  padding: 0,
  border: 0,
  background: "none",
  font: "inherit",
  color: "inherit",
  textAlign: "inherit",
  cursor: "pointer",
  touchAction: "manipulation",
  pointerEvents: "auto",
  WebkitTapHighlightColor: "transparent",
}

type Props = HTMLMotionProps<"button">

export const CanvasButton = forwardRef<
  HTMLButtonElement,
  HTMLMotionProps<"button">
>(function CanvasButton(props: Props, ref) {
  const type = props.type === undefined ? "button" : props.type
  const restProps = omitProps(props, ["style", "type"])

  return (
    <motion.button
      ref={ref}
      type={type}
      style={{ ...BUTTON, ...props.style }}
      {...restProps}
    />
  )
})
