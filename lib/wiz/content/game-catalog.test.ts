import { describe, expect, it } from "vite-plus/test"
import { aState } from "@/lib/wiz/testing/state-builder"
import { contentId } from "@/lib/wiz/testing/content-id"
import { realContent } from "@/lib/wiz/testing/real-content"
import { ContentError } from "@/lib/wiz/content/content-error"
import { GameCatalog } from "@/lib/wiz/content/game-catalog"
import { GameDefinition } from "@/lib/wiz/definition/game-definition"

describe("コンテンツ", () => {
  it("検証後の品物・能力・道のり・候補を、取得した参照から変更できない", () => {
    const catalog = new GameCatalog(realContent())
    expect(Object.isFrozen(catalog.data)).toBe(true)
    const rope = catalog.good(contentId("rope"))!
    const hero = catalog.member(contentId("hero"))!
    const layer = catalog.layer(contentId("layer0"))!
    expect(Reflect.set(rope, "price", 1)).toBe(false)
    expect(Reflect.set(hero.stats, "maxHp", 1)).toBe(false)
    expect(Reflect.set(layer.stations[0].next, "0", "missing")).toBe(false)
    expect(Reflect.set(catalog.weaponPool("sword"), "length", 0)).toBe(false)
    expect(Reflect.set(catalog.data.goods, "length", 0)).toBe(false)
  })

  it("入力データの所有権は奪わず、後から入力を変えてもカタログへ伝わらない", () => {
    const input = structuredClone(realContent())
    const rope = input.goods.find((entry) => entry.id === contentId("rope"))!
    const catalog = new GameCatalog(input)
    const price = rope.price
    expect(Reflect.set(rope, "price", 1)).toBe(true)
    expect(catalog.good(rope.id)?.price).toBe(price)
    expect(Object.isFrozen(input)).toBe(false)
  })

  it("同じ定義から作ったプレイの購入価格を、共有カタログから変更できない", () => {
    const definition = new GameDefinition(realContent())
    const state = aState().withGold(1000).build()
    const games = [
      definition.create(undefined, state),
      definition.create(undefined, state),
    ]
    const rope = definition.catalog.good(contentId("rope"))!
    const price = rope.price!
    Reflect.set(rope, "price", price + 10)
    for (const game of games) {
      expect(
        game.send({ type: "buy", shop: contentId("tools"), good: rope.id })
      ).not.toBeInstanceOf(Error)
      expect(game.state.gold).toBe(state.gold - price)
    }
  })

  it("異なる領域の参照の誤りを、検証順にまとめて返す", () => {
    const content = realContent()
    const broken = {
      ...content,
      startingDemon: "missing",
      hero: { ...content.hero, looks: ["purple", "purple"] },
      party: content.party.map((member, index) =>
        index === 0 ? { ...member, defaultWeapon: "missing" } : member
      ),
      demons: content.demons.map((demon, index) =>
        index === 0 ? { ...demon, skills: ["missing"] } : demon
      ),
      junk: "missing",
      recruiting: { ...content.recruiting, initial: ["missing"] },
      layers: content.layers.map((layer, index) =>
        index === 0 ? { ...layer, boss: "missing" } : layer
      ),
      shops: [...content.shops, { id: "ghost", goods: ["nothing"] }],
      quests: content.quests.map((quest, index) =>
        index === 0 ? { ...quest, foe: "missing" } : quest
      ),
    }
    try {
      new GameCatalog(broken)
      expect.unreachable()
    } catch (error) {
      expect(error).toBeInstanceOf(ContentError)
      expect((error as ContentError).problems).toEqual([
        "最初の悪魔が不明",
        "主人公の外見の候補が重複している",
        `${content.party[0].id} の素の武器 missing がない`,
        `${content.demons[0].id} のワザ missing がない`,
        `${content.demons[0].id} のワザ missing に使用回数（uses）がない`,
        "ガラクタ missing は素材の品物にする",
        "最初の募集 missing がない",
        `${content.layers[0].id} のボス missing がない`,
        "店 ghost の品物 nothing がない",
        "店 ghost の nothing に値段がない",
        `依頼 ${content.quests[0].id} の敵 missing がない`,
      ])
    }
  })
})
