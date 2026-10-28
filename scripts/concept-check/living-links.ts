import { object } from "@/scripts/concept-check/object"
import { finite } from "@/scripts/concept-check/finite"
import type { RecordValue } from "@/scripts/concept-check/object"
import type { ConceptDocuments } from "@/scripts/concept-check/types"

function hasBed(data: RecordValue | undefined): boolean {
  return (
    data?.entity_type === "room" &&
    object(data.spatial) &&
    Array.isArray(data.spatial.beds) &&
    data.spatial.beds.length > 0
  )
}

/** 人の就寝先と常住先を、寝床の実体へつなぐ。動物の休む面は別の生活設計。 */
export function verifyLivingLinks(
  documents: ConceptDocuments,
  problems: string[]
): void {
  const occupants = new Map<
    string,
    { file: string; capacity: unknown; people: Set<string> }
  >()
  for (const { file, data } of documents.values()) {
    if (
      (data.entity_type === "room" || data.entity_type === "room-zone") &&
      object(data.life_support) &&
      object(data.life_support.sleep)
    ) {
      const sleep = data.life_support.sleep
      const targets = Array.isArray(sleep.targets)
        ? sleep.targets
        : [sleep.target]
      for (const id of targets) {
        if (typeof id !== "string") continue
        const target = documents.get(id)
        // 存在しない参照は通常の参照検査が報告する。
        if (target && !hasBed(target.data))
          problems.push(`${file}: 就寝先に寝台がない ${id}`)
      }
    }
    if (
      data.entity_type === "person" &&
      Array.isArray(data.tags) &&
      data.tags.includes("暮らし") &&
      !(object(data.livelihood) && object(data.livelihood.lodging)) &&
      !(
        Array.isArray(data.relations) &&
        data.relations.some(
          (relation) =>
            object(relation) &&
            relation.type === "resides_in" &&
            typeof relation.target === "string" &&
            relation.target.trim().length > 0
        )
      )
    )
      problems.push(`${file}: 暮らしの資料に常住先または条件付き宿泊先がない`)
    if (data.entity_type === "person" && object(data.livelihood)) {
      const lodging = data.livelihood.lodging
      if (object(lodging)) {
        const target =
          typeof lodging.target === "string"
            ? documents.get(lodging.target)
            : undefined
        if (!target)
          problems.push(
            `${file}: 宿泊先の参照先がない ${String(lodging.target)}`
          )
        else if (!hasBed(target.data))
          problems.push(`${file}: 宿泊先に寝台がない ${String(lodging.target)}`)
        if (typeof lodging.condition !== "string" || !lodging.condition.trim())
          problems.push(`${file}: 宿泊条件がない`)
      }
    }
    if (data.entity_type !== "person" || !Array.isArray(data.relations))
      continue
    for (const relation of data.relations) {
      if (
        !object(relation) ||
        relation.type !== "resides_in" ||
        typeof relation.target !== "string"
      )
        continue
      const target = documents.get(relation.target)
      if (!target) continue
      if (!hasBed(target.data)) {
        problems.push(`${file}: 住まいに寝台がない ${relation.target}`)
        continue
      }
      const occupancy = occupants.get(relation.target) ?? {
        file: target.file,
        capacity: object(target.data.spatial)
          ? target.data.spatial.capacity
          : undefined,
        people: new Set<string>(),
      }
      occupancy.people.add(String(data.id))
      occupants.set(relation.target, occupancy)
    }
  }
  for (const [id, { file, capacity, people }] of occupants) {
    if (finite(capacity) && people.size > capacity)
      problems.push(
        `${file}: 常住人数が寝室の定員を超える ${id} (${people.size}/${capacity})`
      )
  }
}
