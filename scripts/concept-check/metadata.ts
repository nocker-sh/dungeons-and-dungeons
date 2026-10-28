import { verifySectionReferences } from "@/scripts/concept-check/sections"
import type { RecordValue } from "@/scripts/concept-check/object"

const entityTypes = new Set([
  "town",
  "district",
  "building",
  "room",
  "room-zone",
  "scene-template",
  "map",
  "site",
  "person",
  "monster",
  "good",
  "effect",
  "visual-record",
  "world-system",
])

/** 未対応の版や種別を検査済みとして扱わない。第1版は既存資料の読み取り用。 */
export function verifyMetadata(
  file: string,
  data: RecordValue,
  body: string,
  problems: string[]
): boolean {
  if (data.schema_version !== 1 && data.schema_version !== 2) {
    problems.push(
      `${file}: 未対応のschema_version ${String(data.schema_version)}`
    )
    return false
  }
  if (
    data.schema_version === 2 &&
    (typeof data.entity_type !== "string" || !entityTypes.has(data.entity_type))
  ) {
    problems.push(`${file}: entity_typeが不正 ${String(data.entity_type)}`)
    return false
  }
  return verifySectionReferences(file, data, body, problems)
}
