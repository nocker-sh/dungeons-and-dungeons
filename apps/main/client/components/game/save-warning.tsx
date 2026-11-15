import { useRef, useState } from "react"
import { CanvasBox } from "@/client/components/canvas/canvas-box"
import { CanvasButton } from "@/client/components/canvas/canvas-button"
import { CanvasText } from "@/client/components/canvas/canvas-text"
import { PALETTE, STAGE_LAYER } from "@/client/components/canvas/tokens"
import { useActiveMark } from "@/client/components/canvas/use-active-mark"

/** 自動保存が戻るまで残す。現在のプレイ状態を保ったまま再保存できる。 */
type Props = { onRetry: () => Promise<void> }

export function SaveWarning(props: Props) {
  const pending = useRef(false)
  const button = useRef<HTMLButtonElement>(null)
  const active = useActiveMark(button)
  const [retrying, setRetrying] = useState(false)
  const retry = async () => {
    if (pending.current) return
    pending.current = true
    setRetrying(true)
    try {
      await props.onRetry()
    } finally {
      pending.current = false
      setRetrying(false)
    }
  }
  return (
    <CanvasBox
      role="alert"
      data-save-warning
      onKeyDown={(event) => event.stopPropagation()}
      style={{
        position: "absolute",
        top: "3%",
        left: "3%",
        right: "3%",
        zIndex: STAGE_LAYER.alert,
        display: "grid",
        gap: 8,
        padding: "12px 16px",
        background: PALETTE.ink,
        color: PALETTE.paper,
        border: `3px solid ${PALETTE.blood}`,
        fontSize: 14,
        lineHeight: 1.6,
        fontWeight: 700,
      }}
    >
      <CanvasText style={{ fontSize: 18 }}>保存できていません</CanvasText>
      <CanvasText>
        画面を閉じると、最後に保存できたところまで戻ります。空き容量や通信状態を確認してください。
      </CanvasText>
      <CanvasButton
        ref={button}
        data-save-retry
        disabled={retrying}
        aria-busy={retrying}
        onClick={() => void retry()}
        style={{
          minHeight: 44,
          padding: "8px 12px",
          background: PALETTE.paper,
          color: PALETTE.ink,
          textAlign: "center",
          opacity: retrying ? 0.6 : 1,
          outline: active ? `3px solid ${PALETTE.sage}` : undefined,
          outlineOffset: 2,
        }}
      >
        {retrying ? "保存しています…" : "もう一度保存"}
      </CanvasButton>
    </CanvasBox>
  )
}
