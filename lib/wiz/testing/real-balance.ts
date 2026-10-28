import type { GameContent } from "@/lib/wiz/content/content-schema"
import { content } from "@/lib/wiz/testing/real-content"

/** 規則の数値（balance）。テストは数値を書き写さず、ここから読む。 */
export function realBalance(): GameContent["balance"] {
  return content.balance
}
