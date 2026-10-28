import { describe, expect, it } from "vite-plus/test"
import { LayerScenes } from "@/lib/wiz/rules/layer-scenes"
import { contentId } from "@/lib/wiz/testing/content-id"
import { createTestPlay } from "@/lib/wiz/testing/create-test-play"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"
import type { LayerDef } from "@/lib/wiz/content/content-schema"

const station = (
  id: string,
  extra: Partial<LayerDef["stations"][number]> = {}
) => ({
  id,
  x: 0,
  y: 0,
  next: [],
  ...extra,
})
const rest = {
  title: "休む",
  description: "休む",
  choices: [
    { id: "a", label: "休む", description: "休む", healRatio: 0.5 },
    { id: "b", label: "進む", description: "進む" },
  ],
}
const shop = {
  title: "祝福",
  description: "祝福",
  choices: [
    { id: "a", label: "祝福", description: "祝福", blessings: ["x"] },
    { id: "b", label: "書", description: "書" },
  ],
}
const layer = {
  scenes: { path: ["p1", "p2", "p3"], treasure: ["t1"], rest: ["r1", "r2"] },
  stations: [
    station("s"),
    station("a"),
    station("b"),
    station("c", { discovery: rest }),
    station("d", { discovery: shop }),
    station("e"),
    station("f", { discovery: rest }),
  ],
} as unknown as LayerDef

describe("層の背景の選び方", () => {
  it("出来事から道中・宝箱・休憩を分ける。休む選択肢のない発見は道中", () => {
    const [, , , c, d] = layer.stations
    expect(LayerScenes.kindOf(undefined, null)).toBe("path")
    expect(LayerScenes.kindOf(undefined, "battle")).toBe("path")
    expect(LayerScenes.kindOf(undefined, "treasure")).toBe("treasure")
    expect(LayerScenes.kindOf(c, "discovery")).toBe("rest")
    expect(LayerScenes.kindOf(d, "discovery")).toBe("path")
  })

  it("進むたびに同じ種類の候補を順に回し、続く道中で同じ絵を出さない", () => {
    const events = [
      { station: "a", kind: "battle" as const },
      { station: "b", kind: "treasure" as const },
      { station: "c", kind: "discovery" as const },
      { station: "d", kind: "discovery" as const },
      { station: "e", kind: "trap" as const },
      { station: "f", kind: "discovery" as const },
    ]
    const visited = ["s", "a", "b", "c", "d", "e", "f"]
    const keys = visited.map(
      (at, index) =>
        LayerScenes.pick(layer, {
          at,
          visited: visited.slice(0, index + 1),
          events: events.slice(0, index),
        })?.key
    )
    expect(keys).toEqual(["p1", "p2", "t1", "r1", "p3", "p1", "r2"])
  })

  it("候補のない層は null、宝箱・休憩の候補がなければ道中の候補を使う", () => {
    const bare = { ...layer, scenes: undefined } as unknown as LayerDef
    expect(
      LayerScenes.pick(bare, { at: "s", visited: ["s"], events: [] })
    ).toBe(null)
    const pathOnly = { ...layer, scenes: { path: ["p1", "p2"] } } as LayerDef
    expect(
      LayerScenes.pick(pathOnly, {
        at: "b",
        visited: ["s", "a", "b"],
        events: [
          { station: "a", kind: "battle" },
          { station: "b", kind: "treasure" },
        ],
      })
    ).toEqual({ kind: "treasure", key: "p1" })
  })
})

describe("探索中の背景の問い合わせ", () => {
  it("実データの層で、出撃した地点と進んだ地点で別の道中の背景を返し、同じ状態なら同じ背景", () => {
    const { game } = createTestPlay()
    expect(game.queries.scene(game.state)).toBe(null)
    eventsOrThrow(game.send({ type: "depart", layer: contentId("layer0") }))
    const first = game.queries.scene(game.state)
    expect(first).toMatchObject({ layer: contentId("layer0"), kind: "path" })
    eventsOrThrow(game.send({ type: "advance", to: "n1" }))
    const second = game.queries.scene(game.state)
    expect(second?.kind).toBe("path")
    expect(second?.key).not.toBe(first?.key)
    expect(game.queries.scene(game.state)).toEqual(second)
  })
})
