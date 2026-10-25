import type { PreviewStart } from "@/lib/game-client/start"
import type { GameContent } from "@/lib/wiz"
export type Preview = { slug: string; title: string; start: () => PreviewStart }
export type PreviewOptions = { content?: GameContent; seed?: number }
