import { useState } from "react"
import type { ReactNode } from "react"
import { createPortal } from "react-dom"
import {
  LeavingContext,
  useLeaving,
} from "@/client/components/stage/use-leaving"
import { useStage } from "@/client/components/stage/use-stage"
import { useStageView } from "@/client/components/stage/use-stage-view"

/**
 * 共通UI（設定・戻る）を、黒帯と周辺の暗がりより上の層へ出す。
 * 会話や一覧が画面を占めている間は退場させ、終わったら入り直す（見せ方は StageDirector が決める）。
 */
type Props = { children: ReactNode }

export function StageChrome(props: Props) {
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
            {props.children}
          </div>
        </LeavingContext.Provider>,
        chrome
      )
    : null
}
