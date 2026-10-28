import type { ReactNode } from "react"
import { createPortal } from "react-dom"
import { useStage } from "@/client/components/stage/use-stage"
import { useTakeover } from "@/client/components/stage/use-takeover"

/**
 * それだけを見せる場面。名前の記入のように、ほかの操作を出さずに一つのことをさせるときに包む。
 * 出ている間は、場面のUI・共通UI（設定・戻る）・隊列（高さごと）を引っ込め、背景と中身だけを見せる。
 * 中身は Stage の専用の面へ描くので、置き場所（style の position など）はその面いっぱいを基準にする。
 */
type Props = { children: ReactNode }

export function Solo(props: Props) {
  const stage = useStage()
  useTakeover("solo")
  return stage.solo ? createPortal(props.children, stage.solo) : null
}
