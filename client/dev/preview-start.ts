import type { ReactNode } from "react"
import type { GameContent } from "@/lib/wiz/content/content-schema"
import type { GameState } from "@/lib/wiz/state/state-schema"
import type { WizWorldEnvironment } from "@/lib/wiz/core/world/world"
import type { Screen } from "../game/navigation"

/** 見た目の確認用の開始状態（ゲームと同じ画面を起動する）。本物の保存には触れない。 */
export type PreviewStart = {
  render?: ReactNode
  content?: GameContent
  environment?: WizWorldEnvironment
  /** 始める状態（保存の形）。省略ではじめから。 */
  save?: unknown
  /** 検証済みの初期状態。準備後に乱数・IDを二重に消費しない。 */
  initialState?: GameState
  screen: Screen
  /** 開いておく重ね物。 */
  overlay?: { kind: "bag"; tab?: number } | { kind: "stand"; member: string }
  /** 場所に入ったときの場面を流す。見た目の確認がぶれないよう、省略では流さない。 */
  visitScenes?: boolean
}
