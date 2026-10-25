import { after } from "@/components/canvas/animation"
import { useAnimationEffect } from "@/components/canvas/use-animation"
import { animationTiming } from "@/components/stage/timing"
import { useLayoutEffect, useRef, useState } from "react"
import { GoodIcon } from "@/components/game/art"
import { COLOR, EASE_IN, EASE_OUT, EASE_POP } from "@/components/stage/kit"
import { SlantPanel, type PanelHandle } from "@/components/stage/panel"
import { useFx } from "@/components/stage/use-fx"
import { Word, useWide } from "@/components/stage/word"
import { BUTTON_BASE } from "@/components/canvas/tokens"
import { play } from "@/components/canvas/play"
import { useActiveMark } from "@/components/canvas/state"
import type { ComponentProps } from "react"

function LootPageButton(props: ComponentProps<"button">) {
  const button = useRef<HTMLButtonElement>(null)
  const active = useActiveMark(button)
  return (
    <button
      {...props}
      ref={button}
      data-loot-page
      style={{
        ...props.style,
        outline: active ? `3px solid ${COLOR.blood}` : undefined,
        outlineOffset: 2,
      }}
    />
  )
}

export type LootItem = {
  key: string
  icon: string
  name: string
  n: string
  desc: string
  /** 当たりの品（光るガラクタなど）。金色の縁と光で出す。 */
  rare?: boolean
}

/** 当たりの品の色。 */
const RARE_GOLD = "#b8901c"

function LootCard({
  item,
  index,
  place,
  onOpen,
}: {
  item: LootItem
  index: number
  place: { left: string; top: string; r: number; s: number }
  onOpen: () => void
}) {
  const ref = useRef<HTMLButtonElement>(null)
  const fx = useFx()
  const wide = useWide()
  useAnimationEffect(() => {
    const entrance = play(
      ref.current,
      [
        {
          easing: EASE_OUT,
          transform: "translateX(90vw) rotate(30deg) scale(1.4)",
        },
        { transform: "translateX(-2vw) scale(1.05)", offset: 0.7 },
        { transform: "none" },
      ],
      {
        duration: animationTiming.enter,
        delay: animationTiming.feedback + index * animationTiming.stagger,
        fill: "both",
      }
    )
    after(entrance, () => {
      const c = fx.center(ref.current?.firstElementChild ?? null)
      fx.burst(c.x, c.y, c.w * (item.rare ? 2.2 : 1.5), "", {
        fill: item.rare ? RARE_GOLD : COLOR.blood,
        ink: COLOR.paper,
        hold: item.rare ? 800 : 520,
      })
      fx.shards(c.x, c.y, {
        n: item.rare ? 30 : 10,
        power: item.rare ? 2 : 0.8,
        ...(item.rare ? { colors: [RARE_GOLD, COLOR.paper, COLOR.ink] } : {}),
      })
      if (item.rare) fx.flash(RARE_GOLD, 0.6)
      fx.shake(item.rare ? 1.2 : 0.4)
    })
  }, [fx, index, item.rare])
  return (
    <button
      ref={ref}
      type="button"
      className="slot-item"
      aria-label={`${item.name} ${item.n}`}
      onClick={onOpen}
      style={{
        ...BUTTON_BASE,
        position: "absolute",
        left: place.left,
        top: place.top,
        rotate: `${place.r}deg`,
        textAlign: "left",
        pointerEvents: "auto",
      }}
    >
      <span
        style={{
          position: "relative",
          display: "block",
          width: `calc(var(--u)*${place.s})`,
          aspectRatio: 1.05,
          filter: `drop-shadow(calc(var(--u)*1) calc(var(--u)*1) 0 ${item.rare ? RARE_GOLD : COLOR.blood})`,
        }}
      >
        <span
          style={{
            position: "absolute",
            inset: 0,
            background: COLOR.paper,
            clipPath:
              "polygon(6% 10%, 62% 0, 100% 14%, 94% 86%, 40% 100%, 0 88%)",
          }}
        />
        <span
          style={{
            position: "absolute",
            inset: "calc(var(--u)*.9)",
            display: "grid",
            placeItems: "center",
            background: COLOR.ink,
            clipPath:
              "polygon(6% 10%, 62% 0, 100% 14%, 94% 86%, 40% 100%, 0 88%)",
          }}
        >
          <GoodIcon id={item.icon} iconSize="60%" />
        </span>
      </span>
      <span
        style={{
          position: "absolute",
          left: "62%",
          top: "58%",
          whiteSpace: "nowrap",
          width: `calc(var(--u)*${wide ? 24 : 32})`,
        }}
      >
        <span
          style={
            {
              display: "block",
              fontSize: `calc(var(--u)*${wide ? 6 : 7})`,
              lineHeight: 1,
              color: COLOR.paper,
              WebkitTextStroke: `.06em ${COLOR.ink}`,
              paintOrder: "stroke fill",
              textShadow: `.06em .06em 0 ${COLOR.blood}`,
            } as React.CSSProperties
          }
        >
          {item.n}
        </span>
        <span
          style={{
            display: "inline-block",
            marginTop: ".2em",
            padding: ".05em .5em",
            background: COLOR.paper,
            color: COLOR.ink,
            fontSize: "max(12px, calc(var(--u)*2.6))",
            maxWidth: `calc(var(--u)*${wide ? 24 : 32})`,
            boxSizing: "border-box",
            whiteSpace: "normal",
            overflowWrap: "anywhere",
          }}
        >
          {item.name}
        </span>
      </span>
    </button>
  )
}

function Detail({ item, onClose }: { item: LootItem; onClose: () => void }) {
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
      aria-label={`${item.name}の詳細`}
      style={{ position: "absolute", inset: 0, zIndex: 30 }}
      onKeyDown={(event) => {
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
        aria-label={`${item.name}の詳細を閉じる`}
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
          ).finished.then(onClose)
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
            <GoodIcon id={item.icon} iconSize="60%" />
          </span>
          <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>
            <span
              style={{
                display: "block",
                fontSize: `calc(var(--u)*${wide ? 7 : 6.4})`,
                lineHeight: 1.1,
              }}
            >
              {item.name} <span style={{ color: COLOR.blood }}>{item.n}</span>
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
              {item.desc}
            </span>
          </span>
        </span>
      </button>
    </div>
  )
}

/** 戦利品・宝箱・罠を3品ずつ並べる。押すと詳細、「OK」で閉じる。 */
export function LootPanel({
  title,
  items,
  onOk,
}: {
  title: string
  items: readonly LootItem[]
  onOk: () => void
}) {
  const wide = useWide()
  const fx = useFx()
  const panel = useRef<PanelHandle>(null)
  const [detail, setDetail] = useState<LootItem | null>(null)
  const [closing, setClosing] = useState(false)
  const [page, setPage] = useState(0)
  const pageCount = Math.ceil(items.length / 3)
  const visibleItems = items.slice(page * 3, page * 3 + 3)
  useLayoutEffect(() => fx.shake(0.8).cancel, [fx])
  const places = wide
    ? [
        { left: "10%", top: "34%", r: -6, s: 15 },
        { left: "36%", top: "40%", r: 4, s: 14 },
        { left: "60%", top: "32%", r: -3, s: 13 },
      ]
    : [
        { left: "6%", top: "22%", r: -5, s: 20 },
        { left: "48%", top: "30%", r: 5, s: 18 },
        { left: "12%", top: "46%", r: -3, s: 18 },
      ]
  return (
    <SlantPanel
      ref={panel}
      title={title}
      inset={wide ? { top: "6%", bottom: "4%" } : { top: "5%", bottom: "30%" }}
      headSize={wide ? 8 : 9}
      headStyle={wide ? { left: "6%", top: "9%" } : undefined}
    >
      {visibleItems.map((item, i) => (
        <LootCard
          key={item.key}
          item={item}
          index={i}
          place={
            visibleItems.length === 1
              ? { ...places[1], left: wide ? "38%" : "30%" }
              : places[i % places.length]
          }
          onOpen={() => setDetail(item)}
        />
      ))}
      {pageCount > 1 && !closing ? (
        <div
          aria-label="戦利品のページ"
          style={{
            position: "absolute",
            left: "6%",
            bottom: "6%",
            display: "flex",
            alignItems: "center",
            gap: 6,
            zIndex: 28,
            pointerEvents: "auto",
            color: COLOR.paper,
            fontSize: 13,
          }}
        >
          <LootPageButton
            type="button"
            aria-label="前の戦利品"
            disabled={page === 0}
            onClick={() => setPage((current) => current - 1)}
            style={{
              ...BUTTON_BASE,
              width: 44,
              height: 44,
              background: COLOR.paper,
              color: COLOR.ink,
              opacity: page === 0 ? 0.4 : 1,
            }}
          >
            前へ
          </LootPageButton>
          <span role="status" aria-label="戦利品のページ数">
            {page + 1}/{pageCount}
          </span>
          <LootPageButton
            type="button"
            aria-label="次の戦利品"
            disabled={page + 1 === pageCount}
            onClick={() => setPage((current) => current + 1)}
            style={{
              ...BUTTON_BASE,
              width: 44,
              height: 44,
              background: COLOR.paper,
              color: COLOR.ink,
              opacity: page + 1 === pageCount ? 0.4 : 1,
            }}
          >
            次へ
          </LootPageButton>
        </div>
      ) : null}
      {detail ? <Detail item={detail} onClose={() => setDetail(null)} /> : null}
      {!closing ? (
        <Word
          text="OK"
          size={wide ? 16 : 15}
          paper
          big
          tilt={-4}
          rotate={-7}
          from="right"
          delay={animationTiming.enter}
          style={{
            zIndex: 28,
            pointerEvents: "auto",
            ...(wide
              ? { right: "3vw", bottom: "10%" }
              : { right: "0vw", bottom: "6%" }),
          }}
          onClick={async () => {
            setClosing(true)
            await panel.current?.close()
            onOk()
          }}
        />
      ) : null}
    </SlantPanel>
  )
}
