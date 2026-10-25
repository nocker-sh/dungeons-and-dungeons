import type { CSSProperties, ReactNode } from "react"
import { motion } from "motion/react"
import { BUTTON_BASE, REVERT } from "@/components/canvas/tokens"

export type HandCard = {
  key: string
  /** 読み上げの名前（押すと何をするか）。 */
  label: string
  /** 手札から場へ出たとき、同じ layoutId の要素へ飛んでいく。 */
  layoutId?: string
  children: ReactNode
}

/** 隣の札との間隔（札の幅に対する割合）と、端へいくほど付ける傾き・下がり。 */
const SPREAD = 0.74
const TILT_DEG = 7
const DROP = 0.05

/**
 * カードゲームの手札。手元に扇形に札を持ち、押した札を場へ出す（onPlay）。
 * 札の見た目は children が持つ。札の縦横比は children で決まり、幅は cardWidth。
 * 出した札を手札から外し、同じ layoutId の要素を場に置くと、手札からそこへ飛んでいく。
 */
export function Hand({
  label,
  cards,
  cardWidth,
  onPlay,
  style,
}: {
  label: string
  cards: readonly HandCard[]
  /** 札一枚の幅（CSSの長さ）。 */
  cardWidth: string
  onPlay: (key: string) => void
  style?: CSSProperties
}) {
  const center = (cards.length - 1) / 2
  return (
    <div
      role="group"
      aria-label={label}
      style={{
        ...REVERT,
        display: "block",
        position: "relative",
        pointerEvents: "none",
        ...style,
      }}
    >
      {cards.map((card, index) => {
        const from = index - center
        return (
          <motion.button
            key={card.key}
            layoutId={card.layoutId}
            type="button"
            aria-label={card.label}
            onClick={() => onPlay(card.key)}
            initial={false}
            animate={{
              x: `${from * SPREAD * 100 - 50}%`,
              y: `${from * from * DROP * 100}%`,
              rotate: from * TILT_DEG,
            }}
            whileHover={{ y: "-12%", rotate: from * TILT_DEG * 0.5 }}
            whileFocus={{ y: "-12%", rotate: from * TILT_DEG * 0.5 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: "spring", stiffness: 420, damping: 30 }}
            style={{
              ...BUTTON_BASE,
              position: "absolute",
              left: "50%",
              bottom: 0,
              width: cardWidth,
              transformOrigin: "50% 120%",
              zIndex: index,
              pointerEvents: "auto",
            }}
          >
            {card.children}
          </motion.button>
        )
      })}
    </div>
  )
}
