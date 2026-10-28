import { coversRectangle } from "@/scripts/concept-check/rectangles"
import { verifyDoors } from "@/scripts/concept-check/doors"
import { object } from "@/scripts/concept-check/object"
import { finite } from "@/scripts/concept-check/finite"
import type { RecordValue } from "@/scripts/concept-check/object"
import type { ReferenceLookup } from "@/scripts/concept-check/types"

export function verifySpatialDocument(
  file: string,
  data: RecordValue,
  requireTarget: ReferenceLookup,
  problems: string[]
): void {
  const supportKeys = [
    "sleep",
    "food",
    "water",
    "wash",
    "toilet",
    "air",
    "light",
    "storage",
    "access",
  ]
  const verifySupport = (file: string, support: unknown, field: string) => {
    for (const key of supportKeys) {
      const provision = object(support) ? support[key] : undefined
      if (
        !object(provision) ||
        typeof provision.provision !== "string" ||
        !provision.provision.trim()
      )
        problems.push(`${file}: ${field}.${key}の具体的な設備が必要`)
      else {
        const targets = Array.isArray(provision.targets)
          ? provision.targets
          : [provision.target]
        if (provision.target !== undefined && provision.targets !== undefined)
          problems.push(`${file}: ${field}.${key}の単一参照と複数参照が重複`)
        if (!targets.length)
          problems.push(`${file}: ${field}.${key}の接続先が空`)
        for (const target of targets)
          requireTarget(file, target, `${field}.${key}`)
      }
    }
  }
  if (data.entity_type === "room") {
    const spatial = data.spatial
    if (
      !object(spatial) ||
      ![
        spatial.width_m,
        spatial.depth_m,
        spatial.ceiling_m,
        spatial.capacity,
      ].every((v) => finite(v) && v > 0)
    ) {
      problems.push(`${file}: 正の室内寸法・天井高・利用人数が必要`)
    }
    if (
      !object(spatial) ||
      typeof spatial.egress !== "string" ||
      !spatial.egress.trim()
    )
      problems.push(`${file}: 避難経路が必要`)
    if (object(spatial) && Array.isArray(spatial.beds)) {
      if (spatial.beds.length !== spatial.capacity)
        problems.push(`${file}: 寝台数と就寝人数が一致しない`)
      const beds: { x: number; y: number; w: number; d: number }[] = []
      for (const bed of spatial.beds) {
        if (
          !object(bed) ||
          !finite(bed.x_m) ||
          !finite(bed.y_m) ||
          !finite(bed.width_m) ||
          !finite(bed.depth_m) ||
          bed.x_m < 0 ||
          bed.y_m < 0 ||
          bed.width_m < 0.9 ||
          bed.depth_m < 2.1 ||
          !finite(spatial.width_m) ||
          !finite(spatial.depth_m) ||
          bed.x_m + bed.width_m > spatial.width_m + 1e-9 ||
          bed.y_m + bed.depth_m > spatial.depth_m + 1e-9
        ) {
          problems.push(`${file}: 寝台の寸法・配置が不正`)
          continue
        }
        const current = {
          x: bed.x_m,
          y: bed.y_m,
          w: bed.width_m,
          d: bed.depth_m,
        }
        if (Array.isArray(spatial.footprint)) {
          const floor = spatial.footprint.flatMap((part) =>
            object(part) &&
            finite(part.x_m) &&
            finite(part.y_m) &&
            finite(part.width_m) &&
            finite(part.depth_m) &&
            part.width_m > 0 &&
            part.depth_m > 0
              ? [{ x: part.x_m, y: part.y_m, w: part.width_m, d: part.depth_m }]
              : []
          )
          if (!coversRectangle(floor, current))
            problems.push(`${file}: 寝台が室内の床からはみ出す`)
        }
        for (const other of beds)
          if (
            current.x < other.x + other.w &&
            other.x < current.x + current.w &&
            current.y < other.y + other.d &&
            other.y < current.y + current.d
          )
            problems.push(`${file}: 寝台が重複`)
        beds.push(current)
      }
    }
    verifySupport(file, data.life_support, "life_support")
    if (data.animal_support !== undefined) {
      const animal = data.animal_support
      requireTarget(
        file,
        object(animal) ? animal.occupant : undefined,
        "animal_support.occupant"
      )
      verifySupport(file, animal, "animal_support")
    }
  }
  if (data.entity_type === "room-zone" && data.life_support !== undefined)
    verifySupport(file, data.life_support, "life_support")
  if (data.entity_type === "map" && Array.isArray(data.placements)) {
    const bounds = data.bounds
    if (
      !object(bounds) ||
      !finite(bounds.width_m) ||
      !finite(bounds.depth_m) ||
      bounds.width_m <= 0 ||
      bounds.depth_m <= 0
    ) {
      problems.push(`${file}: 地図の正の内寸が必要`)
      return
    }
    const rectangles: {
      id: string
      level: number
      x: number
      y: number
      w: number
      d: number
    }[] = []
    const placedLevels = new Map<string, Set<number>>()
    for (const placement of data.placements) {
      if (!object(placement)) {
        problems.push(`${file}: 配置の形式が不正`)
        continue
      }
      const target = requireTarget(file, placement.target, "placements")
      if (!target) continue
      if (
        object(target.location) &&
        typeof target.location.map === "string" &&
        target.location.map !== data.id
      )
        problems.push(
          `${file}: 配置先とlocation.mapが一致しない ${String(placement.target)}`
        )
      const spatial = target.spatial
      if (
        !object(spatial) ||
        !finite(spatial.width_m) ||
        !finite(spatial.depth_m) ||
        spatial.width_m <= 0 ||
        spatial.depth_m <= 0 ||
        !finite(placement.x_m) ||
        !finite(placement.y_m) ||
        !finite(placement.level)
      ) {
        problems.push(`${file}: ${String(placement.target)}の配置・寸法が不正`)
        continue
      }
      const id = String(placement.target)
      const levels = placedLevels.get(id) ?? new Set<number>()
      if (levels.has(placement.level))
        problems.push(`${file}: 同じ階の配置が重複 ${id} (${placement.level})`)
      levels.add(placement.level)
      placedLevels.set(id, levels)
      const footprint = spatial.footprint ?? [
        {
          x_m: 0,
          y_m: 0,
          width_m: spatial.width_m,
          depth_m: spatial.depth_m,
        },
      ]
      if (!Array.isArray(footprint) || !footprint.length) {
        problems.push(`${file}: 室内形状が空`)
        continue
      }
      for (const part of footprint) {
        if (
          !object(part) ||
          !finite(part.x_m) ||
          !finite(part.y_m) ||
          !finite(part.width_m) ||
          !finite(part.depth_m) ||
          part.x_m < 0 ||
          part.y_m < 0 ||
          part.width_m <= 0 ||
          part.depth_m <= 0 ||
          part.x_m + part.width_m > spatial.width_m + 1e-9 ||
          part.y_m + part.depth_m > spatial.depth_m + 1e-9
        ) {
          problems.push(`${file}: 室内形状の寸法が不正`)
          continue
        }
        const rectangle = {
          id: String(placement.target),
          level: placement.level,
          x: placement.x_m + part.x_m,
          y: placement.y_m + part.y_m,
          w: part.width_m,
          d: part.depth_m,
        }
        if (
          rectangle.x < 0 ||
          rectangle.y < 0 ||
          rectangle.x + rectangle.w > bounds.width_m + 1e-9 ||
          rectangle.y + rectangle.d > bounds.depth_m + 1e-9
        )
          problems.push(`${file}: ${rectangle.id}が建物からはみ出す`)
        for (const other of rectangles)
          if (
            rectangle.id !== other.id &&
            rectangle.level === other.level &&
            rectangle.x < other.x + other.w - 1e-9 &&
            other.x < rectangle.x + rectangle.w - 1e-9 &&
            rectangle.y < other.y + other.d - 1e-9 &&
            other.y < rectangle.y + rectangle.d - 1e-9
          )
            problems.push(`${file}: ${rectangle.id}と${other.id}の室内が重複`)
        rectangles.push(rectangle)
      }
    }
    verifyDoors(file, data, requireTarget, problems)
  }
}
