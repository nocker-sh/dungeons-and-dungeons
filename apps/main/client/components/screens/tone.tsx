import { useLayoutEffect, useRef } from "react"
import type { CSSProperties } from "react"
import { motion } from "motion/react"
import { EASE_OUT } from "@/client/components/stage/kit"
import { play } from "@/client/components/canvas/play"

export type WordLook = {
  size: (wide: boolean) => number
  paper?: boolean
  tilt: number
  rotate: number
  from: "left" | "right"
  wide: CSSProperties
  narrow: CSSProperties
}

/** 宿の部屋の札の置き方。部屋はデータの順に並べる。 */
export const ROOM_WORDS: readonly WordLook[] = [
  {
    size: () => 8,
    tilt: 2,
    rotate: 4,
    from: "right",
    wide: { left: "8vw", bottom: "14%" },
    narrow: { left: "4vw", bottom: "12%" },
  },
  {
    size: (wide) => (wide ? 12 : 10),
    paper: true,
    tilt: -3,
    rotate: -6,
    from: "left",
    wide: { right: "5vw", bottom: "12%" },
    narrow: { right: "2vw", bottom: "30%" },
  },
  {
    size: () => 8,
    tilt: -1.5,
    rotate: -3,
    from: "right",
    wide: { right: "12vw", bottom: "46%" },
    narrow: { right: "6vw", bottom: "50%" },
  },
]

/** 施設の場面：絵の上に斜めのトーンがゆっくり流れ続ける。 */
export function Tone() {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    play(
      ref.current,
      [
        { clipPath: "polygon(0 0, 0 0, -30% 100%, -30% 100%)" },
        { clipPath: "polygon(0 0, 130% 0, 100% 100%, -30% 100%)" },
      ],
      {
        duration: 500,
        easing: EASE_OUT,
        fill: "both",
      }
    )
  }, [])
  return (
    <motion.div
      ref={ref}
      aria-hidden="true"
      animate={{ backgroundPosition: ["0 0", "60px -36px"] }}
      transition={{ duration: 2.4, ease: "linear", repeat: Infinity }}
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        backgroundPosition: "0 0",
        backgroundImage:
          "repeating-linear-gradient(-60deg, rgb(238 235 227 / .06) 0 10px, transparent 10px 28px)",
        maskImage:
          "linear-gradient(100deg, #000, transparent 45%, transparent 70%, #000)",
        WebkitMaskImage:
          "linear-gradient(100deg, #000, transparent 45%, transparent 70%, #000)",
      }}
    />
  )
}
