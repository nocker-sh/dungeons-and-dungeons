import type { Source } from "@/builder/lib/content"
import { idOf } from "@/builder/lib/id-of"

export function parseValue(source: Source, raw: string): unknown {
  // "@slug" は id に置き換える（参照の書き換え用）
  const resolve = (value: unknown): unknown => {
    if (typeof value === "string" && value.startsWith("@")) {
      const id = idOf(source, value.slice(1))
      if (!id) throw new Error(`slug が見つからない: ${value}`)
      return id
    }
    if (Array.isArray(value)) return value.map(resolve)
    return value
  }
  try {
    return resolve(JSON.parse(raw))
  } catch {
    return resolve(raw)
  }
}
