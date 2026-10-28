import { useLayoutEffect, useRef, useState } from "react"
import { motion } from "motion/react"
import { iconOf } from "@/client/components/game/icon-of"
import { Svg } from "@/client/components/game/svg"
import { COLOR } from "@/client/components/stage/kit"
import { SlantPanel } from "@/client/components/stage/slant-panel"
import type { PanelHandle } from "@/client/components/stage/slant-panel"
import { useFx } from "@/client/components/stage/use-fx"
import { Word } from "@/client/components/stage/word"
import { useWide } from "@/client/components/stage/use-wide"
import { useGame } from "@/client/contexts/use-game"
import { useGameState } from "@/client/contexts/use-game-state"
import {
  PALETTE,
  REVERT,
  UI_LAYER,
  unit,
  STAGE_LAYER,
} from "@/client/components/canvas/tokens"
import { inPhase } from "@/lib/wiz/phases/in-phase"
import { scrollText } from "@/client/components/canvas/scroll-text"
import { ResultGoods } from "@/client/components/screens/result-goods"

/**
 * 街で出す結果の板。全滅（失った物）と踏破（エンディング）。
 * 何を失ったか・踏破したかはエンジンのQuery（`result`）から受け取る。
 */
export function ResultPanel() {
  const game = useGame()
  const state = useGameState()
  const wide = useWide()
  const fx = useFx()
  const panel = useRef<PanelHandle>(null)
  const body = useRef<HTMLDivElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  const [reading, setReading] = useState(false)
  const [closing, setClosing] = useState(false)
  const result = game.queries.result(state)
  const hero = game.queries.hero(state)
  useLayoutEffect(() => {
    closeButton.current?.focus()
  }, [result?.kind])
  useLayoutEffect(() => {
    if (!result) return
    fx.shake(result.kind === "wipe" ? 1.4 : 1)
    fx.flash(result.kind === "wipe" ? COLOR.blood : COLOR.mist, 0.5)
  }, [fx, result])
  if (!result) return null
  const wipe = result.kind === "wipe"
  const lines = wipe
    ? [
        `気がつくと街の宿だった。${result.layerName}で背負った物は、ほとんど谷に置いてきた。`,
        "仲間は誰も死んでいない。積んだ経験も消えていない。",
        "宿でHP（生命力）を回復し、傷んだ防具は鍛冶屋で修理しよう。",
      ]
    : [
        `${result.layerName}の主を倒し、${hero.name}たちは大渓谷のいちばん底に立った。`,
        `谷は今日も口を開けている。もう一度潜るかは、${hero.name}が決める。`,
      ]
  return (
    <div
      className="ui-layer result"
      role="dialog"
      aria-modal="true"
      aria-label={wipe ? "全滅の結果" : "踏破の結果"}
      onKeyDown={(event) => {
        if (event.ctrlKey || event.metaKey || event.altKey) return
        if (event.key === "Tab") {
          event.preventDefault()
          const targets = [body.current, closeButton.current].filter(
            (element): element is HTMLDivElement | HTMLButtonElement =>
              element !== null
          )
          const index = targets.indexOf(
            document.activeElement as HTMLDivElement | HTMLButtonElement
          )
          const next =
            index < 0
              ? event.shiftKey
                ? targets.length - 1
                : 0
              : (index + (event.shiftKey ? -1 : 1) + targets.length) %
                targets.length
          targets[next]?.focus({ preventScroll: true })
        }
      }}
      style={{ ...UI_LAYER, zIndex: STAGE_LAYER.dialog, pointerEvents: "auto" }}
    >
      <SlantPanel
        ref={panel}
        z={60}
        tone={wipe ? "#1b0d12" : "#12161f"}
        title={wipe ? "全滅" : "踏破"}
        inset={
          wide ? { top: "6%", bottom: "6%" } : { top: "5%", bottom: "14%" }
        }
        headSize={wide ? 9 : 10}
        headStyle={wide ? { left: "6%", top: "10%" } : undefined}
      >
        <motion.div
          ref={body}
          className="result-body"
          role="region"
          aria-label={wipe ? "全滅の詳細" : "踏破の詳細"}
          tabIndex={0}
          data-gamepad-scroll=""
          onFocus={(event) =>
            setReading(event.currentTarget.matches(":focus-visible"))
          }
          onBlur={() => setReading(false)}
          onKeyDown={scrollText}
          initial={{ opacity: 0, x: "6vw", rotate: 2 }}
          animate={{ opacity: 1, x: 0, rotate: -1.5 }}
          transition={{ duration: 0.45, delay: 0.25, ease: "easeOut" }}
          style={{
            ...REVERT,
            position: "absolute",
            left: wide ? "10%" : "6%",
            right: wide ? (wipe ? "36%" : "50%") : "6%",
            top: wide ? "34%" : "30%",
            bottom: wide ? "16%" : "18%",
            overflowY: "auto",
            alignContent: "start",
            display: "grid",
            gap: unit(wide ? 1 : 2),
            padding: `${unit(3)} ${unit(3.4)}`,
            background: PALETTE.paper,
            color: PALETTE.ink,
            boxShadow: reading ? `inset 0 0 0 3px ${COLOR.blood}` : undefined,
            clipPath: "polygon(1% 4%, 100% 0, 99% 97%, 0 100%)",
            textAlign: "left",
          }}
        >
          <span
            style={{
              ...REVERT,
              display: "flex",
              alignItems: "center",
              gap: unit(2),
              fontSize: `min(24px, ${unit(wide ? 5.4 : 5)})`,
              lineHeight: 1.1,
            }}
          >
            <span
              aria-hidden="true"
              style={{
                ...REVERT,
                display: "grid",
                placeItems: "center",
                flex: "none",
                width: `min(60px, ${unit(wide ? 11 : 12)})`,
                aspectRatio: 1,
                background: wipe ? COLOR.blood : "#b8901c",
                clipPath:
                  "polygon(6% 10%, 62% 0, 100% 14%, 94% 86%, 40% 100%, 0 88%)",
              }}
            >
              <Svg
                html={iconOf(wipe ? "hurt" : "coin")}
                style={{ width: "58%", height: "58%" }}
              />
            </span>
            {wipe ? "戦利品を失った" : "大渓谷を踏破した"}
          </span>
          {wipe ? (
            <>
              <ResultGoods
                title="失った物"
                gold={result.gold}
                goods={result.goods}
              />
              {result.kept.length ? (
                <ResultGoods title="持ち帰れた物" goods={result.kept} />
              ) : null}
            </>
          ) : null}
          {lines.filter(Boolean).map((line) => (
            <span
              key={line}
              style={{
                ...REVERT,
                display: "block",
                fontSize: `min(18px, max(12px, ${unit(wide ? 2.8 : 3)}))`,
                fontWeight: 700,
                lineHeight: 1.7,
              }}
            >
              {line}
            </span>
          ))}
        </motion.div>
        {!closing ? (
          <Word
            text={wipe ? "街へ" : "まだ潜る"}
            buttonRef={closeButton}
            modalClose
            size={wide ? 13 : 11}
            paper
            big
            tilt={-4}
            rotate={-7}
            from="right"
            delay={420}
            style={{
              zIndex: 62,
              pointerEvents: "auto",
              ...(wide
                ? { right: "5vw", bottom: "12%" }
                : { right: "2vw", bottom: "6%" }),
            }}
            onClick={async () => {
              setClosing(true)
              await panel.current?.close()
              const town = inPhase(game, "town")
              if (wipe) town?.dismissWipe()
              else town?.seeEnding()
            }}
          />
        ) : null}
      </SlantPanel>
    </div>
  )
}
