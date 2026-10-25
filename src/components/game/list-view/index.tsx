import { useAnimationEffect } from "@/components/canvas/use-animation"
import { frame, cancelFrame } from "motion"
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react"
import { AnimatePresence } from "motion/react"
import { COLOR, EASE_POP } from "@/components/stage/kit"
import { PALETTE, REVERT, unit } from "@/components/canvas/tokens"
import { SlantPanel } from "@/components/stage/panel"
import { useFx } from "@/components/stage/use-fx"
import { Word, useWide } from "@/components/stage/word"
import { play } from "@/components/canvas/play"
import { TornPlate } from "@/components/canvas/paper"
import { type Row, type Tab, type At } from "./types"
import { RowButton } from "./row"
import { TabButton } from "./tab"
import { DetailCard } from "./detail"

/**
 * 見出しの大きさ。長い題（「鍛え直し：アルマ」など）は小さくして、
 * 右上の「‹ 戻る」に重ならないようにする。
 */
function headSize(title: string, wide: boolean) {
  const full = wide ? 7 : 8
  const fits = wide ? 7 : 5
  if (title.length <= fits) return full
  return Math.max(wide ? 4 : 4.2, (full * fits) / title.length)
}

/**
 * 主操作の文字の大きさ。長い言葉（「素材にして打ち直す」など）は小さくして、
 * スマホでも画面の左右からはみ出さないようにする。
 */
function actionSize(label: string, wide: boolean) {
  const full = 11
  const fits = wide ? 8 : 5
  if (label.length <= fits) return full
  return Math.max(wide ? 5.5 : 4.6, (full * fits) / label.length)
}

/**
 * 一覧の画面。斜めに塗り替わるトーンの板に、横長の行を縦に並べる。枠の中だけでスクロールし、つまみも角ばった独自の形。
 * 押すと詳細、主操作と「‹ 戻る」。店・バッグ・依頼・募集で共通。
 */
export function ListView({
  title,
  tabs,
  gold,
  action,
  onAction,
  onClose,
  kind = "",
  extra,
  notice,
  closeLabel = "‹ 戻る",
  detailLabel = "選んだ品の詳細",
  closeSignal = 0,
  tab: initialTab = 0,
  initialRowKey,
}: {
  title: string
  tabs: readonly Tab[]
  gold?: number
  /** 一覧全体にかかる操作（募集の引き直しなど）。 */
  extra?: { label: string; onClick: () => void }
  notice?: ReactNode
  /** 閉じるボタンの文字。 */
  closeLabel?: string
  /** 詳細領域を読み上げる名前。 */
  detailLabel?: string
  /** 増えるたびに外から閉じる（バッグのボタンでも閉じる）。 */
  closeSignal?: number
  /** 最初に開いておくタブ。 */
  tab?: number
  /** 最初に詳細を表示する行。 */
  initialRowKey?: string
  action?: (row: Row) => string | null
  onAction?: (row: Row, at: At) => void
  onClose: () => void
  kind?: string
}) {
  const wide = useWide()
  const fx = useFx()
  const [selectedTabName, setSelectedTabName] = useState(tabs[initialTab]?.name)
  const tab = Math.max(
    0,
    tabs.findIndex((entry) => entry.name === selectedTabName)
  )
  const [picked, setPicked] = useState<string | null>(initialRowKey ?? null)
  // 閉じる：AnimatePresence が板と札を外へ送り、送り終わってから親へ知らせる
  const [open, setOpen] = useState(true)
  const grid = useRef<HTMLDivElement>(null)
  const noticeBox = useRef<HTMLDivElement>(null)
  const bar = useRef<HTMLDivElement>(null)
  const thumb = useRef<HTMLElement>(null)
  const money = useRef<HTMLElement>(null)
  const actionWord = useRef<HTMLButtonElement>(null)
  const previousGold = useRef(gold)
  const rows = tabs[tab]?.rows ?? []
  const selected = rows.find((row) => row.key === picked) ?? null
  const label = selected && action ? action(selected) : null
  const z = kind ? 29 : 26

  useLayoutEffect(() => fx.shake(0.6).cancel, [fx])

  useLayoutEffect(() => {
    const element = noticeBox.current
    if (!element) return
    const measure = () =>
      element.parentElement?.style.setProperty(
        "--notice-height",
        `${element.offsetHeight}px`
      )
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [notice])

  useAnimationEffect(() => {
    if (
      gold === undefined ||
      previousGold.current === undefined ||
      previousGold.current === gold
    )
      return
    play(
      money.current,
      [
        {
          scale: 1.6,
          color: gold < previousGold.current ? COLOR.blood : COLOR.sage,
        },
        { scale: 1, color: COLOR.paper },
      ],
      { duration: 380, easing: EASE_POP }
    )
    previousGold.current = gold
  }, [gold])

  const sync = () => {
    const g = grid.current
    if (!g || !bar.current || !thumb.current) return
    const max = g.scrollHeight - g.clientHeight
    bar.current.style.display = max > 2 ? "block" : "none"
    const h = Math.max(0.14, g.clientHeight / Math.max(1, g.scrollHeight))
    thumb.current.style.height = `${h * 100}%`
    play(
      thumb.current,
      [
        { top: getComputedStyle(thumb.current).top },
        { top: `${max > 0 ? (g.scrollTop / max) * (1 - h) * 100 : 0}%` },
      ],
      { duration: 80, fill: "both", id: "scroll" }
    )
  }
  useLayoutEffect(() => {
    frame.postRender(sync)
    return () => cancelFrame(sync)
  })

  const close = () => setOpen(false)
  // 開いた後に合図が変わったときだけ閉じる（開いた時点の値では閉じない）
  const openedWith = useRef(closeSignal)
  useEffect(() => {
    if (closeSignal !== openedWith.current) setOpen(false)
  }, [closeSignal])

  return (
    <AnimatePresence onExitComplete={onClose}>
      {open ? (
        <div
          key="listview"
          className={`listview ${kind}`}
          style={{
            position: "absolute",
            inset: 0,
            zIndex: z,
            pointerEvents: "none",
          }}
        >
          <SlantPanel
            z={0}
            rotate={-3}
            inset={
              wide ? { top: "5%", bottom: "3%" } : { top: "4%", bottom: "3%" }
            }
            title={title}
            headSize={headSize(title, wide)}
            headStyle={{ left: "5%", top: wide ? "8%" : "6%", rotate: "-6deg" }}
          />
          {gold !== undefined ? (
            <div
              aria-live="polite"
              style={{
                position: "absolute",
                ...(wide
                  ? { right: "18%", top: "9%" }
                  : { right: "5%", top: "17%" }),
                rotate: "-4deg",
                whiteSpace: "nowrap",
                color: COLOR.paper,
                fontSize: "calc(var(--u)*2.6)",
              }}
            >
              所持金{" "}
              <b
                ref={money}
                style={
                  {
                    display: "inline-block",
                    fontSize: "2em",
                    WebkitTextStroke: `.06em ${COLOR.ink}`,
                    paintOrder: "stroke fill",
                    textShadow: `.06em .06em 0 ${COLOR.blood}`,
                  } as CSSProperties
                }
              >
                {gold}
              </b>{" "}
              G
            </div>
          ) : null}
          {notice ? (
            <div
              ref={noticeBox}
              style={{
                position: "absolute",
                top: wide
                  ? kind === "demon-contracts"
                    ? "28%"
                    : "20%"
                  : "22%",
                left: "5%",
                right: wide ? "44%" : "5%",
              }}
            >
              {notice}
            </div>
          ) : null}
          {extra ? (
            <TabButton
              onClick={extra.onClick}
              style={{
                position: "absolute",
                ...(wide
                  ? { right: "18%", top: "17%" }
                  : { right: "5%", top: "24%" }),
                rotate: "-4deg",
                padding: ".2em .9em",
                fontSize: `calc(var(--u)*${wide ? 2.8 : 3.2})`,
                color: COLOR.ink,
                pointerEvents: "auto",
              }}
            >
              <TornPlate
                background={COLOR.paper}
                clip="polygon(6% 0, 100% 8%, 94% 100%, 0 90%)"
              />
              <span style={{ position: "relative" }}>{extra.label}</span>
            </TabButton>
          ) : null}
          {tabs.length > 1 ? (
            <div
              style={{
                position: "absolute",
                ...(wide
                  ? {
                      left: "6%",
                      top: kind === "demon-contracts" ? "20%" : "23%",
                    }
                  : { left: "5%", top: "15%" }),
                display: "flex",
                gap: "calc(var(--u)*1.2)",
                pointerEvents: "auto",
              }}
            >
              {tabs.map((entry, i) => (
                <TabButton
                  key={entry.name}
                  on={i === tab}
                  onClick={() => {
                    setSelectedTabName(entry.name)
                    setPicked(null)
                  }}
                  style={{
                    position: "relative",
                    padding: ".15em .8em",
                    fontSize: `calc(var(--u)*${wide ? 3 : 3.4})`,
                    color: i === tab ? COLOR.ink : COLOR.paper,
                  }}
                >
                  <TornPlate
                    background={i === tab ? COLOR.paper : COLOR.ink}
                    clip="polygon(6% 0, 100% 8%, 94% 100%, 0 90%)"
                    style={{
                      outline: `2px solid ${COLOR.paper}`,
                      outlineOffset: -2,
                    }}
                  />
                  <span style={{ position: "relative" }}>{entry.name}</span>
                </TabButton>
              ))}
            </div>
          ) : null}
          <div
            className="rowsbox"
            style={{
              position: "absolute",
              ...(wide
                ? {
                    left: "5%",
                    right: "44%",
                    top: notice
                      ? `calc(${kind === "demon-contracts" ? "28%" : "20%"} + var(--notice-height, 90px) + ${unit(3)})`
                      : "32%",
                    bottom: "9%",
                  }
                : {
                    left: "4%",
                    right: "9%",
                    top: notice
                      ? `calc(22% + var(--notice-height, 90px) + ${unit(3)})`
                      : "22%",
                    bottom: kind === "exploration-finds" ? "39%" : "40%",
                  }),
              pointerEvents: "auto",
              rotate: "-2deg",
            }}
          >
            <div
              className="rows grid"
              ref={grid}
              onScroll={sync}
              key={tab}
              style={{
                ...REVERT,
                position: "absolute",
                inset: `0 ${unit(3.4)} 0 0`,
                overflowY: "auto",
                overflowX: "hidden",
                scrollbarWidth: "none",
                overscrollBehavior: "contain",
                display: "flex",
                flexDirection: "column",
                gap: unit(1.1),
                padding: `${unit(1)} ${unit(1.4)} ${unit(4)} ${unit(1)}`,
                WebkitMaskImage:
                  "linear-gradient(180deg, transparent, #000 4%, #000 90%, transparent)",
                maskImage:
                  "linear-gradient(180deg, transparent, #000 4%, #000 90%, transparent)",
              }}
            >
              {rows.length ? (
                rows.map((row, i) => (
                  <RowButton
                    key={row.key}
                    row={row}
                    index={i}
                    picked={row.key === picked}
                    onPick={() => setPicked(row.key)}
                  />
                ))
              ) : (
                <p
                  style={{
                    padding: "1em",
                    color: "rgb(238 235 227 / .5)",
                    fontSize: "calc(var(--u)*2.4)",
                    fontWeight: 700,
                  }}
                >
                  何もない
                </p>
              )}
            </div>
            <div
              className="sbar"
              ref={bar}
              aria-hidden="true"
              style={{
                ...REVERT,
                position: "absolute",
                right: 0,
                top: "2%",
                bottom: "6%",
                width: unit(1.8),
                background: PALETTE.ink,
                clipPath: "polygon(0 1%, 100% 0, 100% 100%, 0 99%)",
                boxShadow: "inset 0 0 0 2px rgb(238 235 227 / 0.4)",
              }}
            >
              <i
                className="thumb"
                ref={thumb}
                style={{
                  ...REVERT,
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: 0,
                  background:
                    "repeating-linear-gradient(-60deg, #eeebe3 0 6px, #6b1723 6px 10px)",
                  clipPath: "polygon(0 6%, 100% 0, 100% 94%, 0 100%)",
                  cursor: "grab",
                }}
                onPointerDown={(event) => {
                  event.preventDefault()
                  const g = grid.current
                  const b = bar.current?.getBoundingClientRect()
                  if (!g || !b) return
                  const y0 = event.clientY
                  const s0 = g.scrollTop
                  const move = (ev: PointerEvent) =>
                    (g.scrollTop =
                      s0 + (ev.clientY - y0) * (g.scrollHeight / b.height))
                  const up = () => {
                    removeEventListener("pointermove", move)
                    removeEventListener("pointerup", up)
                  }
                  addEventListener("pointermove", move)
                  addEventListener("pointerup", up)
                }}
              />
            </div>
          </div>
          <div
            className="detail"
            role="region"
            aria-label={detailLabel}
            tabIndex={selected ? 0 : -1}
            onKeyDown={(event) => {
              if (event.key !== "Home" && event.key !== "End") return
              event.preventDefault()
              event.stopPropagation()
              event.currentTarget.scrollTop =
                event.key === "Home" ? 0 : event.currentTarget.scrollHeight
            }}
            key={selected?.key ?? "empty-detail"}
            style={{
              position: "absolute",
              ...(wide
                ? { right: "5%", top: "26%", bottom: "32%", width: "33%" }
                : {
                    left: "5%",
                    right: "5%",
                    bottom: kind === "exploration-finds" ? "12%" : "20%",
                    height: kind === "exploration-finds" ? "26%" : "19%",
                  }),
              pointerEvents: selected ? "auto" : "none",
              overflowY: "auto",
              overflowX: "hidden",
              overscrollBehavior: "contain",
              scrollbarWidth: "thin",
              scrollbarColor: `${COLOR.paper} transparent`,
              padding: "calc(var(--u)*1) calc(var(--u)*.6)",
            }}
          >
            {selected ? (
              <DetailCard row={selected} />
            ) : (
              <p
                style={{
                  color: "rgb(238 235 227 / .5)",
                  fontSize: "calc(var(--u)*2.4)",
                  fontWeight: 700,
                }}
              >
                {rows.length ? "選んでください" : ""}
              </p>
            )}
          </div>
          {selected && label ? (
            <div
              key={`${selected.key}-${label}`}
              style={{
                position: "absolute",
                inset: 0,
                zIndex: 2,
                pointerEvents: "none",
              }}
            >
              <Word
                buttonRef={actionWord}
                text={label}
                size={actionSize(label, wide)}
                paper
                big
                tilt={-4}
                rotate={-6}
                delay={0}
                style={{
                  pointerEvents: "auto",
                  // 下の黒帯（レターボックス）に掛からない高さ
                  ...(wide
                    ? { right: "6vw", bottom: "12%" }
                    : { right: "4vw", bottom: "10%" }),
                }}
                onClick={() =>
                  onAction?.(selected, fx.center(actionWord.current))
                }
              />
            </div>
          ) : null}
          <div
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 2,
              pointerEvents: "none",
            }}
          >
            <Word
              text={closeLabel}
              size={wide ? 4.4 : 4.8}
              tilt={-4}
              rotate={3}
              delay={300}
              style={{
                pointerEvents: "auto",
                right: "4%",
                top: wide ? "8%" : "6%",
              }}
              onClick={close}
            />
          </div>
        </div>
      ) : null}
    </AnimatePresence>
  )
}

/** 一覧の主操作の手応え。 */
export function useListBurst() {
  const fx = useFx()
  return (at: At, text: string, loud = true) => {
    fx.burst(
      at.x,
      at.y - at.h,
      at.h * 1.6,
      text,
      loud
        ? { fill: COLOR.blood, ink: COLOR.paper }
        : { fill: COLOR.paper, ink: COLOR.ink }
    )
    fx.shards(at.x, at.y, {
      n: 14,
      colors: loud
        ? [COLOR.paper, COLOR.blood, COLOR.ink]
        : [COLOR.paper, COLOR.sage],
    })
    fx.shake(0.6)
  }
}

export type { Row, Tab, At } from "./types"
export { RarityBadge } from "./rarity"
