import { toGameContent } from "@/content/game-content"
import type { GameContent } from "@/lib/wiz/content/content-schema"
import type { Source } from "@/builder/lib/content"
import { cloneSource } from "@/builder/lib/clone-source"
import { applyOverride } from "@/builder/lib/apply-override"
import { slugIndex } from "@/builder/lib/slug-index"

export type Built = {
  source: Source
  content: GameContent
  slugs: Map<string, string>
}

/** 上書きを当てた作品データ。 */
export function buildContent(overrides: readonly string[] = []): Built {
  const source = cloneSource()
  for (const expression of overrides) applyOverride(source, expression)
  return { source, content: toGameContent(source), slugs: slugIndex(source) }
}
