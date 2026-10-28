import type { EventKind } from "@/lib/wiz/content/constants"
import type { Geometry } from "./route-geometry"

export type RouteView = {
  start: string
  at: string
  stations: readonly {
    id: string
    x: number
    y: number
    next: readonly string[]
    boss: boolean
    midboss: boolean
    event: EventKind | null
    visited: boolean
  }[]
  choices: readonly string[]
}

/** 選択した枝と訪問済みの地点を、描画する座標・辺へ変換する。 */
export function projectRoute(
  route: RouteView,
  geo: Geometry,
  pick: string | null
) {
  const byId = new Map(route.stations.map((station) => [station.id, station]))
  const here = byId.get(route.at)!
  // 道のりは合流しない木なので、高さは今いる地点からの差で描く
  const P = (id: string) => {
    const station = byId.get(id)!
    return {
      x: (station.x - here.x) * geo.sp,
      y: (station.y - here.y) * geo.off,
    }
  }
  const branching = here.next.length > 1
  const future = new Set<string>()
  const walk = (id: string) => {
    for (const next of byId.get(id)?.next ?? []) {
      if (branching && id === route.at && next !== pick) continue
      future.add(next)
      walk(next)
    }
  }
  walk(route.at)
  const onPath = new Set(
    route.stations
      .filter((station) => station.visited)
      .map((station) => station.id)
  )
  const seg = (a: string, b: string) => {
    const A = P(a)
    const B = P(b)
    return `M${A.x.toFixed(1)} ${A.y} L${B.x.toFixed(1)} ${B.y}`
  }
  // 通った地点と、ここから行ける地点だけを描く（選ばなかった枝の先は消える）
  const shown = new Set([
    route.start,
    route.at,
    ...onPath,
    ...future,
    ...(branching ? here.next : []),
  ])
  const stations = route.stations.filter((station) => shown.has(station.id))
  const edges = stations.flatMap((station) =>
    station.next
      .filter((next) => shown.has(next))
      .map((next) => [station.id, next] as const)
  )
  const sizeOf = (id: string) =>
    byId.get(id)?.boss
      ? geo.bossS
      : byId.get(id)?.midboss
        ? (geo.bossS + geo.nodeS) / 2
        : id === route.start
          ? geo.startS
          : geo.nodeS

  return {
    byId,
    here,
    P,
    branching,
    future,
    onPath,
    seg,
    stations,
    edges,
    sizeOf,
  }
}
