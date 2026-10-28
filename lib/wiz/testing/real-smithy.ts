import type { GameContent } from "@/lib/wiz/content/content-schema"
import { content } from "@/lib/wiz/testing/real-content"

/** 鍛冶屋のデータ（強化の費用と生産のレシピ）。 */
export function realSmithy(): NonNullable<GameContent["smithy"]> {
  const smithy = content.smithy
  if (!smithy) throw new Error("作品データに鍛冶屋がない")
  return smithy
}
