import { useRef } from "react"
import type { CSSProperties, ReactNode } from "react"
import { motion, useIsPresent } from "motion/react"
import { useLeaving } from "@/client/components/stage/use-leaving"
import { MOTION_EASE } from "@/client/components/stage/kit"
import { useActiveMark } from "@/client/components/canvas/use-active-mark"
import { BUTTON_BASE } from "@/client/components/canvas/tokens"

/** 一覧の上のタブ・操作。キーボードで選ばれている間は脈打つ。 */
type Props = {
  on?: boolean
  style?: CSSProperties
  onClick: () => void
  children: ReactNode
}

export function TabButton(props: Props) {
  const on = props.on === undefined ? false : props.on

  const ref = useRef<HTMLButtonElement>(null)
  const active = useActiveMark(ref)
  const present = useIsPresent()
  const leaving = useLeaving()
  const going = leaving || !present
  return (
    <motion.button
      ref={ref}
      type="button"
      className={`tabbtn ${on ? "on" : ""}`}
      aria-pressed={on}
      disabled={going}
      data-leaving={going ? "1" : undefined}
      onClick={() => {
        if (!going) props.onClick()
      }}
      animate={{ scale: active && !going ? [1, 1.07, 1] : 1 }}
      transition={
        active && !going
          ? { duration: 0.8, ease: MOTION_EASE.pop, repeat: Infinity }
          : { duration: 0 }
      }
      style={{ ...BUTTON_BASE, ...props.style }}
    >
      {props.children}
    </motion.button>
  )
}
