import { useLayoutEffect, useRef } from "react"
import { GoodIcon } from "@/client/components/game/good-icon"
import { COLOR, EASE_IN, EASE_POP } from "@/client/components/stage/kit"
import { useWide } from "@/client/components/stage/use-wide"
import { BUTTON_BASE } from "@/client/components/canvas/tokens"
import { play } from "@/client/components/canvas/play"
import type { LootItem } from "@/client/components/game/loot-shared"

type Props = { item: LootItem; onClose: () => void }

export function Detail(props: Props) {
  const wide = useWide()
  const card = useRef<HTMLSpanElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  const closing = useRef(false)
  const previousFocus = useRef<HTMLElement | null>(null)
  useLayoutEffect(() => {
    const previous = document.activeElement
    const button = closeButton.current
    if (previous instanceof HTMLElement && previous !== button)
      previousFocus.current = previous
    button?.focus()
    return () => {
      queueMicrotask(() => {
        if (button?.isConnected) return
        if (previousFocus.current?.isConnected) previousFocus.current.focus()
      })
    }
  }, [])
  useLayoutEffect(() => {
    play(
      card.current,
      [
        { transform: "scale(.4) rotate(-12deg)", opacity: 0 },
        { transform: "none", opacity: 1 },
      ],
      { duration: 380, easing: EASE_POP, fill: "both" }
    )
  }, [])
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${props.item.name}の詳細`}
      style={{ position: "absolute", inset: 0, zIndex: 30 }}
      onKeyDown={(event) => {
        if (event.ctrlKey || event.metaKey || event.altKey) return
        if (event.key === "Tab") {
          event.preventDefault()
          closeButton.current?.focus()
        }
      }}
    >
      <button
        ref={closeButton}
        data-modal-close
        type="button"
        aria-label={`${props.item.name}の詳細を閉じる`}
        onClick={() => {
          if (closing.current) return
          closing.current = true
          void play(
            card.current,
            [
              { transform: "none" },
              { transform: "translateX(-110vw) rotate(-10deg)" },
            ],
            { duration: 240, easing: EASE_IN, fill: "both" }
          ).finished.then(props.onClose)
        }}
        style={{
          ...BUTTON_BASE,
          position: "absolute",
          inset: 0,
          zIndex: 30,
          background: "rgb(11 12 18 / .7)",
          pointerEvents: "auto",
        }}
      >
        <span
          ref={card}
          style={{
            position: "absolute",
            left: wide ? "22%" : "6%",
            right: wide ? "22%" : "6%",
            top: wide ? "18%" : "16%",
            display: "flex",
            gap: "calc(var(--u)*3)",
            alignItems: "center",
            padding: "calc(var(--u)*4)",
            background: COLOR.paper,
            color: COLOR.ink,
            rotate: "-3deg",
            textAlign: "left",
            clipPath: "polygon(2% 4%, 100% 0, 98% 96%, 0 100%)",
          }}
        >
          <span
            style={{
              flex: "none",
              display: "grid",
              placeItems: "center",
              width: `calc(var(--u)*${wide ? 22 : 24})`,
              aspectRatio: 1,
              background: COLOR.ink,
              clipPath:
                "polygon(6% 10%, 62% 0, 100% 14%, 94% 86%, 40% 100%, 0 88%)",
            }}
          >
            <GoodIcon id={props.item.icon} iconSize="60%" />
          </span>
          <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>
            <span
              style={{
                display: "block",
                fontSize: `calc(var(--u)*${wide ? 7 : 6.4})`,
                lineHeight: 1.1,
              }}
            >
              {props.item.name}{" "}
              <span style={{ color: COLOR.blood }}>{props.item.n}</span>
            </span>
            <span
              style={{
                display: "block",
                marginTop: "calc(var(--u)*1.6)",
                fontSize: `max(12px, calc(var(--u)*${wide ? 2.8 : 3}))`,
                fontWeight: 700,
                lineHeight: 1.6,
                whiteSpace: "pre-line",
              }}
            >
              {props.item.desc}
            </span>
          </span>
        </span>
      </button>
    </div>
  )
}
