import { useRef, type CSSProperties, type ReactNode } from "react"
import { motion } from "motion/react"
import { MOTION_EASE } from "@/components/stage/kit"
import { useActiveMark } from "@/components/canvas/state"
import { BUTTON_BASE } from "@/components/canvas/tokens"

/** 一覧の上のタブ・操作。キーボードで選ばれている間は脈打つ。 */
export function TabButton({
  on = false,
  style,
  onClick,
  children,
}: {
  on?: boolean
  style?: CSSProperties
  onClick: () => void
  children: ReactNode
}) {
  const ref = useRef<HTMLButtonElement>(null)
  const active = useActiveMark(ref)
  return (
    <motion.button
      ref={ref}
      type="button"
      className={`tabbtn ${on ? "on" : ""}`}
      aria-pressed={on}
      onClick={onClick}
      animate={{ scale: active ? [1, 1.07, 1] : 1 }}
      transition={
        active
          ? { duration: 0.8, ease: MOTION_EASE.pop, repeat: Infinity }
          : { duration: 0 }
      }
      style={{ ...BUTTON_BASE, ...style }}
    >
      {children}
    </motion.button>
  )
}
