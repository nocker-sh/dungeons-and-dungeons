import { describe, expect, it } from "vite-plus/test"
import { contentSource, gameContent } from "@/content/game-content"
import { foeAppearance } from "@/content/foe-appearance"
import world from "@/concept/data/world.json"
import { aState } from "@/lib/wiz/testing/state-builder"
import { createTestGame } from "@/lib/wiz/testing/create-test-game"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"

const variants = [
  ["kamokutsu-mud", "kamokutsu", "mud-splash"],
  ["kemurimaki-fire", "kemurimaki", "candle-flame"],
  ["yadocup-fire", "yadocup", "candle-flame"],
  ["horopoppo-poison", "horopoppo", "poison-spit"],
  ["tsunofood-bone", "tsunofood", "bone-horn"],
] as const

describe("行動が異なる亜種の配置", () => {
  it.each(variants)(
    "%sは専用の姿と行動で登場し、保存再開でも保つ",
    (slug, parent, skillSlug) => {
      const definition = contentSource.foes.find((foe) => foe.slug === slug)!
      const skill = contentSource.skills.find(
        (entry) => entry.slug === skillSlug
      )!
      const art = world.find((entry) => entry.id === definition.id)!
      const layer = gameContent.layers.find((entry) =>
        entry.foes.includes(definition.id)
      )!
      const sourceLayer = contentSource.layers.find(
        (entry) => entry.id === layer.id
      )!
      const station = layer.stations.find((entry) => entry.id === "n15")!
      const predecessor = layer.stations.find((entry) =>
        entry.next.includes(station.id)
      )!
      const game = createTestGame({
        state: aState()
          .withReached(layer.no)
          .inExpedition({
            layer: sourceLayer.slug,
            at: predecessor.id,
            visited: ["s", predecessor.id],
          })
          .build(),
        random: 0,
      })
      eventsOrThrow(game.send({ type: "advance", to: station.id }))
      const view = game.queries.battle(game.state)!
      expect(view.foes.map((foe) => foe.foe)).toEqual(station.foes)
      const individual = view.foes.find((foe) => foe.foe === definition.id)!
      expect(individual.maxHp).toBe(definition.hp)
      expect(foeAppearance(definition.id, individual.appearanceId)?.img).toBe(
        art.image
      )
      const parentId = contentSource.foes.find((foe) => foe.slug === parent)!.id
      for (let index = 0; index < 40; index++)
        expect(foeAppearance(parentId, `individual-${index}`)?.img).not.toBe(
          art.image
        )
      const resumed = createTestGame()
      expect(resumed.restore(game.save())).toBeUndefined()
      expect(resumed.queries.battle(resumed.state)?.foes).toEqual(view.foes)
      const acting = createTestGame({
        state: aState()
          .inBattle({
            foes: [slug],
            order: ["foe-1", "hero", "alda", "mort"],
          })
          .build(),
        random: 0,
      })
      expect(eventsOrThrow(acting.send({ type: "foe-turn" }))).toContainEqual(
        expect.objectContaining({
          type: "acted",
          command: "skill",
          skill: skill.id,
          name: skill.name,
        })
      )
    }
  )
})
