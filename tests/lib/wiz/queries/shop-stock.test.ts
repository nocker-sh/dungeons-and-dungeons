import { describe, expect, it } from "vite-plus/test"
import { aState } from "@/lib/wiz/testing/state-builder"
import { contentId } from "@/lib/wiz/testing/content-id"
import { createTestGame } from "@/lib/wiz/testing/create-test-game"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"

describe("購入前後の所持数", () => {
  it.each([0, 7])(
    "契約石を%s個持っているとき、袋ではなく石の残高を表示する",
    (stones) => {
      const game = createTestGame({
        state: aState().withGold(2000).withStones(stones).build(),
      })
      const shop = contentId("tools")
      const good = contentId("stone")
      const stock = () =>
        game.queries
          .shop(game.state, shop)!
          .goods.find((entry) => entry.id === good)!
      const before = game.save()
      expect(stock().own).toBe(stones)
      expect(game.save()).toEqual(before)
      const price = stock().price
      eventsOrThrow(game.send({ type: "buy", shop, good }))
      expect(game.state.stones).toBe(stones + 1)
      expect(stock().own).toBe(game.state.stones)
      expect(game.state.gold).toBe(before.snapshot.gold - price)
      expect(game.state.bag).toEqual(before.snapshot.bag)
      const saved = game.save()
      expect(game.restore(saved)).toBeUndefined()
      expect(stock().own).toBe(stones + 1)
    }
  )
})
