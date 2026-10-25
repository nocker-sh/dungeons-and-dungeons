import { useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import {
  LeavingContext,
  useLeaving,
  useStage,
} from "@/components/stage/stage-context"
import { useStageView } from "@/components/stage/takeover"

/**
 * 共通UI（設定・戻る）を、黒帯と周辺の暗がりより上の層へ出す。
 * 会話や一覧が画面を占めている間は退場させ、終わったら入り直す（見せ方は StageDirector が決める）。
 */
export function StageChrome({ children }: { children: ReactNode }) {
  const { chrome } = useStage()
  const view = useStageView()
  const leaving = useLeaving()
  const shown = view.chrome === "shown"
  // 引っ込めたあとに戻すときは、入る動きからやり直す
  const [entrance, setEntrance] = useState(0)
  const [wasShown, setWasShown] = useState(shown)
  if (wasShown !== shown) {
    setWasShown(shown)
    if (shown) setEntrance((count) => count + 1)
  }
  return chrome
    ? createPortal(
        <LeavingContext.Provider value={leaving || !shown}>
          <div key={entrance} style={{ display: "contents" }}>
            {children}
          </div>
        </LeavingContext.Provider>,
        chrome
      )
    : null
}
