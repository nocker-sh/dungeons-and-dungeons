import { describe, expect, it } from "vite-plus/test"
import { contentSource, gameContent } from "@/content/game-content"
import { goodsCatalog } from "@/development/goods"
import { GameCatalog } from "@/lib/wiz/content/game-catalog"
import { aState } from "@/lib/wiz/testing/state-builder"
import { createTestGame } from "@/lib/wiz/testing/create-test-game"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"

const catalog = new GameCatalog(gameContent)
const members = [
  ...gameContent.party,
  ...gameContent.recruits
    .filter((entry) => !entry.retired)
    .map((entry) => entry.member),
]
const publicGoods = new Set([
  ...gameContent.shops.flatMap((shop) => [
    ...shop.goods,
    ...(shop.appraise ?? []),
  ]),
  ...(gameContent.smithy?.recipes.map((recipe) => recipe.good) ?? []),
  ...gameContent.layers.flatMap((layer) =>
    layer.treasure.goods.map((entry) => entry.good)
  ),
  ...gameContent.foes.flatMap((foe) => foe.drops.map((entry) => entry.good)),
  ...gameContent.quests.flatMap((quest) =>
    quest.reward.goods.map((entry) => entry.good)
  ),
])

describe("仲間削減後の装備の入手と成長", () => {
  it("入手可能な全武器・防具を、装備変更できる現役が少なくとも一人使える", () => {
    for (const good of gameContent.goods.filter(
      (entry) =>
        publicGoods.has(entry.id) && ["weapon", "armor"].includes(entry.kind)
    )) {
      expect(
        members.some(
          (member) =>
            catalog.canEquip(member.id, good.id) &&
            !catalog.isSlotFixed(member.id, good.kind)
        ),
        good.name
      ).toBe(true)
    }
  })

  it("全5武器種に得意な現役がいて、全層で店から得意武器を更新できる", () => {
    const weaponTypes = ["greatsword", "sword", "axe", "gun", "dagger"] as const
    const shopGoods = new Set(gameContent.shops.flatMap((shop) => shop.goods))
    for (const type of weaponTypes) {
      expect(
        members.some(
          (member) =>
            member.favorite === type &&
            !catalog.isSlotFixed(member.id, "weapon")
        ),
        type
      ).toBe(true)
      for (const layer of gameContent.layers)
        expect(
          gameContent.goods.some(
            (good) =>
              good.weaponType === type &&
              shopGoods.has(good.id) &&
              (good.unlock ?? 0) === layer.no
          ),
          `${type}: ${layer.no}層`
        ).toBe(true)
    }
  })

  it("装備を変えられる現役は全層で防具を更新でき、買って着用・保存できる", () => {
    const armory = contentSource.shops.find(
      (shop) => shop.slug === "armory"
    )!.id
    for (const recruit of contentSource.recruits.filter(
      (entry) => !entry.retired && !entry.member.pact && !entry.member.unique
    )) {
      for (const layer of gameContent.layers) {
        const good = gameContent.goods
          .filter(
            (entry) =>
              entry.kind === "armor" &&
              (entry.unlock ?? 0) === layer.no &&
              gameContent.shops.some((shop) => shop.goods.includes(entry.id)) &&
              catalog.canEquip(recruit.member.id, entry.id)
          )
          .sort((a, b) => (b.durability ?? 0) - (a.durability ?? 0))[0]
        expect(good, `${recruit.member.name}: ${layer.no}層`).toBeDefined()
        let state = aState().withGold(10000).withReached(layer.no)
        if (!gameContent.startingCompanions?.includes(recruit.member.id))
          state = state.withJoined(recruit.member.slug)
        const game = createTestGame({ state: state.build() })
        eventsOrThrow(game.send({ type: "buy", shop: armory, good: good.id }))
        const gear = game.state.gear.findLast(
          (entry) => entry.good === good.id && !entry.owner
        )!
        eventsOrThrow(
          game.send({ type: "equip", member: recruit.member.id, gear: gear.id })
        )
        expect(
          game.queries.member(game.state, recruit.member.id)?.armor?.good
        ).toBe(good.id)
        expect(game.restore(game.save())).toBeUndefined()
      }
    }
  })

  it("廃止した契約武器は新規入手・制作一覧から外し、汎用の継鋼の剣盾は残す", () => {
    const retiredModes = gameContent.recruits
      .filter((entry) => entry.retired)
      .flatMap((entry) => entry.member.pact?.modes ?? [])
    expect(retiredModes).toHaveLength(2)
    for (const mode of retiredModes) {
      expect(catalog.good(mode.weapon)).toBeDefined()
      expect(publicGoods.has(mode.weapon)).toBe(false)
      expect(goodsCatalog.some((good) => good.id === mode.weapon)).toBe(false)
    }
    const shield = contentSource.goods.find(
      (good) => good.slug === "rivet-sword-shield"
    )!
    expect(publicGoods.has(shield.id)).toBe(true)
    expect(goodsCatalog.some((good) => good.id === shield.id)).toBe(true)
  })
})
