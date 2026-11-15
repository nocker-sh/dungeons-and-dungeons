import { animationTiming } from "@/client/components/stage/timing"
import { useLayoutEffect, useRef, useState } from "react"
import { COLOR } from "@/client/components/stage/kit"
import { SlantPanel } from "@/client/components/stage/slant-panel"
import type { PanelHandle } from "@/client/components/stage/slant-panel"
import { useFx } from "@/client/components/stage/use-fx"
import { Word } from "@/client/components/stage/word"
import { useWide } from "@/client/components/stage/use-wide"
import { BUTTON_BASE } from "@/client/components/canvas/tokens"
import type { LootItem } from "@/client/components/game/loot-shared"
import { LootCard } from "@/client/components/game/loot-card"
import { LootPageButton } from "@/client/components/game/loot-page-button"
import { Detail } from "@/client/components/game/detail"

/** 戦利品・宝箱・罠を3品ずつ並べる。押すと詳細、「OK」で閉じる。 */
type Props = {
  title: string
  items: readonly LootItem[]
  onOk: () => void
}

export function LootPanel(props: Props) {
  const wide = useWide()
  const fx = useFx()
  const panel = useRef<PanelHandle>(null)
  const [detail, setDetail] = useState<LootItem | null>(null)
  const [closing, setClosing] = useState(false)
  const [page, setPage] = useState(0)
  const pageCount = Math.ceil(props.items.length / 3)
  const visibleItems = props.items.slice(page * 3, page * 3 + 3)
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
      title={props.title}
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
            props.onOk()
          }}
        />
      ) : null}
    </SlantPanel>
  )
}
