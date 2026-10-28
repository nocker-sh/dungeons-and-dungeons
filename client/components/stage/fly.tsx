import type { CSSProperties, HTMLAttributes, ReactNode } from "react"
import { motion } from "motion/react"
import type { FlyOptions } from "@/client/components/stage/fly-motion"
import { useGoing } from "@/client/components/stage/use-going"
import { flyMotion } from "@/client/components/stage/fly-motion"

/** 画面外から入ってくるだけの要素（案内人・札など）。 */
type Props = FlyOptions &
  Pick<
    HTMLAttributes<HTMLDivElement>,
    "role" | "aria-label" | "aria-hidden"
  > & {
    style?: CSSProperties
    className?: string
    children?: ReactNode
  }

export function Fly(props: Props) {
  const from = props.from === undefined ? "right" : props.from
  const rotate = props.rotate === undefined ? 0 : props.rotate
  const delay = props.delay === undefined ? 0 : props.delay
  const leaveDelay = props.leaveDelay === undefined ? 0 : props.leaveDelay
  const hidden =
    props["aria-hidden"] === undefined ? true : props["aria-hidden"]

  const { leaving, mark, completion } = useGoing()
  const { initial, enter, leave } = flyMotion({
    from,
    rotate,
    delay,
    leaveDelay,
  })
  return (
    <motion.div
      className={props.className}
      style={props.style}
      role={props.role}
      aria-label={props["aria-label"]}
      aria-hidden={leaving || hidden}
      data-leaving={mark}
      initial={initial}
      {...completion}
      animate={leaving ? leave : enter}
      exit={leave}
    >
      {props.children}
    </motion.div>
  )
}
