import { describe, expect, it } from "vite-plus/test"
import { aState } from "@/lib/wiz/testing/state-builder"
import { contentId } from "@/lib/wiz/testing/content-id"
import { goodBySlug } from "@/lib/wiz/testing/good-by-slug"
import { realContent } from "@/lib/wiz/testing/real-content"
import { createTestGame } from "@/lib/wiz/testing/create-test-game"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"
import { seededRandom } from "@/lib/wiz/testing/seeded-random"
import { testEnvironment } from "@/lib/wiz/testing/test-environment"
import { GameCommandError } from "@/lib/wiz/game/game-command-error"
import { GameDefinition } from "@/lib/wiz/definition/game-definition"

describe("光るガラクタの鑑定", () => {
  const rare = goodBySlug("rare-junk").id

  it("[feature:W010] 光るガラクタは武器の店で必ず R 以上の武器になり、1つ減る", () => {
    const definition = new GameDefinition(realContent())
    const state = aState().withItem("rare-junk", 1).build()
    for (let seed = 1; seed <= 40; seed++) {
      const game = definition.create(
        testEnvironment({ random: seededRandom(seed) }),
        state
      )
      const events = eventsOrThrow(
        game.send({ type: "appraise", shop: contentId("armory"), rare: true })
      )
      const found = events.find((event) => event.type === "appraised")
      expect(found?.type === "appraised" && found.rarity).toMatch(/^S?R$/)
      const good = realContent().goods.find(
        (entry) => found?.type === "appraised" && entry.id === found.good
      )
      expect(good?.kind).toBe("weapon")
      expect(game.state.bag.some((entry) => entry.good === rare)).toBe(false)
    }
  })

  it("[feature:W010] 光るガラクタがなければ拒否し、ふつうのガラクタは減らさない", () => {
    const game = createTestGame({
      state: aState().withItem("junk", 2).build(),
    })
    const before = game.state
    expect(
      game.send({ type: "appraise", shop: contentId("armory"), rare: true })
    ).toBeInstanceOf(GameCommandError)
    expect(game.state).toBe(before)
  })

  it("[feature:W010] 武器を出さない店では光るガラクタを鑑定できない", () => {
    const game = createTestGame({
      state: aState().withItem("rare-junk", 1).build(),
    })
    const before = game.state
    expect(
      game.send({ type: "appraise", shop: contentId("tools"), rare: true })
    ).toBeInstanceOf(GameCommandError)
    expect(game.state).toBe(before)
  })

  it("ボスは光るガラクタを落とす", () => {
    for (const slug of ["haribote-adult", "slime-swordsman"]) {
      const foe = realContent().foes.find(
        (entry) => entry.id === contentId(slug)
      )!
      expect(
        foe.drops.some((drop) => drop.good === rare),
        slug
      ).toBe(true)
    }
  })
})
