import { describe, expect, it } from "vite-plus/test"
import { gameContent } from "@/lib/content/game-content"
import {
  aState,
  contentId,
  createTestGame,
  eventsOrThrow,
} from "@/lib/wiz/testing"
import { Bag } from "@/lib/wiz/rules/bag"

const materials = ["bone", "gear", "seed", "wax"]

describe("層の素材とHPで選ぶ探索", () => {
  it.each([1, 2, 3, 4])(
    "%s層で採集した素材を休息に使い、一度だけ支払う",
    (layer) => {
      const material = contentId(materials[layer - 1])
      const game = createTestGame({
        state: aState()
          .withReached(layer)
          .inExpedition({
            layer: `layer${layer}`,
            at: "l5",
            visited: ["s", "l5"],
            pending: { kind: "discovery" },
          })
          .build(),
      })
      const before = game.state
      expect(game.send({ type: "discover", choice: "rest" })).toMatchObject({
        code: "UNAVAILABLE",
      })
      expect(game.state).toBe(before)
      eventsOrThrow(game.send({ type: "discover", choice: "salvage" }))
      for (const member of game.state.members.filter((member) =>
        game.state.party.includes(member.id)
      )) {
        const old = before.members.find((entry) => entry.id === member.id)!
        expect(member.hp).toBeLessThan(old.hp)
        expect(member.hp).toBeGreaterThan(0)
      }
      const quantity = Bag.count(game.state.bag, material)
      expect(quantity).toBeGreaterThanOrEqual(4)
      expect(game.restore(game.save())).toBeUndefined()
      const paid = game.state
      expect(game.send({ type: "discover", choice: "salvage" })).toMatchObject({
        code: "NOT_READY",
      })
      expect(game.state).toBe(paid)
      const resting = createTestGame({
        state: {
          ...game.state,
          phase: {
            type: "expedition",
            expedition: {
              ...(game.state.phase.type === "expedition"
                ? game.state.phase.expedition
                : (() => {
                    throw new Error("探索ではない")
                  })()),
              pending: { kind: "discovery" },
            },
          },
        },
      })
      eventsOrThrow(resting.send({ type: "discover", choice: "rest" }))
      expect(Bag.count(resting.state.bag, material)).toBe(quantity - 2)
      expect(resting.queries.problems(resting.state)).toEqual([])
    }
  )

  it("固有の場所と素材を層ごとに分け、ボス前に素材を補充へ使える", () => {
    const titles = new Set<string>()
    for (const layer of gameContent.layers.filter((entry) => entry.no > 0)) {
      const gathering = layer.stations.find(
        (station) => station.id === "l5"
      )!.discovery!
      titles.add(gathering.title)
      const material = contentId(materials[layer.no - 1])
      const game = createTestGame({
        state: aState()
          .withReached(layer.no)
          .withItem(materials[layer.no - 1], 3)
          .withMember("alda", {
            used: [{ skill: contentId("hold-line"), count: 2 }],
          })
          .inExpedition({
            layer: `layer${layer.no}`,
            at: "l12",
            visited: ["s", "l12"],
            pending: { kind: "discovery" },
          })
          .build(),
      })
      eventsOrThrow(game.send({ type: "discover", choice: "prepare" }))
      expect(Bag.count(game.state.bag, material)).toBe(0)
      expect(
        game.state.members.find((member) => member.id === contentId("alda"))!
          .used
      ).toEqual([])
      expect(game.queries.problems(game.state)).toEqual([])
    }
    expect(titles.size).toBe(4)
  })
})
