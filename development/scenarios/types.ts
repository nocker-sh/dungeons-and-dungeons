import type { PreviewStart } from "@/client/dev/preview-start"
import type { GameContent } from "@/lib/wiz/content/content-schema"
export type Preview = { slug: string; title: string; start: () => PreviewStart }
export type PreviewOptions = { content?: GameContent; seed?: number }
