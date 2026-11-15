import { useStage } from "@/client/components/stage/use-stage"
import { useAnimationCompletion } from "@/client/components/stage/use-animation-completion"
import { motion } from "motion/react"
import { REVERT } from "@/client/components/canvas/tokens"

type Props = {
  value: number
  maximum: number
  color: string
  grow: number
}

export function LifeSegment(props: Props) {
  const completion = useAnimationCompletion(useStage().updates)
  return (
    <span
      style={{
        ...REVERT,
        position: "relative",
        flex: `${props.grow} 0 0`,
        minWidth: 0,
        overflow: "hidden",
      }}
    >
      <motion.span
        {...completion}
        initial={false}
        transition={{
          right: { duration: 0.4, ease: [0.16, 1, 0.3, 1], repeat: 0 },
        }}
        animate={{
          right: `${100 - (props.value / Math.max(1, props.maximum)) * 100}%`,
        }}
        style={{
          ...REVERT,
          position: "absolute",
          inset: 0,

          background: props.color,
        }}
      />
    </span>
  )
}
