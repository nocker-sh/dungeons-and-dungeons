import type { CSSProperties } from "react"
import { REVERT } from "@/client/components/canvas/tokens"

/**
 * Canvas の基本部品。どれも最初に `all: revert` を当て、ページ側のCSS（Tailwind のリセットなど）を打ち消してから、
 * 必要な値だけを style で書く。動きは motion の animate / whileHover / whileTap / exit で付ける。
 */
export const BOX: CSSProperties = {
  ...REVERT,
  display: "block",
  boxSizing: "border-box",
}
