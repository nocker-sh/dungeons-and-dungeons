import { useLayoutEffect, useRef, useState } from "react"
import {
  BUTTON_BASE,
  PALETTE,
  STAGE_LAYER,
} from "@/client/components/canvas/tokens"
import { useDialogInput } from "@/client/components/canvas/use-dialog-input"
import { useActiveMark } from "@/client/components/canvas/use-active-mark"
import { useStage } from "@/client/components/stage/use-stage"
import { useKeyboardNav } from "@/client/components/game/focus"

/** 保存を読めなかったとき：理由を見せ、消して始めるかを選べる。消すまでは上書きしない。 */
type Props = {
  problems: readonly string[]
  onDiscard: () => Promise<void>
  onContinue: () => void
}

export function UnreadableSave(props: Props) {
  const stage = useStage()
  const dialog = useRef<HTMLDivElement>(null)
  const discardButton = useRef<HTMLButtonElement>(null)
  const keepButton = useRef<HTMLButtonElement>(null)
  const discardActive = useActiveMark(discardButton)
  const keepActive = useActiveMark(keepButton)
  const pending = useRef(false)
  const [discarding, setDiscarding] = useState(false)
  const keep = () => {
    if (!pending.current) props.onContinue()
  }
  const input = useDialogInput(dialog, keep, "[data-save-keep]")
  useLayoutEffect(() => {
    if (!discarding) keepButton.current?.focus({ preventScroll: true })
  }, [discarding])
  const discard = async () => {
    if (pending.current) return
    pending.current = true
    setDiscarding(true)
    dialog.current?.focus({ preventScroll: true })
    try {
      await props.onDiscard()
    } finally {
      pending.current = false
      setDiscarding(false)
    }
  }
  useKeyboardNav(stage.canvas)
  return (
    <div
      ref={dialog}
      role="alertdialog"
      aria-modal="true"
      aria-busy={discarding}
      aria-label="保存データを読み込めませんでした"
      tabIndex={-1}
      {...input}
      style={{
        position: "absolute",
        left: "3%",
        right: "3%",
        top: "3%",
        zIndex: STAGE_LAYER.alert,
        padding: "1em 1.2em",
        background: "#0b0c12",
        color: "#eeebe3",
        boxShadow: "0 0 0 3px #6b1723",
        fontSize: "max(14px, calc(var(--u)*2.4))",
        lineHeight: 1.6,
        maxHeight: "90%",
        overflowY: "auto",
        fontWeight: 700,
        display: "grid",
        gap: ".6em",
      }}
    >
      <div role="alert" style={{ display: "contents" }}>
        <b style={{ fontSize: "1.3em" }}>保存データを読み込めませんでした</b>
        <span>今は新しく始めた状態で、保存はまだ上書きしていません。</span>
        <ul style={{ opacity: 0.75, maxHeight: "8em", overflow: "auto" }}>
          {props.problems.slice(0, 8).map((problem) => (
            <li key={problem}>・{problem}</li>
          ))}
        </ul>
        <span style={{ display: "flex", gap: "1em", flexWrap: "wrap" }}>
          <button
            ref={discardButton}
            data-nav-button
            type="button"
            disabled={discarding}
            onClick={() => void discard()}
            style={{
              ...BUTTON_BASE,
              padding: ".3em .9em",
              minHeight: 44,
              outline: discardActive ? `3px solid ${PALETTE.sage}` : undefined,
              outlineOffset: 3,
              background: "#6b1723",
              color: "#eeebe3",
            }}
          >
            {discarding
              ? "保存を消しています…"
              : "古い保存を消して、はじめから遊ぶ"}
          </button>
          <button
            ref={keepButton}
            data-nav-button
            data-save-keep
            data-modal-close
            type="button"
            disabled={discarding}
            onClick={keep}
            style={{
              ...BUTTON_BASE,
              padding: ".3em .9em",
              minHeight: 44,
              outline: keepActive ? `3px solid ${PALETTE.sage}` : undefined,
              outlineOffset: 3,
              boxShadow: "inset 0 0 0 2px #eeebe3",
            }}
          >
            このまま（保存しない）
          </button>
        </span>
      </div>
    </div>
  )
}
