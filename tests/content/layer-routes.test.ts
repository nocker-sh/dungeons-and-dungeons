import { describe, expect, it } from "vite-plus/test"
import { gameContent } from "@/content/game-content"
import { aState } from "@/lib/wiz/testing/state-builder"
import { createTestGame } from "@/lib/wiz/testing/create-test-game"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"

function paths(layerNumber: number, start: string, end: string): string[][] {
  const layer = gameContent.layers[layerNumber]
  const walk = (id: string, visited: string[]): string[][] => {
    if (visited.includes(id)) throw new Error("前進する道のりに循環がある")
    const route = [...visited, id]
    if (id === end) return [route]
    const station = layer.stations.find((entry) => entry.id === id)
    if (!station) throw new Error(`地点 ${id} がない`)
    return station.next.flatMap((next) => walk(next, route))
  }
  return walk(start, [])
}

describe("層ごとの分岐の判断", () => {
  it("全層で全地点が到達可能で、どの道も中ボスと最後の祭壇を通ってボスへ着く", () => {
    for (const layer of gameContent.layers) {
      const boss = layer.stations.find((entry) => entry.boss)!
      const routes = paths(layer.no, layer.start, boss.id)
      expect(new Set(routes.flat()).size).toBe(layer.stations.length)
      for (const route of routes) {
        expect(route).toContain("n8")
        expect(route).toContain("n14")
        expect(route.at(-1)).toBe(boss.id)
      }
    }
    const shapes = gameContent.layers.map((layer) =>
      JSON.stringify(
        layer.stations.map((station) => [station.id, station.next])
      )
    )
    expect(new Set(shapes).size).toBe(5)
  })

  it.each([1, 4])(
    "%s層では採集・準備の後に戦闘か未知の道を選べ、保存できる",
    (layer) => {
      const at = layer === 1 ? "l5" : "l12"
      const game = createTestGame({
        state: aState()
          .withReached(layer)
          .inExpedition({
            layer: `layer${layer}`,
            at,
            visited: ["s", at],
            pending: { kind: "discovery" },
          })
          .build(),
      })
      eventsOrThrow(
        game.send({ type: "discover", choice: layer === 1 ? "leave" : "rest" })
      )
      eventsOrThrow(game.send({ type: "acknowledge" }))
      const route = game.queries.route(game.state)!
      expect(route.paths).toHaveLength(2)
      const before = game.state
      for (const to of route.choices) {
        const branch = createTestGame({ state: before })
        eventsOrThrow(branch.send({ type: "advance", to }))
        expect(branch.restore(branch.save())).toBeUndefined()
        expect(branch.queries.problems(branch.state)).toEqual([])
      }
    }
  )

  it("鉄橋は中ボス後に宝箱、温室は書の戦闘前に収穫、祭壇は書の戦闘前に準備を置く", () => {
    for (const route of paths(2, "n8", "n14")) {
      expect(route.indexOf("n10")).toBeLessThan(route.indexOf("n11"))
    }
    for (const route of paths(3, "n11", "n14")) {
      if (route.includes("u12")) {
        expect(route.indexOf("u13")).toBeLessThan(route.indexOf("u12"))
        expect(route).not.toContain("l12")
      } else {
        expect(route).toContain("l12")
        expect(route.indexOf("l13")).toBeLessThan(route.indexOf("l12"))
      }
    }
    for (const route of paths(4, "n9", "n14")) {
      expect(route).toContain("l12")
      if (route.includes("u12"))
        expect(route.indexOf("l12")).toBeLessThan(route.indexOf("u12"))
    }
  })
})
