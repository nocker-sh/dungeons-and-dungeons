import { play } from "@/client/components/canvas/play"
import { animationTiming } from "@/client/components/stage/timing"
import { letterDelay } from "@/client/components/stage/letter-delay"
import { useMemo, useRef, useState } from "react"
import type { CSSProperties, ReactNode, RefObject } from "react"
import { MOTION_EASE } from "@/client/components/stage/kit"
import { brokenShape } from "@/client/components/stage/broken-shape"
import { seconds } from "@/client/components/stage/seconds"
import { PALETTE, REVERT } from "@/client/components/canvas/tokens"
import { useActiveMark } from "@/client/components/canvas/use-active-mark"
import { HalftoneDots } from "@/client/components/canvas/halftone-dots"
import { motion } from "motion/react"
import type { MotionStyle } from "motion/react"
import { useGoing } from "@/client/components/stage/use-going"
import { flyMotion } from "@/client/components/stage/fly-motion"

/** 板はカーソルに吸い寄せられる（CSS の translate。motion の transform とは別に効く）。 */
export const magnet = {
  onPointerMove: (event: React.PointerEvent<HTMLElement>) => {
    const el = event.currentTarget
    const r = el.getBoundingClientRect()
    play(
      el,
      [
        { translate: getComputedStyle(el).translate },
        {
          translate: `${((event.clientX - r.left) / r.width - 0.5) * 14}px ${((event.clientY - r.top) / r.height - 0.5) * 10}px`,
        },
      ],
      {
        duration: 250,
        easing: "cubic-bezier(.16,1,.3,1)",
        fill: "both",
        id: "magnet",
      }
    )
  },
  onPointerLeave: (event: React.PointerEvent<HTMLElement>) => {
    const element = event.currentTarget
    play(
      element,
      [
        { translate: getComputedStyle(element).translate },
        { translate: "0 0" },
      ],
      {
        duration: 250,
        easing: "cubic-bezier(.16,1,.3,1)",
        fill: "both",
        id: "magnet",
      }
    )
  },
}

export const wordLetterScales = [1.12, 0.8, 0.96, 0.78, 1.02, 0.86, 0.94]

/** 紙：白地に黒い網点、文字は墨に白い縁。墨：黒地に白い網点と白い縁、文字は白に墨の縁。 */
export const WORD_LOOK = {
  paper: {
    shape: PALETTE.paper,
    shade: PALETTE.blood,
    text: PALETTE.ink,
    stroke: PALETTE.paper,
    dot: "rgb(11 12 18 / 0.5)",
    line: "rgb(11 12 18 / 0.08)",
    activeLine: "rgb(11 12 18 / 0.22)",
  },
  ink: {
    shape: PALETTE.ink,
    shade: PALETTE.paper,
    text: PALETTE.paper,
    stroke: PALETTE.ink,
    dot: "rgb(238 235 227 / 0.22)",
    line: "rgb(238 235 227 / 0.05)",
    activeLine: "rgb(238 235 227 / 0.22)",
  },
} as const

export type Props = {
  text: string
  size?: number
  paper?: boolean
  big?: boolean
  tilt?: number
  rotate?: number
  from?: "left" | "right"
  delay?: number
  style?: CSSProperties
  className?: string
  disabled?: boolean
  label?: string
  modalClose?: boolean
  /** 押した板を渡す（行き先へ寄る位置などを測る側が使う）。 */
  onClick?: (element: HTMLButtonElement) => void
  children?: ReactNode
  /** 押せる板そのもの（位置を測る側へ預ける）。 */
  buttonRef?: RefObject<HTMLButtonElement | null>
}

/** 崩れた四角形の上に、形より大きな文字がはみ出して乗る。押せる板。動きはすべて motion。 */
export function Word(props: Props) {
  const size = props.size === undefined ? 8 : props.size
  const paper = props.paper === undefined ? false : props.paper
  const big = props.big === undefined ? false : props.big
  const tilt = props.tilt === undefined ? -5 : props.tilt
  const rotate = props.rotate === undefined ? -6 : props.rotate
  const from = props.from === undefined ? "right" : props.from
  const delay = props.delay === undefined ? 0 : props.delay
  const className = props.className === undefined ? "" : props.className
  const disabled = props.disabled === undefined ? false : props.disabled
  const modalClose = props.modalClose === undefined ? false : props.modalClose

  const ref = useRef<HTMLButtonElement>(null)
  const shape = useMemo(brokenShape, [])
  const { leaving, going, mark, completion } = useGoing()
  const tone = paper ? "paper" : "ink"
  const active = useActiveMark(ref)
  const [hover, setHover] = useState(false)
  const [focusRing, setFocusRing] = useState(false)
  const secret = className.split(" ").includes("secret")
  const look = WORD_LOOK[tone]
  // 登場：画面外から勢いよく入り、行き過ぎて戻る。退場：吸い込まれるように画面外へ
  const { initial, enter, leave } = flyMotion({ from, rotate, delay })
  const pulse = active
    ? {
        scale: [1, 1.07, 1],
        transition: { duration: 0.8, repeat: Infinity, ease: MOTION_EASE.pop },
      }
    : { scale: 1 }
  const geometry: CSSProperties = {
    ...REVERT,
    position: "absolute",
    left: shape.sl,
    right: shape.sr,
    top: shape.st,
    bottom: shape.sb,
    clipPath: shape.sp,
  }
  const lineColor = active ? look.activeLine : look.line
  return (
    <motion.button
      ref={(element) => {
        ref.current = element
        if (props.buttonRef) props.buttonRef.current = element
      }}
      type="button"
      className={`word ${tone} ${paper ? "cta" : ""} ${className}`}
      aria-label={props.label ?? props.text}
      data-modal-close={modalClose ? "" : undefined}
      data-leaving={mark}
      disabled={disabled || going}
      onClick={(event) => {
        if (!going) props.onClick?.(event.currentTarget)
      }}
      onFocus={(event) =>
        setFocusRing(event.currentTarget.matches(":focus-visible"))
      }
      onBlur={() => setFocusRing(false)}
      onHoverStart={() => setHover(true)}
      onHoverEnd={() => setHover(false)}
      onPointerMove={magnet.onPointerMove}
      onPointerLeave={magnet.onPointerLeave}
      initial={initial}
      {...completion}
      animate={leaving ? leave : enter}
      exit={leave}
      whileHover={going ? undefined : { scale: 1.04 }}
      whileTap={
        going
          ? undefined
          : {
              scale: 0.94,
              transition: { duration: seconds(animationTiming.feedback) },
            }
      }
      style={
        {
          ...REVERT,
          position: "absolute",
          display: "inline-block",
          boxSizing: "border-box",
          margin: 0,
          padding: 0,
          border: 0,
          background: "none",
          font: "inherit",
          color: "inherit",
          lineHeight: 1,
          whiteSpace: "nowrap",
          textAlign: "left",
          cursor: disabled ? "default" : "pointer",
          touchAction: "manipulation",
          pointerEvents: "auto",
          outline: focusRing ? `3px solid ${PALETTE.sage}` : "none",
          outlineOffset: 6,
          fontSize: `calc(var(--u)*${size})`,
          ...props.style,
        } as MotionStyle
      }
    >
      <motion.span
        aria-hidden="true"
        style={{
          ...geometry,
          background: secret
            ? PALETTE.paper
            : active && tone === "ink"
              ? PALETTE.blood
              : look.shade,
        }}
        initial={false}
        animate={
          active
            ? {
                rotate: tilt,
                x: ["0.1em", "0.22em", "0.1em"],
                y: ["0.1em", "0.2em", "0.1em"],
                transition: {
                  duration: 0.8,
                  repeat: Infinity,
                  ease: MOTION_EASE.pop,
                },
              }
            : {
                rotate: tilt,
                x: hover ? "0.16em" : "0.1em",
                y: hover ? "0.14em" : "0.1em",
                transition: { duration: 0.2, ease: MOTION_EASE.out },
              }
        }
      />
      <motion.span
        aria-hidden="true"
        style={{
          ...geometry,
          background: secret
            ? "#3a0f18"
            : active && tone === "ink"
              ? "#3a1820"
              : look.shape,
        }}
        initial={false}
        animate={{
          rotate: hover ? tilt - 3 : tilt,
          x: hover ? "-0.12em" : "0em",
          y: hover ? "-0.06em" : "0em",
          ...pulse,
          transition: {
            rotate: { duration: 0.2, ease: MOTION_EASE.out },
            x: { duration: 0.2, ease: MOTION_EASE.out },
            y: { duration: 0.2, ease: MOTION_EASE.out },
            ...(active
              ? {
                  scale: {
                    duration: 0.8,
                    repeat: Infinity,
                    ease: MOTION_EASE.pop,
                  },
                }
              : {}),
          },
        }}
      >
        {/* 斜線（選ばれている間は細かく流れる） */}
        <motion.span
          style={{
            ...REVERT,
            position: "absolute",
            inset: 0,
            backgroundImage: active
              ? `repeating-linear-gradient(-60deg, transparent 0 0.35em, ${lineColor} 0.35em 0.5em)`
              : `repeating-linear-gradient(-62deg, transparent 0 0.9em, ${lineColor} 0.9em calc(0.9em + 2px))`,
            backgroundSize: active ? "200% 200%" : undefined,
          }}
          animate={
            active
              ? {
                  backgroundPosition: ["0em 0em", "-0.58em 0em"],
                  transition: {
                    duration: 0.6,
                    repeat: Infinity,
                    ease: "linear",
                  },
                }
              : { backgroundPosition: "0em 0em" }
          }
        />
        {/* 網点（右下ほど濃い） */}
        <HalftoneDots
          color={look.dot}
          fade="linear-gradient(115deg, transparent 35%, #000 95%)"
        />
      </motion.span>
      <motion.span
        className="txt"
        aria-hidden="true"
        style={
          {
            ...REVERT,
            position: "relative",
            display: "inline-flex",
            alignItems: "flex-end",
            paintOrder: "stroke fill",
            letterSpacing: "-0.03em",
            color: look.text,
            WebkitTextStroke: `0.09em ${look.stroke}`,
          } as MotionStyle
        }
        animate={pulse}
      >
        {Array.from(props.text).map((c, i) => (
          // 外の span は字ごとの傾きと大きさ、中の motion.span は飛び込み
          <span
            key={i}
            style={{
              ...REVERT,
              display: "inline-block",
              fontSize: `${i === 0 && big ? 1.22 : wordLetterScales[i % wordLetterScales.length]}em`,
              translate: `0 ${((i % 3) - 1) * 0.05}em`,
              rotate: `${i % 2 ? 3 : -3}deg`,
            }}
          >
            <motion.span
              style={{ ...REVERT, display: "inline-block" }}
              initial={{
                opacity: 0,
                y: `${i % 2 ? -0.5 : 0.5}em`,
                rotate: i % 2 ? 25 : -25,
                scale: 2.4,
              }}
              animate={{
                opacity: [0, 1, 1],
                y: "0em",
                rotate: 0,
                scale: 1,
                transition: {
                  duration: seconds(animationTiming.letter),
                  delay: seconds(
                    delay +
                      animationTiming.letterStart +
                      letterDelay(i, props.text.length)
                  ),
                  ease: MOTION_EASE.pop,
                  opacity: {
                    duration: seconds(animationTiming.letter),
                    delay: seconds(
                      delay +
                        animationTiming.letterStart +
                        letterDelay(i, props.text.length)
                    ),
                    times: [0, 0.25, 1],
                  },
                },
              }}
            >
              {c}
            </motion.span>
          </span>
        ))}
      </motion.span>
    </motion.button>
  )
}
