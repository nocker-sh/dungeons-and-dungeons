import { describe, expect, it } from "vite-plus/test"
import { outfitArtwork, outfitImage } from "@/lib/concept/outfits"
import players from "@/lib/concept/data/players.json"
import { gameContent } from "./game-content"
import { frameOf, portraitOf } from "./looks"
import { GameCatalog } from "@/lib/wiz"
import {
  aState,
  contentId,
  createTestGame,
  eventsOrThrow,
} from "@/lib/wiz/testing"
import { studioArtwork } from "@/lib/dev/studio/artwork"

describe("防具で変わる立ち絵", () => {
  it("着られる全組み合わせを持ち、着られない防具やユニーク・契約の仲間の着替えを混ぜない", () => {
    const catalog = new GameCatalog(gameContent)
    const subjects = [
      ...gameContent.recruits
        // 固定装備の仲間と、悪魔と契約して戦う R（防具を持たない）は着替えない
        .filter((entry) => !entry.member.fixedArmor && !entry.member.pact)
        .map((entry) => ({ look: entry.member.id, member: entry.member.id })),
      ...players.map((player) => ({
        look: player.id,
        member: gameContent.party[0].id,
      })),
    ]
    const expected = subjects.flatMap((subject) =>
      gameContent.goods
        .filter(
          (good) =>
            good.kind === "armor" &&
            (players.some((player) => player.id === subject.look)
              ? gameContent.hero.outfits?.includes(good.id)
              : catalog.canEquip(subject.member, good.id))
        )
        .map((good) => `${subject.look}/${good.id}`)
    )
    expect(
      outfitArtwork.map((entry) => `${entry.look}/${entry.armor}`).sort()
    ).toEqual(expected.sort())
    // 契約の仲間はどの防具も着られない
    for (const entry of gameContent.recruits.filter(
      (entry) => entry.member.pact
    ))
      for (const good of gameContent.goods.filter(
        (good) => good.kind === "armor"
      ))
        expect(catalog.canEquip(entry.member.id, good.id)).toBe(false)
    for (const entry of outfitArtwork) {
      expect(entry.image).toContain("_bust")
      expect(frameOf(entry.look, entry.armor).img).toBe(entry.image)
      expect(frameOf(entry.look, entry.armor).bust).toBe(entry.image)
    }
  })

  it("装備・保存復元・脱衣で上半身が切り替わり、武器の変更は影響しない", () => {
    // ローブの立ち絵があるマユを、モートと入れ替えて出撃させる（スタジオの先読みは出撃の仲間だけ）
    const game = createTestGame({
      state: aState()
        .withGold(10000)
        .withJoined("mayu", { replacing: "mort" })
        .build(),
    })
    const member = contentId("mayu")
    const before = frameOf(member)
    eventsOrThrow(
      game.send({
        type: "buy",
        shop: contentId("armory"),
        good: contentId("robe"),
      })
    )
    const armor = game.state.gear.at(-1)!
    eventsOrThrow(game.send({ type: "equip", gear: armor.id, member }))
    const worn = () =>
      frameOf(
        game.queries.look(game.state, member),
        game.queries.member(game.state, member)!.armor?.good
      )
    expect(worn().img).toBe(outfitImage(member, contentId("robe")))
    expect(worn().img).not.toBe(before.img)
    expect(worn().bust).toBe(worn().img)
    expect(worn().bust).not.toBe(before.bust)
    expect(
      studioArtwork({ initialState: game.state, screen: { name: "town" } })
    ).toContain(worn().img)
    eventsOrThrow(
      game.send({
        type: "buy",
        shop: contentId("armory"),
        good: contentId("greatsword"),
      })
    )
    eventsOrThrow(
      game.send({ type: "equip", gear: game.state.gear.at(-1)!.id, member })
    )
    const image = worn().img
    const restored = createTestGame()
    expect(restored.restore(game.save())).toBeUndefined()
    expect(
      frameOf(
        member,
        restored.queries.member(restored.state, member)!.armor!.good
      ).img
    ).toBe(image)
    eventsOrThrow(game.send({ type: "unequip", gear: armor.id }))
    expect(worn().img).toBe(portraitOf(member))
  })
})
