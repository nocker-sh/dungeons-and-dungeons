import { GoodIcon } from "@/components/game/art"
import { useEffect, useRef, useState } from "react"
import {
  CanvasBox,
  CanvasButton,
  CanvasText,
} from "@/components/canvas/primitives"
import { PALETTE } from "@/components/canvas/tokens"
import { useGame, useGameState } from "@/contexts/game"
import { inPhase } from "@/lib/wiz"

/** 出撃前とバッグから同じ持ち出し設定を操作する。 */
export function Supplies({
  placement = "departure",
}: { placement?: "bag" | "departure" } = {}) {
  const game = useGame()
  const state = useGameState()
  const supplies = game.queries.supplies(state)
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const dialog = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    dialog.current?.querySelector<HTMLButtonElement>("button")?.focus()
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        setOpen(false)
      }
      if (event.key !== "Tab") return
      const buttons = [
        ...(dialog.current?.querySelectorAll<HTMLButtonElement>(
          "button:not(:disabled)"
        ) ?? []),
      ]
      if (!buttons.length) return
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
      const next = event.shiftKey
        ? (index - 1 + buttons.length) % buttons.length
        : (index + 1) % buttons.length
      event.preventDefault()
      buttons[next]?.focus()
    }
    window.addEventListener("keydown", key, true)
    return () => {
      window.removeEventListener("keydown", key, true)
      trigger.current?.focus()
    }
  }, [open])
  return (
    <>
      <CanvasButton
        ref={trigger}
        aria-label={supplies.editable ? "持ち出しを準備" : "手持ちと倉庫を見る"}
        onClick={() => setOpen(true)}
        style={{
          position: "absolute",
          left: placement === "bag" ? "40%" : "4%",
          top: placement === "bag" ? "7%" : "14%",
          zIndex: 40,
          padding: "10px 14px",
          background: PALETTE.paper,
          color: PALETTE.ink,
          border: "2px solid",
          fontSize: 16,
          fontWeight: 800,
        }}
      >
        手持ち {supplies.count}/{supplies.capacity}個
      </CanvasButton>
      {open ? (
        <CanvasBox
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 60,
            background: "rgba(0, 0, 0, 0.45)",
            pointerEvents: "auto",
          }}
        >
          <CanvasBox
            ref={dialog}
            role="dialog"
            aria-modal="true"
            aria-label="倉庫と手持ち"
            style={{
              position: "absolute",
              inset: "8% 3% 24%",
              zIndex: 60,
              maxWidth: 600,
              margin: "0 auto",
              overflowY: "auto",
              padding: 18,
              background: PALETTE.paper,
              color: PALETTE.ink,
              border: "3px solid",
              pointerEvents: "auto",
            }}
          >
            <CanvasBox
              style={{
                position: "sticky",
                top: -18,
                paddingTop: 18,
                zIndex: 1,
                background: PALETTE.paper,
                paddingBottom: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <CanvasText
                style={{ fontSize: 18, fontWeight: 900, lineHeight: 1.3 }}
              >
                倉庫と手持ち {supplies.count}/{supplies.capacity}
              </CanvasText>
              <CanvasButton
                aria-label="持ち出しを閉じる"
                data-modal-close
                onClick={() => setOpen(false)}
                style={{
                  padding: "8px 10px",
                  fontSize: 14,
                  minHeight: 44,
                  border: "2px solid",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                閉じる
              </CanvasButton>
              <CanvasBox
                role="status"
                style={{ flexBasis: "100%", fontSize: 13, fontWeight: 800 }}
              >
                {supplies.count >= supplies.capacity
                  ? `持ち出し枠がいっぱいです。${supplies.editable ? "入れ替えるには、先に倉庫へ戻してください。" : ""}`
                  : supplies.editable
                    ? `あと${supplies.capacity - supplies.count}個持ち出せます。`
                    : `空き枠：${supplies.capacity - supplies.count}個。持ち替えは街でできます。`}
              </CanvasBox>
            </CanvasBox>
            <CanvasBox
              style={{ fontSize: 14, margin: "14px 0", lineHeight: 1.6 }}
            >
              消耗品は3人で{supplies.capacity}個まで。装備と拾った戦利品は別枠。
              {supplies.editable
                ? "街で持ち替えられます。"
                : "倉庫の品物は街で持ち出せます。"}
            </CanvasBox>
            {supplies.items.map((item) => (
              <CanvasBox
                key={item.id}
                style={{
                  padding: "12px 0",
                  borderTop: "1px solid #aaa",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                }}
              >
                <CanvasBox style={{ flex: 1, minWidth: 0 }}>
                  <CanvasBox
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <CanvasBox
                      aria-hidden="true"
                      data-supply-art={item.id}
                      style={{
                        display: "grid",
                        placeItems: "center",
                        width: 32,
                        height: 32,
                        flexShrink: 0,
                        background: PALETTE.ink,
                      }}
                    >
                      <GoodIcon id={item.id} iconSize="80%" />
                    </CanvasBox>
                    <CanvasText style={{ fontSize: 17, fontWeight: 800 }}>
                      {item.name}
                    </CanvasText>
                  </CanvasBox>
                  <CanvasBox style={{ fontSize: 13, marginTop: 5 }}>
                    倉庫 {item.stored}個 ／ 手持ち {item.carried}個
                  </CanvasBox>
                  {item.stat ? (
                    <CanvasBox
                      style={{ fontSize: 13, marginTop: 5, fontWeight: 800 }}
                    >
                      {item.stat}
                    </CanvasBox>
                  ) : null}
                  <CanvasBox style={{ fontSize: 12, marginTop: 4 }}>
                    {item.desc}
                  </CanvasBox>
                  {!supplies.editable && item.carried === 0 ? (
                    <CanvasBox
                      style={{ fontSize: 12, marginTop: 5, fontWeight: 800 }}
                    >
                      手持ちなし。街で持ち出してください。
                    </CanvasBox>
                  ) : null}
                  {supplies.editable && item.stored === 0 ? (
                    <CanvasBox
                      style={{ fontSize: 12, marginTop: 5, fontWeight: 800 }}
                    >
                      倉庫の在庫なし
                    </CanvasBox>
                  ) : null}
                </CanvasBox>
                {supplies.editable ? (
                  <CanvasBox style={{ display: "flex", gap: 6 }}>
                    <CanvasButton
                      aria-label={`${item.name}を倉庫へ戻す`}
                      disabled={!item.carried}
                      onClick={() =>
                        inPhase(game, "town")?.pack(item.id, item.carried - 1)
                      }
                      style={{
                        padding: 12,
                        border: "2px solid",
                        opacity: item.carried ? 1 : 0.3,
                      }}
                    >
                      −
                    </CanvasButton>
                    <CanvasButton
                      aria-label={`${item.name}を持ち出す`}
                      disabled={!item.canAdd}
                      onClick={() =>
                        inPhase(game, "town")?.pack(item.id, item.carried + 1)
                      }
                      style={{
                        padding: 12,
                        border: "2px solid",
                        opacity: item.canAdd ? 1 : 0.3,
                      }}
                    >
                      ＋
                    </CanvasButton>
                  </CanvasBox>
                ) : null}
              </CanvasBox>
            ))}
            {!supplies.items.length ? (
              <CanvasBox>消耗品はありません。道具屋で補充できます。</CanvasBox>
            ) : null}
          </CanvasBox>
        </CanvasBox>
      ) : null}
    </>
  )
}
