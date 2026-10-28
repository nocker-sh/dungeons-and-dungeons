import { expect, it } from "vite-plus/test"
import { aState } from "@/lib/wiz/testing/state-builder"
import { contentId } from "@/lib/wiz/testing/content-id"
import { createTestGame } from "@/lib/wiz/testing/create-test-game"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"
import { sequentialIds } from "@/lib/wiz/testing/sequential-ids"

it("購入前の装備対象が実際に購入した個体の装備対象と一致する", () => {
  const game = createTestGame({
    state: aState().withGold(100000).build(),
    ids: sequentialIds("shop-targets"),
  })
  const shop = contentId("armory")
  const equipment = game.queries
    .shop(game.state, shop)!
    .goods.filter((good) => good.kind === "weapon" || good.kind === "armor")
  expect(equipment.length).toBeGreaterThan(0)
  for (const good of equipment) {
    const expected = good.equipMembers!.map((member) => member.id)
    eventsOrThrow(game.send({ type: "buy", shop, good: good.id }))
    const purchased = game.state.gear.at(-1)!
    expect(purchased.good).toBe(good.id)
    const actual = game.state.party.filter((member) =>
      game.queries
        .equipOptions(game.state, member)
        .some((entry) => entry.gear === purchased.id)
    )
    expect(expected).toEqual(actual)
  }
})

it("登録名と現在の編成を購入前の対象へ反映する", () => {
  const initial = aState().withHero("コハク").build()
  const game = createTestGame({
    state: { ...initial, party: [initial.party[0]] },
  })
  const goods = game.queries.shop(game.state, contentId("armory"))!.goods
  const weapon = goods.find((good) => good.kind === "weapon")!
  expect(weapon.equipMembers!.map((member) => member.name)).toEqual(["コハク"])
  expect(
    goods.some(
      (good) => good.kind === "armor" && good.equipMembers?.length === 0
    )
  ).toBe(true)
  for (const good of goods) {
    for (const member of good.equipMembers ?? [])
      expect(member.id).toBe(initial.party[0])
  }
})
