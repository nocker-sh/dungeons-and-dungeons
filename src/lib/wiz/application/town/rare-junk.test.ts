import { describe, expect, it } from "vite-plus/test"
import {
  aState,
  contentId,
  createTestGame,
  eventsOrThrow,
  goodBySlug,
  realContent,
  seededRandom,
} from "@/lib/wiz/testing"
import { GameCommandError } from "@/lib/wiz"

describe("光るガラクタの鑑定", () => {
  const rare = goodBySlug("rare-junk").id

  it("[feature:W010] 光るガラクタは武器の店で必ず R 以上の武器になり、1つ減る", () => {
    for (let seed = 1; seed <= 40; seed++) {
      const game = createTestGame({
        random: seededRandom(seed),
        state: aState().withItem("rare-junk", 1).build(),
      })
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
