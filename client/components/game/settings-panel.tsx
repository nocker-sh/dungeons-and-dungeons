import { createContext, use, useLayoutEffect, useRef, useState } from "react"
import type { RefObject } from "react"
import { motion } from "motion/react"
import { CanvasButton } from "@/client/components/canvas/canvas-button"
import {
  PALETTE,
  REVERT,
  UI_LAYER,
  unit,
} from "@/client/components/canvas/tokens"
import { COLOR } from "@/client/components/stage/kit"
import { SlantPanel } from "@/client/components/stage/slant-panel"
import type { PanelHandle } from "@/client/components/stage/slant-panel"
import { Word } from "@/client/components/stage/word"
import { useWide } from "@/client/components/stage/use-wide"

/** 保存を消して冒険をやり直す。再読み込み・失敗表示は保存先を持つ起動側が行う（プレビューでは null）。 */
export const StartOverContext = createContext<(() => void) | null>(null)

type Props = {
  onClose: () => void
  trigger: RefObject<HTMLButtonElement | null>
}

export function SettingsPanel(props: Props) {
  const wide = useWide()
  const startOver = use(StartOverContext)
  const panel = useRef<PanelHandle>(null)
  const dialog = useRef<HTMLDivElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  const startButton = useRef<HTMLButtonElement>(null)
  const cancelButton = useRef<HTMLButtonElement>(null)
  const closingRef = useRef(false)
  const [closing, setClosing] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const wasConfirming = useRef(false)
  useLayoutEffect(() => {
    const opener = props.trigger.current
    closeButton.current?.focus()
    return () => {
      if (opener?.isConnected) opener.focus()
    }
  }, [props.trigger])
  useLayoutEffect(() => {
    if (confirming) cancelButton.current?.focus()
    else if (wasConfirming.current) startButton.current?.focus()
    wasConfirming.current = confirming
  }, [confirming])
  const close = async () => {
    if (closingRef.current) return
    closingRef.current = true
    setClosing(true)
    // ボタンを無効にしても、退場中のTabを背面へ渡さない。
    dialog.current?.focus()
    await panel.current?.close()
    props.onClose()
  }
  const restart = () => {
    if (closingRef.current || !startOver) return
    closingRef.current = true
    setClosing(true)
    setResetting(true)
    dialog.current?.focus()
    startOver()
  }
  const choice = (danger: boolean) => ({
    ...REVERT,
    display: "block",
    width: "100%",
    padding: `${unit(1.4)} ${unit(2)}`,
    background: danger ? COLOR.blood : PALETTE.ink,
    color: PALETTE.paper,
    filter: resetting ? "opacity(0.4)" : undefined,
    fontSize: `min(20px, max(13px, ${unit(wide ? 3 : 3.4)}))`,
    fontWeight: 800,
    textAlign: "center" as const,
    clipPath: "polygon(1% 6%, 100% 0, 99% 94%, 0 100%)",
  })
  return (
    <div
      ref={dialog}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label="設定"
      aria-busy={closing}
      onKeyDown={(event) => {
        if (event.ctrlKey || event.metaKey || event.altKey) return
        if (event.key === "Tab") {
          event.preventDefault()
          const buttons = [
            ...event.currentTarget.querySelectorAll<HTMLButtonElement>(
              "button:not(:disabled)"
            ),
          ]
          if (!buttons.length) return
          const index = buttons.indexOf(
            document.activeElement as HTMLButtonElement
          )
          const next =
            index < 0
              ? event.shiftKey
                ? buttons.length - 1
                : 0
              : (index + (event.shiftKey ? -1 : 1) + buttons.length) %
                buttons.length
          buttons[next]?.focus()
        }
        if (event.key === "Escape" || event.key === "Backspace") {
          event.preventDefault()
          event.stopPropagation()
          void close()
        }
      }}
      style={{ ...UI_LAYER, zIndex: 60, pointerEvents: "auto" }}
    >
      <SlantPanel
        ref={panel}
        z={60}
        tone="#12161f"
        title="設定"
        inset={
          wide ? { top: "6%", bottom: "6%" } : { top: "5%", bottom: "14%" }
        }
        headSize={wide ? 9 : 10}
        headStyle={wide ? { left: "6%", top: "10%" } : undefined}
      >
        <motion.div
          initial={{ opacity: 0, x: "6vw", rotate: 2 }}
          animate={{ opacity: 1, x: 0, rotate: -1.5 }}
          transition={{ duration: 0.45, delay: 0.25, ease: "easeOut" }}
          style={{
            ...REVERT,
            position: "absolute",
            left: wide ? "10%" : "6%",
            right: wide ? "46%" : "6%",
            top: wide ? "34%" : "30%",
            display: "grid",
            gap: unit(2),
            padding: `${unit(3)} ${unit(3.4)}`,
            background: PALETTE.paper,
            color: PALETTE.ink,
            clipPath: "polygon(1% 4%, 100% 0, 99% 97%, 0 100%)",
            textAlign: "left",
          }}
        >
          <span
            style={{
              ...REVERT,
              display: "block",
              fontSize: `min(22px, ${unit(wide ? 4.4 : 4.6)})`,
              fontWeight: 800,
            }}
          >
            はじめから遊ぶ
          </span>
          <span
            style={{
              ...REVERT,
              display: "block",
              fontSize: `min(18px, max(12px, ${unit(wide ? 2.8 : 3)}))`,
              fontWeight: 700,
              lineHeight: 1.7,
            }}
          >
            {startOver
              ? confirming
                ? "今の保存を消して、冒険のはじめからやり直します。仲間・お金・持ち物はすべてなくなり、元に戻せません。"
                : "今の保存を消して、最初から遊び直せます。"
              : "この画面では保存を消せません。"}
          </span>
          {startOver ? (
            confirming ? (
              <span
                style={{
                  ...REVERT,
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: unit(1.6),
                }}
              >
                <CanvasButton
                  data-settings-start-over
                  disabled={closing}
                  style={choice(true)}
                  onClick={restart}
                >
                  消して始める
                </CanvasButton>
                <CanvasButton
                  ref={cancelButton}
                  disabled={closing}
                  style={choice(false)}
                  onClick={() => setConfirming(false)}
                >
                  やめる
                </CanvasButton>
              </span>
            ) : (
              <CanvasButton
                ref={startButton}
                disabled={closing}
                style={choice(false)}
                onClick={() => setConfirming(true)}
              >
                はじめから遊ぶ
              </CanvasButton>
            )
          ) : null}
          {resetting ? (
            <span
              role="status"
              style={{ ...REVERT, display: "block", fontWeight: 700 }}
            >
              保存を消しています…
            </span>
          ) : null}
        </motion.div>
        <Word
          text="閉じる"
          buttonRef={closeButton}
          disabled={closing}
          modalClose
          size={wide ? 11 : 10}
          paper
          big
          tilt={-4}
          rotate={-7}
          from="right"
          delay={420}
          style={{
            zIndex: 62,
            filter: resetting ? "opacity(0.4)" : undefined,
            pointerEvents: "auto",
            ...(wide
              ? { right: "5vw", bottom: "12%" }
              : { right: "2vw", bottom: "6%" }),
          }}
          onClick={() => void close()}
        />
      </SlantPanel>
    </div>
  )
}
