import { useLayoutEffect, useRef, type CSSProperties } from "react"
import { motion } from "motion/react"
import { GoodIcon } from "@/components/game/art"
import { EASE_POP, MOTION_EASE } from "@/components/stage/kit"
import { useActiveMark, usePointerState } from "@/components/canvas/state"
import { BUTTON_BASE, PALETTE, REVERT, unit } from "@/components/canvas/tokens"
import { play } from "@/components/canvas/play"
import { TornPlate } from "@/components/canvas/paper"
import { type Row } from "./types"
import { RarityBadge } from "./rarity"

export function RowButton({
  row,
  index,
  picked,
  onPick,
}: {
  row: Row
  index: number
  picked: boolean
  onPick: () => void
}) {
  const ref = useRef<HTMLButtonElement>(null)
  useLayoutEffect(() => {
    play(
      ref.current,
      [
        { transform: "translateX(40vw) rotate(6deg)", opacity: 0 },
        { transform: "none", opacity: 1 },
      ],
      {
        duration: 380,
        delay: 120 + Math.min(index, 8) * 40,
        easing: EASE_POP,
        fill: "backwards",
      }
    )
    // 入場は一度だけ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const active = useActiveMark(ref)
  const pointer = usePointerState()
  const text = picked ? PALETTE.ink : PALETTE.paper
  return (
    // 選ばれている間は右へ小さく揺れる（--wobble を 0→1→0 に動かす）
    <motion.button
      ref={ref}
      type="button"
      className={`slot-item row ${picked ? "picked" : ""}`}
      aria-label={row.name}
      aria-pressed={picked}
      data-row-key={row.key}
      animate={{ "--wobble": active ? [0, 1, 0] : 0 }}
      transition={
        active
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
          rotate: `${index % 2 ? 0.6 : -0.6}deg`,
          "--wobble": 0,
          translate: `calc(${unit(1.2)} * var(--wobble)) 0`,
        } as CSSProperties
      }
      onClick={onPick}
      {...pointer.handlers}
    >
      <TornPlate
        background={
          picked
            ? PALETTE.paper
            : pointer.hover || active
              ? "#3a1820"
              : "#1a1b24"
        }
        clip="polygon(0 12%, 3% 0, 100% 6%, 98% 100%, 1% 92%)"
        style={{
          boxShadow: picked
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
        <GoodIcon id={row.icon} image={row.image} />
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
        {row.rarity ? <RarityBadge rarity={row.rarity} size={1.9} /> : null}
        {row.name}
      </span>
      <span
        style={{
          ...REVERT,
          position: "relative",
          fontSize: `max(11px, ${unit(1.9)})`,
          color: picked ? PALETTE.blood : "rgb(238 235 227 / 0.6)",
          whiteSpace: "nowrap",
        }}
      >
        {row.sub ?? ""}
      </span>
      <span
        style={
          {
            ...REVERT,
            position: "relative",
            fontSize: `max(12px, ${unit(3.6)})`,
            color: text,
            WebkitTextStroke: `0.08em ${picked ? PALETTE.paper : PALETTE.ink}`,
            paintOrder: "stroke fill",
            textShadow: `0.07em 0.07em 0 ${PALETTE.blood}`,
            whiteSpace: "nowrap",
          } as CSSProperties
        }
      >
        {row.badge ?? ""}
      </span>
    </motion.button>
  )
}
