import { describe, expect, it } from "vite-plus/test"
import { GameCatalog } from "@/lib/wiz/content"
import { aContent } from "@/lib/wiz/testing/content-builder"
import { createTestGame } from "@/lib/wiz/testing/create-test-game"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"
import { contentId, goodBySlug, realContent } from "@/lib/wiz/testing"

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
