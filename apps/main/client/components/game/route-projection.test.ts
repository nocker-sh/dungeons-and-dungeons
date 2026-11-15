import { describe, expect, it } from "vite-plus/test"
import { projectRoute } from "@/client/components/game/route-projection"
import type { RouteView } from "@/client/components/game/route-projection"
import { geometry } from "@/client/components/game/route-geometry"

const station = (
  id: string,
  x: number,
  next: string[],
  extra: Partial<RouteView["stations"][number]> = {}
) => ({
  id,
  x,
  y: 0,
  next,
  boss: false,
  midboss: false,
  event: null,
  visited: false,
  ...extra,
})

const route = (at: string, visited: string[]): RouteView => ({
  start: "s",
  at,
  choices: [],
  stations: [
    station("s", 0, ["a"], { visited: true }),
    station("a", 1, ["m"]),
    station("m", 2, ["b"], { midboss: true }),
    station("b", 3, [], { boss: true }),
  ].map((entry) => ({ ...entry, visited: visited.includes(entry.id) })),
})

describe("projectRoute", () => {
  it("着く前の中ボスとボスの地点に名札を付ける", () => {
    const view = projectRoute(route("s", ["s"]), geometry(false, 390, 844), null)
    expect(view.landmarks).toEqual([
      { id: "m", kind: "midboss" },
      { id: "b", kind: "boss" },
    ])
  })

  it("通った中ボスの名札は外す", () => {
    const view = projectRoute(
      route("m", ["s", "a", "m"]),
      geometry(false, 390, 844),
      null
    )
    expect(view.landmarks).toEqual([{ id: "b", kind: "boss" }])
  })
})
