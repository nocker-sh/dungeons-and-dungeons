import { object } from "@/scripts/concept-check/object"
import type { ConceptDocuments } from "@/scripts/concept-check/types"

/** 親子関係は循環させず、地図への参照は地図資料に限定する。 */
export function verifyLocations(
  documents: ConceptDocuments,
  problems: string[]
): void {
  const checked = new Set<string>()
  for (const [id, { file, data }] of documents) {
    if (object(data.location) && typeof data.location.map === "string") {
      const map = documents.get(data.location.map)
      // 参照先の欠落は通常の参照検査が報告する。
      if (map && map.data.entity_type !== "map")
        problems.push(
          `${file}: location.mapが地図ではない ${data.location.map}`
        )
    }
    const path: string[] = []
    const positions = new Map<string, number>()
    let current: string | undefined = id
    while (current !== undefined && !checked.has(current)) {
      const position = positions.get(current)
      if (position !== undefined) {
        const cycle = [...path.slice(position), current]
        problems.push(`${file}: 場所の親子関係が循環 ${cycle.join(" → ")}`)
        break
      }
      const entry = documents.get(current)
      if (!entry) break
      positions.set(current, path.length)
      path.push(current)
      const location = entry.data.location
      current =
        object(location) && typeof location.parent === "string"
          ? location.parent
          : undefined
    }
    for (const visited of path) checked.add(visited)
  }
}
