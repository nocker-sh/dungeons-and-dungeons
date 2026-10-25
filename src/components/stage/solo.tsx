import type { ReactNode } from "react"
import { createPortal } from "react-dom"
import { useStage } from "@/components/stage/stage-context"
import { useTakeover } from "@/components/stage/takeover"

/**
 * それだけを見せる場面。名前の記入のように、ほかの操作を出さずに一つのことをさせるときに包む。
 * 出ている間は、場面のUI・共通UI（設定・戻る）・隊列（高さごと）を引っ込め、背景と中身だけを見せる。
 * 中身は Stage の専用の面へ描くので、置き場所（style の position など）はその面いっぱいを基準にする。
 */
export function Solo({ children }: { children: ReactNode }) {
  const stage = useStage()
  useTakeover("solo")
  return stage.solo ? createPortal(children, stage.solo) : null
}
