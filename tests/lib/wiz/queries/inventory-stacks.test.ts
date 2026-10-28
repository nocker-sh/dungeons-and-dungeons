import { expect, it } from "vite-plus/test"
import { aState } from "@/lib/wiz/testing/state-builder"
import { contentId } from "@/lib/wiz/testing/content-id"
import { realContent } from "@/lib/wiz/testing/real-content"
import { createTestGame } from "@/lib/wiz/testing/create-test-game"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"

it("別の束に分かれた同じ道具・素材を合計し、売却後も一品一行で表示する", () => {
  const potion = contentId("potion")
  const junk = realContent().junk
  const game = createTestGame({
    state: aState()
      .withBag([
        { good: potion, count: 3 },
        { good: junk, count: 2 },
        { good: potion, count: 4 },
        { good: junk, count: 3 },
      ])
      .build(),
  })
  const before = game.save()
  const items = () =>
    game.queries.items(game.state).filter((entry) => entry.id === potion)
  const materials = () =>
    game.queries.materials(game.state).filter((entry) => entry.id === junk)
  const sellables = () =>
    game.queries.sellables(game.state).filter((entry) => entry.id === potion)
  expect(items()).toMatchObject([{ count: 7 }])
  expect(materials()).toMatchObject([{ count: 5 }])
  expect(sellables()).toMatchObject([{ count: 7 }])
  expect(game.queries.supplies(game.state).items).toMatchObject([
    { id: potion, total: 7, carried: 7, stored: 0 },
  ])
  expect(game.save()).toEqual(before)
  eventsOrThrow(game.send({ type: "sell", good: potion }))
  expect(items()).toMatchObject([{ count: 6 }])
  expect(sellables()).toMatchObject([{ count: 6 }])
  expect(materials()).toMatchObject([{ count: 5 }])
})
