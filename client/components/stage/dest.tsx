import { animationTiming } from "@/client/components/stage/timing"
import { useRef } from "react"
import type { CSSProperties } from "react"
import { motion } from "motion/react"
import { MOTION_EASE } from "@/client/components/stage/kit"
import { seconds } from "@/client/components/stage/seconds"
import { useActiveMark } from "@/client/components/canvas/use-active-mark"
import { PALETTE, REVERT, unit } from "@/client/components/canvas/tokens"
import { HalftoneDots } from "@/client/components/canvas/halftone-dots"
import type { RevolverItem } from "@/client/components/stage/revolver-shared"

export const PLATE_CLIP =
  "polygon(0 18%, 30% 0, 72% 8%, 100% 2%, 96% 80%, 58% 100%, 5% 90%)"

/** リボルバーの札一枚。d は選んでいる札からのずれ。 */
type Props = {
  item: RevolverItem
  d: number
  step: number
  choice: boolean
  /** 縦長の画面。札が狭いので数字を抑え、説明を読める大きさにする。 */
  portrait: boolean
  onClick: () => void
}

export function Dest(props: Props) {
  const ref = useRef<HTMLButtonElement>(null)
  const active = useActiveMark(ref)
  const on = props.d === 0
  const far = Math.abs(props.d)
  // 縦長の画面は説明が何行にもなるので、名前まで紙に乗るよう紙を上まで伸ばす
  const plate: CSSProperties = {
    ...REVERT,
    position: "absolute",
    inset: props.choice
      ? "14% 0 0 5%"
      : props.portrait
        ? "10% 0 4% 9%"
        : "30% 0 4% 9%",
    clipPath: PLATE_CLIP,
  }
  const nameColor = props.item.locked
    ? on
      ? PALETTE.stone
      : "rgb(238 235 227 / 0.4)"
    : on
      ? PALETTE.ink
      : PALETTE.paper
  return (
    <motion.button
      initial={false}
      transition={{
        rotate: { duration: 0.55, ease: [0.34, 1.45, 0.64, 1], repeat: 0 },
        scale: { duration: 0.55, ease: [0.34, 1.45, 0.64, 1], repeat: 0 },
        opacity: { duration: 0.3, ease: "easeInOut", repeat: 0 },
        filter: { duration: 0.3, ease: "easeInOut", repeat: 0 },
      }}
      animate={{
        rotate: `${props.d * props.step}deg`,
        scale: 1 - Math.min(1, far) * 0.3 - Math.max(0, far - 1) * 0.1,
        opacity: 1 - far * 0.3,
        filter: `brightness(${1 - Math.min(1, far) * 0.45})`,
      }}
      ref={ref}
      type="button"
      role="option"
      aria-selected={on}
      aria-label={`${props.item.no ?? ""}${props.item.unit ?? ""} ${props.item.name} ${props.item.note ?? ""}`.trim()}
      className={`dest ${on ? "on" : ""} ${props.item.locked ? "locked" : ""}`}
      hidden={far > 2.5}
      onClick={props.onClick}
      style={{
        ...REVERT,
        display: "block",
        visibility: far > 2.5 ? "hidden" : undefined,
        boxSizing: "border-box",
        margin: 0,
        padding: 0,
        border: 0,
        background: "none",
        font: "inherit",
        cursor: "pointer",
        pointerEvents: "auto",
        position: "absolute",
        right: "-3%",
        top: "50%",
        width: "100%",
        translate: "0 -50%",
        transformOrigin: "calc(100% + 40vw) 50%",

        textAlign: "left",
        zIndex: 10 - far,
      }}
    >
      <span
        style={{
          ...plate,
          background: PALETTE.blood,
          translate: `${unit(1)} ${unit(1)}`,
          opacity: on || active ? 1 : 0,
        }}
      />
      <span style={{ ...plate, background: on ? PALETTE.paper : PALETTE.ink }}>
        <HalftoneDots
          color={on ? "rgb(11 12 18 / 0.35)" : "rgb(238 235 227 / 0.18)"}
          fade="linear-gradient(100deg, transparent 20%, #000 90%)"
        />
      </span>
      <span
        style={{
          ...REVERT,
          position: "relative",
          display: "grid",
          // 名前と説明の列は 0 まで縮められるようにする（縮まないと札の外へ押し出されて切れる）
          gridTemplateColumns: props.choice
            ? "minmax(0, 1fr)"
            : "auto minmax(0, 1fr)",
          alignItems: "end",
          gap: `0 ${unit(props.portrait ? 2.6 : 1.6)}`,
          padding: props.choice
            ? `${unit(4.4)} ${unit(props.portrait ? 5 : 7)} ${unit(2.6)} ${unit(9)}`
            : `${unit(props.portrait ? 2.4 : 0)} ${unit(props.portrait ? 5 : 7)} ${unit(2.6)} 0`,
        }}
      >
        {props.item.no !== undefined ? (
          // 選んだ札の数字が弾む
          <motion.span
            animate={
              on
                ? { scale: [1.7, 1], rotate: [-24, -8] }
                : { scale: 1, rotate: -8 }
            }
            transition={{
              duration: seconds(animationTiming.change),
              ease: MOTION_EASE.pop,
            }}
            style={
              {
                ...REVERT,
                gridRow: "span 2",
                // 縦長の画面では数字を抑える（大きいままだと名前と説明の場所を奪う）
                fontSize: unit(props.portrait ? 11 : 20),
                lineHeight: 0.8,
                color: PALETTE.paper,
                WebkitTextStroke: `0.05em ${PALETTE.ink}`,
                paintOrder: "stroke fill",
                textShadow: `0.05em 0.05em 0 ${PALETTE.blood}`,
                translate: "-8% 0",
              } as CSSProperties
            }
          >
            {props.item.no}
            <small
              style={{
                ...REVERT,
                fontSize: "0.26em",
                letterSpacing: "0.05em",
                marginLeft: "-0.1em",
              }}
            >
              {props.item.unit}
            </small>
          </motion.span>
        ) : null}
        <span
          style={
            {
              ...REVERT,
              fontSize: unit(6.4),
              lineHeight: 1,
              color: nameColor,
              WebkitTextStroke: `0.08em ${on ? PALETTE.paper : PALETTE.ink}`,
              paintOrder: "stroke fill",
              rotate: "-4deg",
              translate: "0 -12%",
              overflowWrap: "anywhere",
            } as CSSProperties
          }
        >
          {props.item.name}
        </span>
        {props.item.note ? (
          // 説明は名前の下で折り返す。3行までに収め、札の外へはみ出て切れないようにする
          <span
            style={
              {
                ...REVERT,
                display: "-webkit-box",
                WebkitBoxOrient: "vertical",
                WebkitLineClamp: 3,
                overflow: "hidden",
                // 縦長の画面では名前の半分の大きさまで上げる（1.9 では読めない）
                fontSize: unit(props.portrait ? 3.2 : 1.9),
                marginTop: unit(props.portrait ? 0.8 : 0),
                letterSpacing: props.portrait ? "0.02em" : "0.08em",
                lineHeight: 1.35,
                overflowWrap: "anywhere",
                color: on ? PALETTE.blood : "rgb(238 235 227 / 0.65)",
              } as CSSProperties
            }
          >
            {props.item.note}
          </span>
        ) : null}
      </span>
    </motion.button>
  )
}
