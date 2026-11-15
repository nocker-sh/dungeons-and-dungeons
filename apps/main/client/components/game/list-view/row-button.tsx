import { useRef } from "react"
import type { CSSProperties } from "react"
import { after } from "@/client/components/canvas/after"
import { useAnimationEffect } from "@/client/components/canvas/use-animation-effect"
import { motion, useIsPresent } from "motion/react"
import { useLeaving } from "@/client/components/stage/use-leaving"
import { GoodIcon } from "@/client/components/game/good-icon"
import { EASE_POP, MOTION_EASE } from "@/client/components/stage/kit"
import { useActiveMark } from "@/client/components/canvas/use-active-mark"
import { usePointerState } from "@/client/components/canvas/use-pointer-state"
import {
  BUTTON_BASE,
  PALETTE,
  REVERT,
  unit,
} from "@/client/components/canvas/tokens"
import { play } from "@/client/components/canvas/play"
import { TornPlate } from "@/client/components/canvas/torn-plate"
import type { Row } from "@/client/components/game/list-view/types"
import { RarityBadge } from "@/client/components/game/list-view/rarity-badge"

type Props = {
  row: Row
  index: number
  picked: boolean
  onPick: () => void
  onEntered: () => void
}

export function RowButton(props: Props) {
  const ref = useRef<HTMLButtonElement>(null)
  useAnimationEffect(() => {
    const entrance = play(
      ref.current,
      [
        { transform: "translateX(40vw) rotate(6deg)", opacity: 0 },
        { transform: "none", opacity: 1 },
      ],
      {
        duration: 380,
        delay: 120 + Math.min(props.index, 8) * 40,
        easing: EASE_POP,
        fill: "backwards",
      }
    )
    // 回転・移動中はscrollHeightも変わる。落ち着いた一覧でつまみを測り直す。
    after(entrance, props.onEntered)
    // 入場は一度だけ
  }, [])
  const active = useActiveMark(ref)
  const present = useIsPresent()
  const leaving = useLeaving()
  const going = leaving || !present
  const pointer = usePointerState()
  const text = props.picked ? PALETTE.ink : PALETTE.paper
  return (
    // 選ばれている間は右へ小さく揺れる（--wobble を 0→1→0 に動かす）
    <motion.button
      ref={ref}
      type="button"
      className={`slot-item row ${props.picked ? "picked" : ""}`}
      aria-label={props.row.name}
      aria-pressed={props.picked}
      disabled={going}
      data-leaving={going ? "1" : undefined}
      data-row-key={props.row.key}
      animate={{ "--wobble": active && !going ? [0, 1, 0] : 0 }}
      transition={
        active && !going
          ? { duration: 0.8, ease: MOTION_EASE.pop, repeat: Infinity }
          : { duration: 0 }
      }
      style={
        {
          ...BUTTON_BASE,
          position: "relative",
          flex: "none",
          display: "grid",
          gridTemplateColumns: "auto 1fr auto auto",
          alignItems: "center",
          gap: unit(1.6),
          minHeight: `max(44px, ${unit(8.4)})`,
          padding: `${unit(0.8)} ${unit(2.4)} ${unit(0.8)} ${unit(1)}`,
          textAlign: "left",
          color: text,
          rotate: `${props.index % 2 ? 0.6 : -0.6}deg`,
          "--wobble": 0,
          translate: `calc(${unit(1.2)} * var(--wobble)) 0`,
        } as CSSProperties
      }
      onClick={() => {
        if (!going) props.onPick()
      }}
      {...pointer.handlers}
    >
      <TornPlate
        background={
          props.picked
            ? PALETTE.paper
            : pointer.hover || active
              ? "#3a1820"
              : "#1a1b24"
        }
        clip="polygon(0 12%, 3% 0, 100% 6%, 98% 100%, 1% 92%)"
        style={{
          boxShadow: props.picked
            ? "none"
            : "inset 0 0 0 2px rgb(238 235 227 / 0.35)",
        }}
      />
      <span
        style={{
          ...REVERT,
          position: "relative",
          display: "grid",
          placeItems: "center",
          width: unit(6.4),
          aspectRatio: 1.05,
          background: PALETTE.ink,
          clipPath:
            "polygon(6% 10%, 62% 0, 100% 14%, 94% 86%, 40% 100%, 0 88%)",
          boxShadow: `inset 0 0 0 2px ${PALETTE.paper}`,
        }}
      >
        <GoodIcon id={props.row.icon} image={props.row.image} />
      </span>
      <span
        style={{
          ...REVERT,
          position: "relative",
          fontSize: `max(12px, ${unit(3)})`,
          whiteSpace: "nowrap",
          overflow: "hidden",
        }}
      >
        {props.row.rarity ? (
          <RarityBadge rarity={props.row.rarity} size={1.9} />
        ) : null}
        {props.row.name}
      </span>
      <span
        style={{
          ...REVERT,
          position: "relative",
          fontSize: `max(11px, ${unit(1.9)})`,
          color: props.picked ? PALETTE.blood : "rgb(238 235 227 / 0.6)",
          whiteSpace: "nowrap",
        }}
      >
        {props.row.sub ?? ""}
      </span>
      <span
        style={
          {
            ...REVERT,
            position: "relative",
            fontSize: `max(12px, ${unit(3.6)})`,
            color: text,
            WebkitTextStroke: `0.08em ${props.picked ? PALETTE.paper : PALETTE.ink}`,
            paintOrder: "stroke fill",
            textShadow: `0.07em 0.07em 0 ${PALETTE.blood}`,
            whiteSpace: "nowrap",
          } as CSSProperties
        }
      >
        {props.row.badge ?? ""}
      </span>
    </motion.button>
  )
}
