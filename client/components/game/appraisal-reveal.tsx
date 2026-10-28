import { motion } from "motion/react"
import { useEffect, useRef } from "react"
import { BUTTON_BASE } from "@/client/components/canvas/tokens"
import { COLOR } from "@/client/components/stage/kit"
import { seconds } from "@/client/components/stage/seconds"
import type { AppraisalFind } from "@/client/components/game/appraisal-card-shared"
import { AppraisalCard } from "@/client/components/game/appraisal-card"

/**
 * 鑑定の直後に画面の中央へ出す結果の札。どこを押しても閉じ、一覧へ戻る。
 */
type Props = {
  find: AppraisalFind
  summary?: string
  onClose: () => void
}

export function AppraisalReveal(props: Props) {
  const closeButton = useRef<HTMLButtonElement>(null)
  const previousFocus = useRef<HTMLElement | null>(null)
  useEffect(() => {
    const button = closeButton.current
    const root = button?.closest(".game")
    const previous = document.activeElement
    if (
      previous instanceof HTMLElement &&
      previous !== button &&
      previous !== document.body
    )
      previousFocus.current = previous
    button?.focus()
    return () => {
      queueMicrotask(() => {
        if (button?.isConnected) return
        if (previousFocus.current?.isConnected) previousFocus.current.focus()
        else
          Array.from(
            root?.querySelectorAll<HTMLButtonElement>(
              ".rows .slot-item.row:not([disabled])"
            ) ?? []
          )
            .find((row) => row.dataset.rowKey === props.find.key)
            ?.focus()
      })
    }
  }, [props.find.key])
  return (
    <motion.div
      role="dialog"
      aria-label="鑑定の結果"
      aria-modal="true"
      onClick={props.onClose}
      onKeyDown={(event) => {
        if (event.ctrlKey || event.metaKey || event.altKey) return
        if (event.key === "Tab") {
          event.preventDefault()
          closeButton.current?.focus()
        }
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: seconds(160) }}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 40,
        display: "grid",
        placeItems: "center",
        background: "rgba(11,12,18,.55)",
        pointerEvents: "auto",
        cursor: "pointer",
      }}
    >
      <div
        style={{
          width: "min(92%, calc(var(--u)*110))",
          maxHeight: "90%",
          overflowY: "auto",
        }}
      >
        <AppraisalCard find={props.find} summary={props.summary} />
        <button
          type="button"
          ref={closeButton}
          data-modal-close
          onClick={(event) => {
            event.stopPropagation()
            props.onClose()
          }}
          style={{
            ...BUTTON_BASE,
            padding: "10px 14px",
            minHeight: 44,
            whiteSpace: "nowrap",
            margin: "calc(var(--u)*2) auto 0",
            color: COLOR.paper,
            fontWeight: 800,
            fontSize: "max(12px, calc(var(--u)*2.6))",
          }}
        >
          押して一覧へ
        </button>
      </div>
    </motion.div>
  )
}
