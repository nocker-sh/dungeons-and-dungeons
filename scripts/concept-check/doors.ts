import { object } from "@/scripts/concept-check/object"
import { finite } from "@/scripts/concept-check/finite"
import type { RecordValue } from "@/scripts/concept-check/object"
import type { ReferenceLookup } from "@/scripts/concept-check/types"

type Wall = "north" | "south" | "east" | "west"
type Segment = { x: number; y: number; horizontal: boolean; wall: Wall }
const tolerance = 1e-8

/** 両室の戸口を同じ平面上へ置き、壁厚と戸前の寝台を照合する。 */
export function verifyDoors(
  file: string,
  map: RecordValue,
  lookup: ReferenceLookup,
  problems: string[]
) {
  if (!Array.isArray(map.doors) || !Array.isArray(map.placements)) return
  const placements = map.placements
  const endpoint = (
    value: unknown,
    level: number,
    width: number,
    height: number
  ): Segment | undefined => {
    if (
      !object(value) ||
      typeof value.target !== "string" ||
      !finite(value.offset_m)
    ) {
      problems.push(`${file}: 戸口の形式が不正`)
      return
    }
    const room = lookup(file, value.target, "doors")
    const placement = placements.find(
      (item) =>
        object(item) && item.target === value.target && item.level === level
    )
    if (
      !room ||
      !object(room.spatial) ||
      !object(placement) ||
      !finite(placement.x_m) ||
      !finite(placement.y_m)
    ) {
      problems.push(
        `${file}: 戸口の部屋が同じ階に配置されていない ${value.target}`
      )
      return
    }
    const spatial = room.spatial
    if (finite(spatial.ceiling_m) && height > spatial.ceiling_m + tolerance) {
      problems.push(`${file}: 戸口が天井より高い ${value.target}`)
      return
    }
    let footprint: unknown = {
      x_m: 0,
      y_m: 0,
      width_m: spatial.width_m,
      depth_m: spatial.depth_m,
    }
    if (value.part !== undefined) {
      if (
        !finite(value.part) ||
        !Number.isInteger(value.part) ||
        !Array.isArray(spatial.footprint) ||
        value.part < 0 ||
        value.part >= spatial.footprint.length
      ) {
        problems.push(`${file}: 戸口の室内形状の指定が不正`)
        return
      }
      footprint = spatial.footprint[value.part]
    }
    if (
      !object(footprint) ||
      !finite(footprint.x_m) ||
      !finite(footprint.y_m) ||
      !finite(footprint.width_m) ||
      !finite(footprint.depth_m)
    )
      return
    const wall = value.wall
    if (
      wall !== "north" &&
      wall !== "south" &&
      wall !== "east" &&
      wall !== "west"
    ) {
      problems.push(`${file}: 戸口の壁が不正`)
      return
    }
    const horizontal = wall === "north" || wall === "south"
    const length = horizontal ? footprint.width_m : footprint.depth_m
    if (value.offset_m < 0 || value.offset_m + width > length + tolerance) {
      problems.push(`${file}: 戸口が壁からはみ出す ${value.target}`)
      return
    }
    const localX =
      footprint.x_m +
      (horizontal ? value.offset_m : wall === "east" ? footprint.width_m : 0)
    const localY =
      footprint.y_m +
      (horizontal ? (wall === "south" ? footprint.depth_m : 0) : value.offset_m)
    const clearance = {
      x: localX - (wall === "east" ? 0.9 : 0),
      y: localY - (wall === "south" ? 0.9 : 0),
      width: horizontal ? width : 0.9,
      depth: horizontal ? 0.9 : width,
    }
    if (Array.isArray(spatial.beds))
      for (const bed of spatial.beds) {
        if (
          !object(bed) ||
          !finite(bed.x_m) ||
          !finite(bed.y_m) ||
          !finite(bed.width_m) ||
          !finite(bed.depth_m)
        )
          continue
        if (
          clearance.x < bed.x_m + bed.width_m - tolerance &&
          bed.x_m < clearance.x + clearance.width - tolerance &&
          clearance.y < bed.y_m + bed.depth_m - tolerance &&
          bed.y_m < clearance.y + clearance.depth - tolerance
        )
          problems.push(`${file}: 寝台が戸口の前を塞ぐ ${value.target}`)
      }
    return {
      x: placement.x_m + localX,
      y: placement.y_m + localY,
      horizontal,
      wall,
    }
  }
  for (const door of map.doors) {
    if (
      !object(door) ||
      !finite(door.level) ||
      !finite(door.width_m) ||
      door.width_m < 0.9 ||
      !finite(door.height_m) ||
      door.height_m < 2.1
    ) {
      problems.push(`${file}: 戸口の階・幅・高さが不正`)
      continue
    }
    const a = endpoint(door.a, door.level, door.width_m, door.height_m)
    const b = endpoint(door.b, door.level, door.width_m, door.height_m)
    if (!a || !b) continue
    const opposite: Record<Wall, Wall> = {
      north: "south",
      south: "north",
      east: "west",
      west: "east",
    }
    const aligned =
      a.horizontal === b.horizontal &&
      opposite[a.wall] === b.wall &&
      Math.abs(a.horizontal ? a.x - b.x : a.y - b.y) < tolerance
    const gap = a.horizontal
      ? a.wall === "south"
        ? b.y - a.y
        : a.y - b.y
      : a.wall === "east"
        ? b.x - a.x
        : a.x - b.x
    if (!aligned || gap < -tolerance || gap > 0.4 + tolerance)
      problems.push(`${file}: 両側の戸口の位置がつながらない`)
  }
}
