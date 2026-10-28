import { describe, expect, it } from "vite-plus/test"
import { gameContent } from "@/content/game-content"
import { GameCatalog } from "@/lib/wiz/content/game-catalog"
import { GameCommandError } from "@/lib/wiz/game/game-command-error"
import { WeaponRules } from "@/lib/wiz/rules/weapon-rules"
import { aContent } from "@/lib/wiz/testing/content-builder"
import { aState } from "@/lib/wiz/testing/state-builder"
import { contentId } from "@/lib/wiz/testing/content-id"
import { createTestGame } from "@/lib/wiz/testing/create-test-game"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"
import { sequenceRandom } from "@/lib/wiz/testing/sequence-random"

describe("探索で増える装備の選択肢", () => {
  const catalog = new GameCatalog(gameContent)
  const armory = contentId("armory")
  const finds = gameContent.goods.filter(
    (good) => good.kind === "weapon" && good.appraiseFrom !== undefined
  )

  it("鑑定対象のどの武器でも固有1枠を保ち、残り2枠を重複なく抽選する", () => {
    const rules = new WeaponRules(catalog)
    for (const id of catalog.appraisalPool(armory, 4)) {
      const good = catalog.good(id)!
      if (good.kind !== "weapon") continue
      const skills = rules.rollSkills(good, "SR", () => 0)
      expect(skills[0], good.name).toBe(good.skills![0])
      expect(new Set(skills).size, good.name).toBe(3)
      for (const skill of skills.slice(1))
        expect(rules.pool(good)).toContain(skill)
      expect(
        rules.rollSkills(good, "SR", () => 0.99),
        good.name
      ).not.toEqual(skills)
    }
  })

  it("各層に店売り・生産のない武器が3種類あり、鑑定して装備すると3つのワザを使える", () => {
    for (const layer of gameContent.layers) {
      const unlocked = finds.filter((good) => good.appraiseFrom === layer.no)
      expect(unlocked, layer.name).toHaveLength(3)
      expect(new Set(unlocked.map((good) => good.weaponType)).size).toBe(3)
      for (const good of unlocked) {
        expect(
          gameContent.shops.some((shop) => shop.goods.includes(good.id))
        ).toBe(false)
        expect(
          gameContent.smithy?.recipes.some((recipe) => recipe.good === good.id)
        ).toBe(false)
        const pool = catalog.appraisalPool(armory, layer.no)
        expect(pool).toContain(good.id)
        // 重みつきの抽選で、この品の幅の真ん中に当たる乱数
        const weights = pool.map((id) => catalog.appraisalWeight(id, layer.no))
        const total = weights.reduce((sum, weight) => sum + weight, 0)
        const index = pool.indexOf(good.id)
        const earlier = weights
          .slice(0, index)
          .reduce((sum, weight) => sum + weight, 0)
        const roll = (earlier + weights[index] / 2) / total
        const game = createTestGame({
          state: aState().withReached(layer.no).withItem("junk", 1).build(),
          random: sequenceRandom([roll, 0, 0]),
        })
        const gold = game.state.gold
        const events = eventsOrThrow(
          game.send({ type: "appraise", shop: armory })
        )
        expect(events[0]).toMatchObject({
          type: "appraised",
          good: good.id,
          rarity: "N",
        })
        expect(game.queries.junk(game.state).count).toBe(0)
        expect(game.state.gold).toBe(gold)
        const gear = game.state.gear.find((entry) => entry.good === good.id)!
        expect(gear.weapon?.skills).toEqual(good.skills)
        const member = game.state.party[1]
        eventsOrThrow(game.send({ type: "equip", gear: gear.id, member }))
        expect(
          game.state.gear.find((entry) => entry.id === gear.id)?.owner
        ).toBe(member)
        expect(game.queries.problems(game.state)).toEqual([])
        const before = game.state
        expect(
          game.send({ type: "buy", shop: armory, good: good.id })
        ).toBeInstanceOf(GameCommandError)
        expect(game.state).toBe(before)
      }
    }
  })

  it("鑑定の武器は到達した層の一つ前から一つ先の段まで。一つ先は出にくい", () => {
    const tierOf = (id: string) => {
      const good = catalog.good(id)!
      return good.appraiseFrom ?? good.unlock ?? 0
    }
    for (const layer of gameContent.layers) {
      const pool = catalog.appraisalPool(armory, layer.no)
      for (const good of finds)
        expect(pool.includes(good.id), `${layer.no}層: ${good.name}`).toBe(
          good.appraiseFrom! <= layer.no && good.appraiseFrom! >= layer.no - 1
        )
      for (const id of pool) {
        const good = catalog.good(id)!
        const tier = tierOf(id)
        expect(tier).toBeLessThanOrEqual(layer.no + 1)
        if (tier < layer.no - 1) {
          expect(good.kind).toBe("armor")
          expect(good.appraisalRetentionWeight).toBe(0.15)
          expect(catalog.appraisalWeight(id, layer.no)).toBe(0.15)
          continue
        }
        expect(tier).toBeGreaterThanOrEqual(layer.no - 1)
        const weight = ["robe", "burial-robe", "gearweave-robe"].some(
          (slug) => contentId(slug) === id
        )
          ? 0.2
          : 1
        expect(catalog.appraisalWeight(id, layer.no)).toBe(
          tier > layer.no
            ? weight * gameContent.balance.appraisal.ahead
            : weight
        )
      }
    }
    // 0層で最上段の武器は出ない。1層の店の武器は掘り出し物として出る
    expect(catalog.appraisalPool(armory, 0)).not.toContain(
      contentId("seal-gun")
    )
    expect(catalog.appraisalPool(armory, 0)).toContain(contentId("bone-gun"))
  })

  it("候補がすべて未解放なら鑑定を表示せず、操作を拒否してガラクタを残す", () => {
    const content = aContent()
      .withShop("armory", { appraise: ["censer-gun"] })
      .build()
    let draws = 0
    const game = createTestGame({
      content,
      state: aState().withReached(0).withItem("junk", 1).build(),
      random: () => {
        draws++
        return 0
      },
    })
    expect(game.queries.shop(game.state, armory)?.appraise).toBe(false)
    const before = game.state
    expect(game.send({ type: "appraise", shop: armory })).toMatchObject({
      code: "UNAVAILABLE",
    })
    expect(game.state).toBe(before)
    expect(draws).toBe(0)
  })

  it("存在しない層を鑑定の解放条件にしたデータは拒否する", () => {
    const content = aContent()
      .withGood("crystal-pickaxe", { appraiseFrom: 99 })
      .build()
    expect(() => new GameCatalog(content)).toThrow("鑑定の到達層 99 がない")
  })
  it("個別の鑑定重みも、一つ先の段ではaheadを掛ける", () => {
    const content = aContent()
      .withGood("sword", { appraisalWeight: 2, unlock: 1 })
      .build()
    const weighted = new GameCatalog(content)
    expect(weighted.appraisalWeight(contentId("sword"), 1)).toBe(2)
    expect(weighted.appraisalWeight(contentId("sword"), 0)).toBe(
      2 * content.balance.appraisal.ahead
    )
  })
  it.each([0, -1])("鑑定重み%sを拒否する", (appraisalWeight) => {
    const content = aContent().withGood("sword", { appraisalWeight }).build()
    expect(() => new GameCatalog(content)).toThrow()
  })

  it("各層に耐久と速さ・技量を選べる防具があり、その層から購入できる", () => {
    for (const layer of gameContent.layers.filter((entry) => entry.no > 0)) {
      const armor = gameContent.goods.filter(
        (good) => good.kind === "armor" && good.unlock === layer.no
      )
      expect(armor, layer.name).toHaveLength(3)
      const fast = armor.find((good) => (good.bonus?.spd ?? 0) > 0)!
      const skilled = armor.find((good) => (good.bonus?.tec ?? 0) > 0)!
      expect(fast).toBeDefined()
      expect(skilled).toBeDefined()
      expect(fast.durability).toBeLessThan(
        Math.max(...armor.map((good) => good.durability!))
      )
      for (const good of armor) {
        const locked = createTestGame({
          state: aState()
            .withReached(layer.no - 1)
            .withGold(10000)
            .build(),
        })
        const before = locked.state
        expect(
          locked.queries
            .shop(locked.state, armory)
            ?.goods.some((entry) => entry.id === good.id)
        ).toBe(false)
        expect(
          locked.send({ type: "buy", shop: armory, good: good.id })
        ).toMatchObject({ code: "LOCKED" })
        expect(locked.state).toBe(before)
        // 魔術系の防具はマユしか着られないので、控えに雇っておく
        const game = createTestGame({
          state: aState()
            .withReached(layer.no)
            .withGold(10000)
            .withJoined("mayu")
            .build(),
        })
        expect(
          game.queries
            .shop(game.state, armory)
            ?.goods.some((entry) => entry.id === good.id)
        ).toBe(true)
        eventsOrThrow(game.send({ type: "buy", shop: armory, good: good.id }))
        const gear = game.state.gear.find((entry) => entry.good === good.id)!
        eventsOrThrow(
          game.send({
            type: "equip",
            gear: gear.id,
            member: game.state.members.find((member) =>
              catalog.canEquip(member.id, good.id)
            )!.id,
          })
        )
        expect(game.queries.problems(game.state)).toEqual([])
      }
    }
  })
})
