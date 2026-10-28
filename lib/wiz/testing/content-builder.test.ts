import { describe, expect, it } from "vite-plus/test"
import { GameCatalog } from "@/lib/wiz/content/game-catalog"
import {
  aContent,
  type GameContentBuilder,
} from "@/lib/wiz/testing/content-builder"
import { createTestGame } from "@/lib/wiz/testing/create-test-game"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"
import { contentId } from "@/lib/wiz/testing/content-id"
import { goodBySlug } from "@/lib/wiz/testing/good-by-slug"
import { realContent } from "@/lib/wiz/testing/real-content"

describe("データの組み立て器（aContent）", () => {
  it("差だけを指定し、ほかは本物の作品データのまま", () => {
    const content = aContent().withStartingGold(5).build()
    expect(content.startingGold).toBe(5)
    expect(content.party).toBe(realContent().party)
    expect(content.goods).toBe(realContent().goods)
  })

  it("規則の数値を一段目だけ差し替える", () => {
    const content = aContent()
      .withBalance({ backRow: { melee: 0.5, hit: 0.5 } })
      .build()
    expect(content.balance.backRow).toEqual({ melee: 0.5, hit: 0.5 })
    expect(content.balance.expBase).toBe(realContent().balance.expBase)
  })

  it("武器の攻撃力をそろえると一撃で決まる", () => {
    const content = aContent().withWeaponPower(400).build()
    const weapons = content.goods.filter((good) => good.kind === "weapon")
    expect(weapons.every((good) => good.power === 400)).toBe(true)
    expect(weapons.every((good) => good.need?.str === 0)).toBe(true)
  })

  it("敵・地点・主人公を書き換えられる", () => {
    const kamokutsu = contentId("kamokutsu")
    const content = aContent()
      .withFoe("kamokutsu", { atk: 40 })
      .withStation("layer0", "n1", {
        event: "midboss",
        foes: [kamokutsu, kamokutsu],
      })
      .withPartyMember("hero", { job: "別の職業" })
      .build()
    expect(content.foes.find((foe) => foe.id === kamokutsu)?.atk).toBe(40)
    const station = content.layers[0].stations.find(
      (entry) => entry.id === "n1"
    )
    expect(station).toMatchObject({
      event: "midboss",
      foes: [kamokutsu, kamokutsu],
    })
    expect(
      content.party.find((member) => member.id === contentId("hero"))?.job
    ).toBe("別の職業")
  })

  it("品物を消すと店と募集からも外れ、データの検証を通る", () => {
    const dagger = contentId("dagger")
    const content = aContent().withoutGood("dagger").build()
    expect(content.goods.some((good) => good.id === dagger)).toBe(false)
    for (const shop of content.shops) {
      expect(shop.goods).not.toContain(dagger)
      expect(shop.appraise ?? []).not.toContain(dagger)
    }
    expect(() => new GameCatalog(content)).not.toThrow()
  })

  it.each<[string, (builder: GameContentBuilder) => unknown]>([
    ["品物", (builder) => builder.withGood("missing-good", { price: 1 })],
    ["敵", (builder) => builder.withFoe("missing-foe", { atk: 1 })],
    ["初期メンバー", (builder) => builder.withPartyMember("alda", { lv: 1 })],
    ["募集の冒険者", (builder) => builder.withRecruitMember("hero", { lv: 1 })],
    ["悪魔", (builder) => builder.withDemon("missing-demon", { skills: [] })],
    ["ワザ", (builder) => builder.withSkill("missing-skill", { name: "変更" })],
    ["募集", (builder) => builder.withRecruit("missing-recruit", { price: 1 })],
    ["店", (builder) => builder.withShop("missing-shop", { goods: [] })],
    ["層", (builder) => builder.withLayer("missing-layer", { foes: [] })],
    [
      "地点",
      (builder) =>
        builder.withStation("layer0", "missing-station", { next: [] }),
    ],
    [
      "地点の層",
      (builder) => builder.withStation("missing-layer", "s", { next: [] }),
    ],
    ["層の敵", (builder) => builder.withLayerFoes("missing-layer", [])],
    ["品物の削除", (builder) => builder.withoutGood("missing-good")],
  ])("変更対象がない%sを黙って無視しない", (_label, change) => {
    const builder = aContent()
    const original = builder.build()
    expect(() => change(builder)).toThrow(/見つかりません/)
    expect(builder.build()).toBe(original)
  })

  it("正本にあるIDでも、組み立て中のデータから消した相手は変更できない", () => {
    const removed = aContent().withoutGood("dagger")
    expect(() => removed.withGood("dagger", { price: 1 })).toThrow("dagger")
    expect(() => removed.withoutGood("dagger")).toThrow("dagger")
    expect(realContent().goods).toContainEqual(goodBySlug("dagger"))
  })

  it("重複IDを含む検証用データも変更でき、正本の検証では引き続き拒否する", () => {
    const original = realContent()
    const dagger = goodBySlug("dagger")
    const content = aContent({
      ...original,
      goods: [...original.goods, dagger],
    })
      .withGood("dagger", { price: 1 })
      .build()
    const changed = content.goods.filter((good) => good.id === dagger.id)
    expect(changed).toHaveLength(2)
    expect(changed.every((good) => good.price === 1)).toBe(true)
    expect(() => new GameCatalog(content)).toThrow(/重複/)
    expect(original.goods.filter((good) => good.id === dagger.id)).toHaveLength(
      1
    )
  })

  it("募集仲間は募集用の操作で変更でき、初期メンバーと正本は変わらない", () => {
    const original = realContent()
    const initialLevel = original.recruits.find(
      (entry) => entry.member.id === contentId("alda")
    )!.member.lv
    const changed = aContent()
      .withRecruitMember("alda", { lv: initialLevel + 1 })
      .build()
    expect(
      changed.recruits.find((entry) => entry.member.id === contentId("alda"))
        ?.member.lv
    ).toBe(initialLevel + 1)
    expect(changed.party).toBe(original.party)
    expect(
      original.recruits.find((entry) => entry.member.id === contentId("alda"))
        ?.member.lv
    ).toBe(initialLevel)
    expect(
      aContent()
        .withGood(contentId("dagger"), { price: 1 })
        .build()
        .goods.find((entry) => entry.id === contentId("dagger"))?.price
    ).toBe(1)
  })

  it("作ったデータでそのまま遊べる", () => {
    const game = createTestGame({
      content: aContent().withStartingGold(1000).build(),
    })
    expect(game.state.gold).toBe(1000)
    eventsOrThrow(
      game.send({
        type: "buy",
        shop: contentId("armory"),
        good: contentId("dagger"),
      })
    )
    expect(game.state.gold).toBe(1000 - goodBySlug("dagger").price!)
  })
})
