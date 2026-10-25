import { animationTiming } from "@/components/stage/timing"
import { useEffect, useLayoutEffect, useRef, type CSSProperties } from "react"
import { motion } from "motion/react"
import { EASE_OUT, MOTION_EASE, seconds } from "@/components/stage/kit"
import { useGoing, usePortrait } from "@/components/stage/word"
import { useActiveMark } from "@/components/canvas/state"
import { PALETTE, REVERT, unit } from "@/components/canvas/tokens"
import { play } from "@/components/canvas/play"
import { HalftoneDots } from "@/components/canvas/paper"

export type RevolverItem = {
  key: string
  no?: string | number
  unit?: string
  name: string
  note?: string
  locked?: boolean
}

/**
 * 画面右の外にある大きな円の縁に札を並べ、回して選ぶ。ホイール・矢印キー・縦ドラッグに対応。
 * 選んでいる札をもう一度押すと onConfirm。
 */
export function Revolver({
  items,
  selected,
  onSelect,
  onConfirm,
  label,
  choice = false,
  ownEnter = false,
  disabled = false,
  style,
}: {
  items: readonly RevolverItem[]
  selected: number
  onSelect: (index: number) => void
  onConfirm?: (index: number) => void
  label: string
  choice?: boolean
  ownEnter?: boolean
  disabled?: boolean
  style?: CSSProperties
}) {
  const box = useRef<HTMLDivElement>(null)
  const { leaving, mark, completion } = useGoing()
  const sel = useRef(selected)
  sel.current = selected
  const set = (index: number) => {
    if (!disabled) onSelect(Math.max(0, Math.min(items.length - 1, index)))
  }

  // 入場：札が右から順に回り込んでくる
  useLayoutEffect(() => {
    for (const [k, el] of [...(box.current?.children ?? [])].entries())
      play(el, [{ transform: "translateX(70vw)" }, { transform: "none" }], {
        duration: animationTiming.enter,
        delay: animationTiming.feedback + k * animationTiming.stagger,
        easing: EASE_OUT,
        fill: "both",
      })
    box.current?.focus({ preventScroll: true })
  }, [])

  useEffect(() => {
    if (disabled) return
    const el = box.current
    if (!el) return
    let acc = 0
    let lock = 0
    const wheel = (event: WheelEvent) => {
      event.preventDefault()
      acc += event.deltaY
      const now = performance.now()
      if (Math.abs(acc) > 40 && now - lock > 160) {
        set(sel.current + Math.sign(acc))
        acc = 0
        lock = now
      }
    }
    let startY: number | null = null
    let startSel = 0
    const down = (event: PointerEvent) => {
      startY = event.clientY
      startSel = sel.current
    }
    const move = (event: PointerEvent) => {
      if (startY === null) return
      const step = Math.round((startY - event.clientY) / (innerHeight * 0.12))
      if (startSel + step !== sel.current) set(startSel + step)
    }
    const up = () => (startY = null)
    const key = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return
      const modal = el.closest(".game")?.querySelector('[aria-modal="true"]')
      if (modal && !modal.contains(el)) return
      const step = { ArrowDown: 1, s: 1, ArrowUp: -1, w: -1 }[event.key]
      if (step) {
        event.preventDefault()
        set(sel.current + step)
      }
      if (ownEnter && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault()
        onConfirm?.(sel.current)
      }
    }
    el.addEventListener("wheel", wheel, { passive: false })
    el.addEventListener("pointerdown", down)
    addEventListener("pointermove", move)
    addEventListener("pointerup", up)
    addEventListener("keydown", key)
    return () => {
      el.removeEventListener("wheel", wheel)
      el.removeEventListener("pointerdown", down)
      removeEventListener("pointermove", move)
      removeEventListener("pointerup", up)
      removeEventListener("keydown", key)
    }
  })

  const portrait = usePortrait()
  const step = portrait ? -19 : -12
  // 退場：まとめて右の外へ回り出る
  const leave = {
    x: "120vw",
    rotate: 15,
    transition: {
      duration: seconds(animationTiming.exit),
      ease: MOTION_EASE.in,
    },
  }
  return (
    <motion.div
      ref={box}
      className={`revolver ${choice ? "choice" : ""}`}
      role="listbox"
      aria-label={label}
      tabIndex={0}
      data-own-enter={ownEnter ? "1" : undefined}
      data-leaving={mark}
      initial={false}
      {...completion}
      animate={leaving ? leave : { x: 0, rotate: 0 }}
      exit={leave}
      style={{
        ...REVERT,
        display: "block",
        position: "absolute",
        right: 0,
        top: 0,
        bottom: 0,
        width: portrait ? "62%" : "50%",
        touchAction: "none",
        outline: "none",
        pointerEvents: "auto",
        ...style,
      }}
    >
      {items.map((item, k) => (
        <Dest
          key={item.key}
          item={item}
          d={k - selected}
          step={step}
          choice={choice}
          portrait={portrait}
          onClick={() => {
            if (!disabled) {
              if (k === selected) onConfirm?.(k)
              else set(k)
            }
          }}
        />
      ))}
    </motion.div>
  )
}

const PLATE_CLIP =
  "polygon(0 18%, 30% 0, 72% 8%, 100% 2%, 96% 80%, 58% 100%, 5% 90%)"

/** リボルバーの札一枚。d は選んでいる札からのずれ。 */
function Dest({
  item,
  d,
  step,
  choice,
  portrait,
  onClick,
}: {
  item: RevolverItem
  d: number
  step: number
  choice: boolean
  /** 縦長の画面。札が狭いので数字を抑え、説明を読める大きさにする。 */
  portrait: boolean
  onClick: () => void
}) {
  const ref = useRef<HTMLButtonElement>(null)
  const active = useActiveMark(ref)
  const on = d === 0
  const far = Math.abs(d)
  // 縦長の画面は説明が何行にもなるので、名前まで紙に乗るよう紙を上まで伸ばす
  const plate: CSSProperties = {
    ...REVERT,
    position: "absolute",
    inset: choice ? "14% 0 0 5%" : portrait ? "10% 0 4% 9%" : "30% 0 4% 9%",
    clipPath: PLATE_CLIP,
  }
  const nameColor = item.locked
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
        rotate: `${d * step}deg`,
        scale: 1 - Math.min(1, far) * 0.3 - Math.max(0, far - 1) * 0.1,
        opacity: 1 - far * 0.3,
        filter: `brightness(${1 - Math.min(1, far) * 0.45})`,
      }}
      ref={ref}
      type="button"
      role="option"
      aria-selected={on}
      aria-label={`${item.no ?? ""}${item.unit ?? ""} ${item.name} ${item.note ?? ""}`.trim()}
      className={`dest ${on ? "on" : ""} ${item.locked ? "locked" : ""}`}
      hidden={far > 2.5}
      onClick={onClick}
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
          gridTemplateColumns: choice
            ? "minmax(0, 1fr)"
            : "auto minmax(0, 1fr)",
          alignItems: "end",
          gap: `0 ${unit(portrait ? 2.6 : 1.6)}`,
          padding: choice
            ? `${unit(4.4)} ${unit(portrait ? 5 : 7)} ${unit(2.6)} ${unit(9)}`
            : `${unit(portrait ? 2.4 : 0)} ${unit(portrait ? 5 : 7)} ${unit(2.6)} 0`,
        }}
      >
        {item.no !== undefined ? (
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
                fontSize: unit(portrait ? 11 : 20),
                lineHeight: 0.8,
                color: PALETTE.paper,
                WebkitTextStroke: `0.05em ${PALETTE.ink}`,
                paintOrder: "stroke fill",
                textShadow: `0.05em 0.05em 0 ${PALETTE.blood}`,
                translate: "-8% 0",
              } as CSSProperties
            }
          >
            {item.no}
            <small
              style={{
                ...REVERT,
                fontSize: "0.26em",
                letterSpacing: "0.05em",
                marginLeft: "-0.1em",
              }}
            >
              {item.unit}
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
          {item.name}
        </span>
        {item.note ? (
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
                fontSize: unit(portrait ? 3.2 : 1.9),
                marginTop: unit(portrait ? 0.8 : 0),
                letterSpacing: portrait ? "0.02em" : "0.08em",
                lineHeight: 1.35,
                overflowWrap: "anywhere",
                color: on ? PALETTE.blood : "rgb(238 235 227 / 0.65)",
              } as CSSProperties
            }
          >
            {item.note}
          </span>
        ) : null}
      </span>
    </motion.button>
  )
}
