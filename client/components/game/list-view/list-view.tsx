import { ListTabs } from "@/client/components/game/list-view/list-tabs"
import { useListScroll } from "@/client/components/game/list-view/use-list-scroll"
import { useAnimationEffect } from "@/client/components/canvas/use-animation-effect"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import type { CSSProperties, ReactNode } from "react"
import { AnimatePresence } from "motion/react"
import { COLOR, EASE_POP } from "@/client/components/stage/kit"
import { PALETTE, REVERT, unit } from "@/client/components/canvas/tokens"
import { SlantPanel } from "@/client/components/stage/slant-panel"
import { useFx } from "@/client/components/stage/use-fx"
import { Word } from "@/client/components/stage/word"
import { useWide } from "@/client/components/stage/use-wide"
import { play } from "@/client/components/canvas/play"
import { TornPlate } from "@/client/components/canvas/torn-plate"
import type { Row, Tab, At } from "@/client/components/game/list-view/types"
import { RowButton } from "@/client/components/game/list-view/row-button"
import { TabButton } from "@/client/components/game/list-view/tab-button"
import { DetailCard } from "@/client/components/game/list-view/detail-card"
import { scrollText } from "@/client/components/canvas/scroll-text"
import { useScrollDrag } from "@/client/components/game/list-view/use-scroll-drag"
import { headSize } from "@/client/components/game/list-view/head-size"
import { actionSize } from "@/client/components/game/list-view/action-size"

/**
 * 一覧の画面。斜めに塗り替わるトーンの板に、横長の行を縦に並べる。枠の中だけでスクロールし、つまみも角ばった独自の形。
 * 押すと詳細、主操作と「‹ 戻る」。店・バッグ・依頼・募集で共通。
 */
type Props = {
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
}

export function ListView(props: Props) {
  const kind = props.kind === undefined ? "" : props.kind
  const closeLabel =
    props.closeLabel === undefined ? "‹ 戻る" : props.closeLabel
  const detailLabel =
    props.detailLabel === undefined ? "選んだ品の詳細" : props.detailLabel
  const closeSignal = props.closeSignal === undefined ? 0 : props.closeSignal
  const initialTab = props.tab === undefined ? 0 : props.tab

  const wide = useWide()
  const fx = useFx()
  const [selectedTabName, setSelectedTabName] = useState(
    props.tabs[initialTab]?.name
  )
  const tab = Math.max(
    0,
    props.tabs.findIndex((entry) => entry.name === selectedTabName)
  )
  const [picked, setPicked] = useState<string | null>(
    props.initialRowKey ?? null
  )
  // 閉じる：AnimatePresence が板と札を外へ送り、送り終わってから親へ知らせる
  const [open, setOpen] = useState(true)
  const grid = useRef<HTMLDivElement>(null)
  const rowContent = useRef<HTMLDivElement>(null)
  const headerBox = useRef<HTMLDivElement>(null)
  const hasHeader = !!props.notice || !!props.extra
  const bar = useRef<HTMLDivElement>(null)
  const thumb = useRef<HTMLElement>(null)
  const scrollDrag = useScrollDrag(grid, bar)
  const money = useRef<HTMLElement>(null)
  const actionWord = useRef<HTMLButtonElement>(null)
  const previousGold = useRef(props.gold)
  const rows = props.tabs[tab]?.rows ?? []
  const selected = rows.find((row) => row.key === picked) ?? null
  const label = selected && props.action ? props.action(selected) : null
  const z = kind ? 29 : 26

  useLayoutEffect(() => fx.shake(0.6).cancel, [fx])

  useLayoutEffect(() => {
    const element = headerBox.current
    if (!element) return
    const measure = () =>
      element.parentElement?.style.setProperty(
        "--list-header-height",
        `${element.offsetHeight}px`
      )
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [hasHeader])

  useAnimationEffect(() => {
    if (
      props.gold === undefined ||
      previousGold.current === undefined ||
      previousGold.current === props.gold
    )
      return
    play(
      money.current,
      [
        {
          scale: 1.6,
          color: props.gold < previousGold.current ? COLOR.blood : COLOR.sage,
        },
        { scale: 1, color: COLOR.paper },
      ],
      { duration: 380, easing: EASE_POP }
    )
    previousGold.current = props.gold
  }, [props.gold])

  const { sync, scheduleSync } = useListScroll({
    grid,
    bar,
    thumb,
    rowContent,
    tab,
    open,
  })

  const close = () => setOpen(false)
  // 開いた後に合図が変わったときだけ閉じる（開いた時点の値では閉じない）
  const openedWith = useRef(closeSignal)
  useEffect(() => {
    if (closeSignal !== openedWith.current) setOpen(false)
  }, [closeSignal])

  return (
    <AnimatePresence onExitComplete={props.onClose}>
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
            title={props.title}
            headSize={headSize(props.title, wide)}
            headStyle={{ left: "5%", top: wide ? "8%" : "6%", rotate: "-6deg" }}
          />
          {props.gold !== undefined ? (
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
                {props.gold}
              </b>{" "}
              G
            </div>
          ) : null}
          {hasHeader ? (
            <div
              ref={headerBox}
              style={{
                position: "absolute",
                display: "flex",
                flexDirection: "column",
                gap: unit(1.2),
                top: wide
                  ? kind === "demon-contracts"
                    ? "28%"
                    : "20%"
                  : "22%",
                left: "5%",
                right: wide ? "44%" : "5%",
              }}
            >
              {props.notice}
              {props.extra ? (
                <TabButton
                  onClick={props.extra.onClick}
                  style={{
                    alignSelf: "flex-end",
                    position: "relative",
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
                  <span style={{ position: "relative" }}>
                    {props.extra.label}
                  </span>
                </TabButton>
              ) : null}
            </div>
          ) : null}
          <ListTabs
            tabs={props.tabs}
            tab={tab}
            wide={wide}
            kind={kind}
            onSelect={(name) => {
              setSelectedTabName(name)
              setPicked(null)
            }}
          />
          <div
            className="rowsbox"
            style={{
              position: "absolute",
              ...(wide
                ? {
                    left: "5%",
                    right: "44%",
                    top: hasHeader
                      ? `calc(${kind === "demon-contracts" ? "28%" : "20%"} + var(--list-header-height, 90px) + ${unit(3)})`
                      : "32%",
                    bottom: "9%",
                  }
                : {
                    left: "4%",
                    right: "9%",
                    top: hasHeader
                      ? `calc(22% + var(--list-header-height, 90px) + ${unit(3)})`
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
                display: "block",
                padding: `${unit(1)} ${unit(1.4)} ${unit(4)} ${unit(1)}`,
                WebkitMaskImage:
                  "linear-gradient(180deg, transparent, #000 4%, #000 90%, transparent)",
                maskImage:
                  "linear-gradient(180deg, transparent, #000 4%, #000 90%, transparent)",
              }}
            >
              <div
                ref={rowContent}
                style={{
                  ...REVERT,
                  display: "flex",
                  flexDirection: "column",
                  gap: unit(1.1),
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
                      onEntered={scheduleSync}
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
                  touchAction: "none",
                }}
                {...scrollDrag}
              />
            </div>
          </div>
          <div
            className="detail"
            data-gamepad-scroll
            role="region"
            aria-label={detailLabel}
            tabIndex={selected ? 0 : -1}
            onKeyDown={scrollText}
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
                  // 横向きでは文字の傾き・脈動の余白も含め、右側の列へ収める。
                  ...(wide
                    ? {
                        fontSize: `min(calc(var(--u) * ${actionSize(label, wide)}), calc(38vw / ${Array.from(label).length * 1.1}))`,
                      }
                    : {}),
                  // 下の黒帯（レターボックス）に掛からない高さ
                  ...(wide
                    ? {
                        right: "6vw",
                        bottom:
                          "max(12%, calc(var(--letterbox-height, 0px) + var(--u) * 5))",
                      }
                    : {
                        // 文字の脈動・ホバー拡大・カーソル追従も収まる余白。
                        right: "max(4vw, calc(var(--u) * 8))",
                        bottom:
                          "max(10%, calc(var(--letterbox-height, 0px) + var(--u) * 5))",
                      }),
                }}
                onClick={() =>
                  props.onAction?.(selected, fx.center(actionWord.current))
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
              modalClose={kind === "bag"}
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
