import { describe, expect, it } from "vite-plus/test"
import { realContent } from "@/lib/wiz/testing/real-content"
import { GameCatalog } from "@/lib/wiz/content/game-catalog"

describe("合流しない道のり（木）", () => {
  const catalog = new GameCatalog(realContent())

  it("どの層でも、どの地点にも入ってくる線は一本だけ（合流しない）", () => {
    for (const layer of catalog.data.layers) {
      const incoming = new Map<string, number>()
      for (const station of layer.stations)
        for (const next of station.next)
          incoming.set(next, (incoming.get(next) ?? 0) + 1)
      for (const [id, count] of incoming)
        expect(count, `${layer.name} の ${id}`).toBe(1)
      expect(incoming.has(layer.start)).toBe(false)
    }
  })

  it("どの枝を選んでも、8地点目の中ボスと終点のボスに着く", () => {
    for (const layer of catalog.data.layers) {
      const byId = new Map(
        layer.stations.map((station) => [station.id, station])
      )
      const walk = (id: string, seen: string[]): void => {
        const station = byId.get(id)!
        const path = [...seen, id]
        if (!station.next.length) {
          expect(station.boss, `${layer.name}: ${path.join("→")}`).toBe(true)
          const midboss = path.some(
            (step) => byId.get(step)?.event === "midboss"
          )
          expect(midboss, `${layer.name}: ${path.join("→")}`).toBe(true)
          return
        }
        for (const next of station.next) walk(next, path)
      }
      walk(layer.start, [])
    }
  })

  it("元の地点の id は最初の枝に残り、分かれ目の先は上下に分かれる", () => {
    const original = realContent().layers[0]
    const layer = catalog.data.layers[0]
    const ids = new Set(layer.stations.map((station) => station.id))
    for (const station of original.stations)
      expect(ids.has(station.id)).toBe(true)
    for (const station of layer.stations)
      if (station.next.length > 1) {
        const ys = station.next.map(
          (id) => layer.stations.find((entry) => entry.id === id)!.y
        )
        expect(new Set(ys).size).toBe(ys.length)
      }
  })
})
