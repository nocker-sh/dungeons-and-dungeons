import type { GameContent } from "@/lib/wiz/content/content-schema"
import { finder } from "@/lib/wiz/testing/finder"
import { content } from "@/lib/wiz/testing/real-content"

export type RealRoom = GameContent["rooms"][number]

/** 宿の部屋の定義。 */
export const roomBySlug = finder<RealRoom>("room", content.rooms)
