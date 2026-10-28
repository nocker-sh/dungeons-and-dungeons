import { describe, expect, it } from "vite-plus/test"
import { GameCommandError } from "@/lib/wiz/game/game-command-error"
import { aContent } from "@/lib/wiz/testing/content-builder"
import { aState } from "@/lib/wiz/testing/state-builder"
import { contentId } from "@/lib/wiz/testing/content-id"
import { createTestGame } from "@/lib/wiz/testing/create-test-game"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"

// 売却不可は品物共通の指定。素材だけでなく武器・防具の個体にも適用する。
describe.each(["sword", "leather"])("%sの売却可否", (slug) => {
  function held(sellable?: boolean) {
    const content = aContent().withGood(slug, { sellable }).build()
    const state = aState(content)
      .withGear([])
      .withEquipped("alda", slug)
      .build()
    const gear = state.gear[0]
    const game = createTestGame({
      content,
      state: { ...state, gear: [{ ...gear, owner: null }] },
    })
    return { game, gear: gear.id }
  }

  it("売却不可なら候補に出ず、個体IDを直接指定しても保存・資産を変えない", () => {
    const { game, gear } = held(false)
    expect(game.restore(game.save())).toBeUndefined()
    expect(
      game.queries
        .sellables(game.state)
        .some((entry) => entry.sell.gear === gear)
    ).toBe(false)
    const before = game.state
    const saved = game.save()
    const result = game.send({ type: "sell", gear })
    expect(result).toBeInstanceOf(GameCommandError)
    expect((result as GameCommandError).code).toBe("UNAVAILABLE")
    expect(game.state).toBe(before)
    expect(game.save()).toEqual(saved)
    // 売却不可でも、所有して使うことはできる。
    eventsOrThrow(game.send({ type: "equip", gear, member: contentId("alda") }))
    expect(game.state.gear.find((entry) => entry.id === gear)?.owner).toBe(
      contentId("alda")
    )
  })

  it.each([undefined, true])(
    "売却指定=%sなら表示価格どおり1個だけ売れ、二重売却を拒否する",
    (sellable) => {
      const { game, gear } = held(sellable)
      const row = game.queries
        .sellables(game.state)
        .find((entry) => entry.sell.gear === gear)!
      expect(row).toBeDefined()
      const saved = game.save()
      eventsOrThrow(game.send({ type: "sell", gear }))
      expect(game.save()).toEqual({
        ...saved,
        snapshot: {
          ...saved.snapshot,
          gold: saved.snapshot.gold + row.price,
          gear: [],
        },
      })
      const sold = game.save()
      expect((game.send({ type: "sell", gear }) as GameCommandError).code).toBe(
        "NOT_OWNED"
      )
      expect(game.save()).toEqual(sold)
      expect(game.restore(sold)).toBeUndefined()
    }
  )
})
