import { describe, expect, it } from "vite-plus/test"
import { GameStateBuilder } from "@/lib/wiz/testing/state-builder"
import { contentId } from "@/lib/wiz/testing/content-id"
import { createTestPlay } from "@/lib/wiz/testing/create-test-play"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"
import { testEnvironment } from "@/lib/wiz/testing/test-environment"

const { definition, game: initial } = createTestPlay()
const base = GameStateBuilder.from(initial.state, definition.catalog).withBag([
  { good: contentId("potion"), count: 2 },
  { good: contentId("bone"), count: 3 },
])

function play(foeFirst = false, hurt = false) {
  const builder = hurt ? base.withMember("alda", { hp: 1 }) : base
  return definition.create(
    testEnvironment({ random: 0 }),
    builder
      .inBattle({
        foes: ["kamokutsu"],
        order: foeFirst
          ? ["foe-1", "hero", "alda", "mort"]
          : ["hero", "foe-1", "alda", "mort"],
      })
      .build()
  )
}

describe("戦闘で変わらない持ち物の共有", () => {
  it.each([false, true])(
    "敵の手番=%sで道具を使わなければ袋を複製しない",
    (foeFirst) => {
      const game = play(foeFirst)
      const before = game.state
      const bag = structuredClone(before.bag)
      expect(Object.isFrozen(before.bag)).toBe(true)
      eventsOrThrow(
        game.send(
          foeFirst ? { type: "foe-turn" } : { type: "act", command: "guard" }
        )
      )
      expect(game.state).not.toBe(before)
      expect(game.state.bag).toBe(before.bag)
      expect(before.bag).toEqual(bag)
    }
  )

  it("道具を使うと新しい袋になり、以前の残数は変わらない", () => {
    const game = play(false, true)
    const before = game.state
    eventsOrThrow(
      game.send({
        type: "act",
        command: "item",
        good: contentId("potion"),
        target: contentId("alda"),
      })
    )
    expect(game.state.bag).not.toBe(before.bag)
    expect(
      game.state.bag.find((entry) => entry.good === contentId("potion"))?.count
    ).toBe(1)
    expect(
      before.bag.find((entry) => entry.good === contentId("potion"))?.count
    ).toBe(2)
    expect(
      game.state.bag.find((entry) => entry.good === contentId("bone"))?.count
    ).toBe(3)
  })

  it("使えない素材を指定しても袋も状態も変わらない", () => {
    const game = play()
    const before = game.state
    expect(
      game.send({ type: "act", command: "item", good: contentId("bone") })
    ).toMatchObject({ code: "UNAVAILABLE" })
    expect(game.state).toBe(before)
  })
})
