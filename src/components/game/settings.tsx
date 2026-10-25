import { createContext, use, useLayoutEffect, useRef, useState } from "react"
import { motion } from "motion/react"
import { CanvasButton } from "@/components/canvas/primitives"
import { PALETTE, REVERT, UI_LAYER, unit } from "@/components/canvas/tokens"
import { COLOR } from "@/components/stage/kit"
import { SlantPanel, type PanelHandle } from "@/components/stage/panel"
import { Word, useWide } from "@/components/stage/word"
import { StageChrome } from "@/components/stage/chrome"

/** 保存を消して、容姿選びからやり直す。保存先を持つ起動側が渡す（見た目の確認用の画面では null）。 */
export const StartOverContext = createContext<(() => void) | null>(null)

/** 街の右上の「設定」と、開いたときの板。 */
export function Settings({ onOpen }: { onOpen?: () => void }) {
  const wide = useWide()
  const [open, setOpen] = useState(false)
  return (
    <StageChrome>
      <Word
        text="設定"
        size={wide ? 4 : 4.6}
        tilt={2}
        rotate={4}
        from="right"
        delay={300}
        style={{
          position: "absolute",
          top: unit(1.2),
          right: wide ? "4vmin" : "3%",
        }}
        onClick={() => {
          onOpen?.()
          setOpen(true)
        }}
      />
      {open ? <SettingsPanel onClose={() => setOpen(false)} /> : null}
    </StageChrome>
  )
}

function SettingsPanel({ onClose }: { onClose: () => void }) {
  const wide = useWide()
  const startOver = use(StartOverContext)
  const panel = useRef<PanelHandle>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  const [confirming, setConfirming] = useState(false)
  useLayoutEffect(() => {
    closeButton.current?.focus()
  }, [])
  const close = async () => {
    await panel.current?.close()
    onClose()
  }
  const choice = (danger: boolean) => ({
    ...REVERT,
    display: "block",
    width: "100%",
    padding: `${unit(1.4)} ${unit(2)}`,
    background: danger ? COLOR.blood : PALETTE.ink,
    color: PALETTE.paper,
    fontSize: `min(20px, max(13px, ${unit(wide ? 3 : 3.4)}))`,
    fontWeight: 800,
    textAlign: "center" as const,
    clipPath: "polygon(1% 6%, 100% 0, 99% 94%, 0 100%)",
  })
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="設定"
      onKeyDown={(event) => {
        if (event.key === "Escape") void close()
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
                ? "今の保存を消して、容姿選びからやり直します。仲間・お金・持ち物はすべてなくなり、元に戻せません。"
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
                  style={choice(true)}
                  onClick={startOver}
                >
                  消して始める
                </CanvasButton>
                <CanvasButton
                  style={choice(false)}
                  onClick={() => setConfirming(false)}
                >
                  やめる
                </CanvasButton>
              </span>
            ) : (
              <CanvasButton
                style={choice(false)}
                onClick={() => setConfirming(true)}
              >
                はじめから遊ぶ
              </CanvasButton>
            )
          ) : null}
        </motion.div>
        <Word
          text="閉じる"
          buttonRef={closeButton}
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
