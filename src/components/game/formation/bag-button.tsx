import { motion } from "motion/react"
import { FlowingPattern } from "@/components/canvas/primitives"
import { useActiveMark, usePointerState } from "@/components/canvas/state"
import { BUTTON_BASE, PALETTE, REVERT, unit } from "@/components/canvas/tokens"
import { MOTION_EASE } from "@/components/stage/kit"

/** 隊列の左上のバッグ。開いている間・選ばれている間は脈打ち、縞が流れる。 */
export function BagButton({
  buttonRef,
  open,
  collapsed,
  onClick,
}: {
  buttonRef: React.RefObject<HTMLButtonElement | null>
  open: boolean
  /** 札を引っ込めて隊列の高さが0になっている。 */
  collapsed: boolean
  onClick: () => void
}) {
  const active = useActiveMark(buttonRef)
  const pointer = usePointerState()
  const lit = open || active
  const pulsing = lit || pointer.hover
  return (
    <motion.button
      initial={false}
      ref={buttonRef}
      type="button"
      className="bagbtn"
      aria-label={open ? "バッグを閉じる" : "バッグ"}
      onClick={onClick}
      {...pointer.handlers}
      animate={{
        scale: pulsing ? [1, 1.07, 1] : 1,
        top: unit(collapsed ? -13 : -7),
      }}
      transition={{
        ...(pulsing
          ? { duration: 0.8, ease: MOTION_EASE.pop, repeat: Infinity }
          : { duration: 0 }),
        top: { duration: 0.4, ease: "easeInOut", repeat: 0 },
      }}
      style={{
        ...BUTTON_BASE,
        position: "absolute",
        zIndex: 20,
        left: "1.2vw",
        // 隊列が引っ込んで高さが0のときも、ボタン全体が画面に収まる位置

        width: unit(10),
        aspectRatio: 1,
        rotate: "-8deg",
        filter: `drop-shadow(${unit(0.7)} ${unit(0.7)} 0 ${PALETTE.blood})`,
      }}
    >
      {lit ? (
        <FlowingPattern
          to="-0.58em 0"
          duration={600}
          style={{
            position: "absolute",
            inset: 0,
            background:
              "repeating-linear-gradient(-60deg, #eeebe3 0 0.6em, #d8d4c8 0.6em 1em)",
            backgroundSize: "200% 200%",
            clipPath: BAG_CLIP,
          }}
        />
      ) : (
        <span
          style={{
            ...REVERT,
            position: "absolute",
            inset: 0,
            background: PALETTE.paper,
            clipPath: BAG_CLIP,
          }}
        />
      )}
      <span style={{ ...REVERT, position: "absolute", inset: "18%" }}>
        <svg
          viewBox="0 0 40 40"
          style={{ ...REVERT, display: "block", width: "100%", height: "100%" }}
        >
          <path
            d="M14 12 L14 7 L26 7 L26 12"
            fill="none"
            stroke="#0b0c12"
            strokeWidth="4"
          />
          <path d="M5 13 L35 11 L37 35 L4 36Z" fill="#0b0c12" />
          <path d="M5 20 L36 18" stroke="#eeebe3" strokeWidth="3" />
          <rect x="17" y="17" width="7" height="7" fill="#6b1723" />
        </svg>
      </span>
    </motion.button>
  )
}

const BAG_CLIP = "polygon(8% 12%, 60% 0, 100% 16%, 92% 88%, 36% 100%, 0 84%)"
