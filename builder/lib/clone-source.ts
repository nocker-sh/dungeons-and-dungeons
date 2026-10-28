import { contentSource } from "@/content/game-content"
import type { Source } from "@/builder/lib/content"

export function cloneSource(): Source {
  return structuredClone(contentSource)
}
