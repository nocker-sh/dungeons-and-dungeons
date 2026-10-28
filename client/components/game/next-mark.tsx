import { motion } from "motion/react"
import { steps } from "motion"
import { PALETTE, REVERT } from "@/client/components/canvas/tokens"

/** 次へ進める合図。点滅する。 */
type Props = { visible: boolean }

export function NextMark(props: Props) {
  return (
    <motion.span
      aria-hidden="true"
      animate={props.visible ? { opacity: [1, 0] } : { opacity: 1 }}
      transition={
        props.visible
          ? { duration: 0.7, ease: steps(2), repeat: Infinity }
          : { duration: 0 }
      }
      style={{
        ...REVERT,
        position: "absolute",
        right: "8%",
        bottom: "3vh",
        fontSize: "1.1em",
        color: PALETTE.blood,
        visibility: props.visible ? "visible" : "hidden",
      }}
    >
      ▼
    </motion.span>
  )
}
