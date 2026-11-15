import { animationTiming } from "@/client/components/stage/timing"
import { useEffect, useLayoutEffect, useRef } from "react"
import type { CSSProperties } from "react"
import { motion } from "motion/react"
import { EASE_OUT, MOTION_EASE } from "@/client/components/stage/kit"
import { seconds } from "@/client/components/stage/seconds"
import { useGoing } from "@/client/components/stage/use-going"
import { usePortrait } from "@/client/components/stage/use-portrait"
import { REVERT } from "@/client/components/canvas/tokens"
import { play } from "@/client/components/canvas/play"
import type { RevolverItem } from "@/client/components/stage/revolver-shared"
import { Dest } from "@/client/components/stage/dest"

/**
 * 画面右の外にある大きな円の縁に札を並べ、回して選ぶ。ホイール・矢印キー・縦ドラッグに対応。
 * 選んでいる札をもう一度押すと onConfirm。
 */
type Props = {
  items: readonly RevolverItem[]
  selected: number
  onSelect: (index: number) => void
  onConfirm?: (index: number) => void
  label: string
  choice?: boolean
  ownEnter?: boolean
  disabled?: boolean
  style?: CSSProperties
}

export function Revolver(props: Props) {
  const choice = props.choice === undefined ? false : props.choice
  const ownEnter = props.ownEnter === undefined ? false : props.ownEnter
  const disabled = props.disabled === undefined ? false : props.disabled

  const box = useRef<HTMLDivElement>(null)
  const { leaving, going, mark, completion } = useGoing()
  const sel = useRef(props.selected)
  sel.current = props.selected
  const set = (index: number) => {
    if (!disabled && !going && !box.current?.closest("[inert]"))
      props.onSelect(Math.max(0, Math.min(props.items.length - 1, index)))
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
    if (disabled || going) return
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
      if (event.ctrlKey || event.metaKey || event.altKey) return
      if (event.defaultPrevented || el.closest("[inert]")) return
      const modal = el.closest(".game")?.querySelector('[aria-modal="true"]')
      if (modal && !modal.contains(el)) return
      if (el.closest(".game")?.querySelector(".target-dim")) return
      const step = { ArrowDown: 1, s: 1, ArrowUp: -1, w: -1 }[event.key]
      if (step) {
        event.preventDefault()
        set(sel.current + step)
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
      aria-label={props.label}
      tabIndex={0}
      data-own-enter={ownEnter ? "1" : undefined}
      data-leaving={mark}
      onKeyDown={(event) => {
        if (event.ctrlKey || event.metaKey || event.altKey) return
        if (!ownEnter || disabled || going || event.defaultPrevented) return
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          props.onConfirm?.(sel.current)
        }
      }}
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
        ...props.style,
      }}
    >
      {props.items.map((item, k) => (
        <Dest
          key={item.key}
          item={item}
          d={k - props.selected}
          step={step}
          choice={choice}
          portrait={portrait}
          onClick={() => {
            if (!disabled && !going) {
              if (k === props.selected) props.onConfirm?.(k)
              else set(k)
            }
          }}
        />
      ))}
    </motion.div>
  )
}
