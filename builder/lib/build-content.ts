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

/**
 * 同じ上書きの作品データ。測定・自動プレイは同じ上書きで何百回も遊ぶので、全データの複製と
 * （Session が定義を使い回す鍵として）検証をやり直さない。上書きの組み合わせを何通りも試しても
 * 記憶が増え続けないよう、最近使ったものだけを残す。
 */
const recent = new Map<string, Built>()
const RECENT_LIMIT = 4

/** 上書きを当てた作品データ。同じ上書きには同じ（凍結した）データを返すので、受け取った側は書き換えない。 */
export function buildContent(overrides: readonly string[] = []): Built {
  const key = JSON.stringify(overrides)
  const cached = recent.get(key)
  if (cached) {
    recent.delete(key)
    recent.set(key, cached)
    return cached
  }
  const source = cloneSource()
  for (const expression of overrides) applyOverride(source, expression)
  const built = {
    source: freeze(source),
    content: freeze(toGameContent(source)),
    slugs: slugIndex(source),
  }
  recent.set(key, built)
  for (const old of recent.keys()) {
    if (recent.size <= RECENT_LIMIT) break
    recent.delete(old)
  }
  return built
}

function freeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value))
    return value
  for (const child of Object.values(value)) freeze(child)
  return Object.freeze(value)
}
