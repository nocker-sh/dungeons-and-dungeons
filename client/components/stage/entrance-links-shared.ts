import type { Move } from "@/client/components/game/nav"

export type EntranceLink = {
  id: string
  label: string
  lines?: readonly string[]
  /** 背景画像の左上を0、右下を1とした入口の位置。 */
  anchor: readonly [number, number]
  primary?: boolean
  disabled?: boolean
  /** move は背景のこの入口へ寄る切り替え方。nav.go にそのまま渡す。 */
  onClick: (move: Move) => void
}

export type ArtworkGeometry = {
  loaded: boolean
  width: number
  height: number
  left: number
  top: number
  visibleLeft: number
  visibleTop: number
  viewportWidth: number
  viewportHeight: number
}
