import { describe, expect, it } from "vite-plus/test"
import { gameContent } from "@/lib/content/game-content"
import { GameCatalog } from "@/lib/wiz"
import {
  aState,
  contentId,
  createTestGame,
  eventsOrThrow,
  sequenceRandom,
} from "@/lib/wiz/testing"

const catalog = new GameCatalog(gameContent)
const armory = contentId("armory")
// 魔術系の防具と最大HPが増える防具の両方を着られる回復役として、募集のシオンを出撃させる。
const withSion = () => aState().withJoined("sion", { replacing: "mort" })
/** ローブ系を着られるのはマユなので、控えに雇っておく。 */
const withMayu = () => aState().withJoined("mayu")
const finds = gameContent.goods.filter(
  (good) => good.kind === "armor" && good.appraiseFrom !== undefined
)

describe("探索限定防具", () => {
  it.each([
    [0, "robe"],
    [1, "burial-robe"],
    [2, "gearweave-robe"],
  ] as const)(
    "%s層の魔術系防具%sを通常鑑定で入手し、装備できる",
    (reached, slug) => {
      const id = contentId(slug)
      const pool = catalog.appraisalPool(armory, reached)
      const index = pool.indexOf(id)
      expect(index).toBeGreaterThanOrEqual(0)
      const weights = pool.map((id) => catalog.appraisalWeight(id, reached))
      const total = weights.reduce((sum, weight) => sum + weight, 0)
      const roll =
        (weights.slice(0, index).reduce((sum, weight) => sum + weight, 0) +
          weights[index] / 2) /
        total
      const game = createTestGame({
        state: withSion().withReached(reached).withItem("junk", 1).build(),
        random: sequenceRandom([roll, 0, 0]),
      })
      const gold = game.state.gold
      expect(
        eventsOrThrow(game.send({ type: "appraise", shop: armory }))[0]
      ).toMatchObject({ type: "appraised", good: id })
      const gear = game.state.gear.find(
        (gear) => gear.good === id && !gear.owner
      )!
      expect(gear).toBeDefined()
      expect(game.queries.junk(game.state).count).toBe(0)
      expect(game.state.gold).toBe(gold)
      for (const job of ["黒魔術師", "魔術師", "影絵師"]) {
        const member = [
          ...gameContent.party,
          ...gameContent.recruits.map((entry) => entry.member),
        ].find((member) => !member.unique && member.job === job)!
        expect(catalog.canEquip(member.id, id), job).toBe(true)
      }
      eventsOrThrow(
        game.send({ type: "equip", gear: gear.id, member: contentId("sion") })
      )
      expect(game.state.gear.find((entry) => entry.id === gear.id)?.owner).toBe(
        contentId("sion")
      )
      expect(game.queries.problems(game.state)).toEqual([])
    }
  )
  it.each(["full", "hurt", "dead"] as const)(
    "着替え比較は%sの現在HPを実際の装備処理と一致させ、上限が増えても回復させない",
    (condition) => {
      const initial = withSion().build()
      const hero = initial.members.find(
        (member) => member.id === contentId("sion")
      )!
      const original = initial.gear.find(
        (gear) =>
          gear.owner === hero.id && catalog.good(gear.good)?.kind === "armor"
      )!
      const bonus = finds.find(
        (good) =>
          catalog.canEquip(hero.id, good.id) && (good.bonus?.maxHp ?? 0) > 0
      )!
      const game = createTestGame({
        state: withSion()
          .withGear([
            ...initial.gear,
            { ...original, id: "hp-bonus-armor", good: bonus.id, owner: null },
          ])
          .build(),
      })
      eventsOrThrow(
        game.send({ type: "equip", gear: "hp-bonus-armor", member: hero.id })
      )
      const maximum = game.queries.member(game.state, hero.id)!.maxHp
      const hp = condition === "full" ? maximum : condition === "hurt" ? 1 : 0
      const saved = game.save()
      expect(
        game.restore({
          ...saved,
          snapshot: {
            ...saved.snapshot,
            members: saved.snapshot.members.map((member) =>
              member.id === hero.id ? { ...member, hp } : member
            ),
          },
        })
      ).toBeUndefined()
      const before = game.state
      const comparison = game.queries.armorComparison(
        before,
        hero.id,
        original.id
      )!
      expect(comparison.before.hp).toBe(hp)
      if (condition === "full") expect(comparison.after.hp).toBeLessThan(hp)
      else expect(comparison.after.hp).toBe(hp)
      expect(game.state).toBe(before)
      eventsOrThrow(
        game.send({ type: "equip", gear: original.id, member: hero.id })
      )
      expect(game.queries.member(game.state, hero.id)!.hp).toBe(
        comparison.after.hp
      )
      const larger = game.queries.armorComparison(
        game.state,
        hero.id,
        "hp-bonus-armor"
      )!
      expect(larger.after.hp).toBe(larger.before.hp)
      expect(larger.after.maxHp).toBeGreaterThan(larger.before.maxHp)
      eventsOrThrow(
        game.send({ type: "equip", gear: "hp-bonus-armor", member: hero.id })
      )
      expect(game.queries.member(game.state, hero.id)!.hp).toBe(larger.after.hp)
    }
  )
  it.each(["full", "hurt", "dead"] as const)(
    "防具の付け替えで渡す仲間の%sのHPと能力も実際の結果に一致する",
    (condition) => {
      const initial = aState().build()
      const bonus = finds.find(
        (good) =>
          (good.bonus?.maxHp ?? 0) > 0 &&
          initial.party.filter((id) => catalog.canEquip(id, good.id)).length >=
            2
      )!
      const [owner, recipient] = initial.party.filter((id) =>
        catalog.canEquip(id, bonus.id)
      )
      const original = initial.gear.find(
        (gear) =>
          gear.owner === owner && catalog.good(gear.good)?.kind === "armor"
      )!
      const game = createTestGame({
        state: aState()
          .withGear([
            ...initial.gear,
            { ...original, id: "transfer-armor", good: bonus.id, owner: null },
          ])
          .build(),
      })
      eventsOrThrow(
        game.send({ type: "equip", gear: "transfer-armor", member: owner })
      )
      const saved = game.save()
      const maximum = game.queries.member(game.state, owner)!.maxHp
      const hp = condition === "full" ? maximum : condition === "hurt" ? 1 : 0
      expect(
        game.restore({
          ...saved,
          snapshot: {
            ...saved.snapshot,
            members: saved.snapshot.members.map((member) =>
              member.id === owner ? { ...member, hp } : member
            ),
          },
        })
      ).toBeUndefined()
      const before = game.state
      const comparison = game.queries.armorComparison(
        before,
        recipient,
        "transfer-armor"
      )!
      const donor = comparison.previousOwner!
      expect(donor.id).toBe(owner)
      expect(donor.before.hp).toBe(hp)
      expect(donor.after.maxHp).toBeLessThan(donor.before.maxHp)
      expect(donor.after.hp).toBe(condition === "full" ? donor.after.maxHp : hp)
      expect(donor.after.durability).toBe(0)
      expect(game.state).toBe(before)
      eventsOrThrow(
        game.send({ type: "equip", gear: "transfer-armor", member: recipient })
      )
      const actual = game.queries.member(game.state, owner)!
      for (const key of ["hp", "maxHp", "str", "tec", "spd"] as const)
        expect(actual[key]).toBe(donor.after[key])
      expect(
        game.state.gear.some(
          (gear) =>
            gear.owner === owner && catalog.good(gear.good)?.kind === "armor"
        )
      ).toBe(false)
      expect(game.queries.member(game.state, recipient)!.hp).toBe(
        comparison.after.hp
      )
      expect(
        game.queries.armorComparison(game.state, owner, original.id)!
          .previousOwner
      ).toBeNull()
    }
  )
  it.each(["full", "hurt", "dead"] as const)(
    "防具を外す前の%sのHP予測が実際の処理に一致する",
    (condition) => {
      const initial = withSion().withEquipped("alda", "greatsword").build()
      const owner = contentId("sion")
      const original = initial.gear.find(
        (gear) =>
          gear.owner === owner && catalog.good(gear.good)?.kind === "armor"
      )!
      const bonus = finds.find(
        (good) =>
          catalog.canEquip(owner, good.id) && (good.bonus?.maxHp ?? 0) > 0
      )!
      const game = createTestGame({
        state: withSion()
          .withGear([
            ...initial.gear,
            {
              ...original,
              id: "remove-bonus-armor",
              good: bonus.id,
              owner: null,
            },
          ])
          .build(),
      })
      eventsOrThrow(
        game.send({ type: "equip", gear: "remove-bonus-armor", member: owner })
      )
      const saved = game.save()
      const maximum = game.queries.member(game.state, owner)!.maxHp
      const hp = condition === "full" ? maximum : condition === "hurt" ? 1 : 0
      expect(
        game.restore({
          ...saved,
          snapshot: {
            ...saved.snapshot,
            members: saved.snapshot.members.map((member) =>
              member.id === owner ? { ...member, hp } : member
            ),
          },
        })
      ).toBeUndefined()
      const before = game.state
      const comparison = game.queries.armorRemovalComparison(
        before,
        "remove-bonus-armor"
      )!
      expect(comparison.before.hp).toBe(hp)
      expect(comparison.after.maxHp).toBeLessThan(maximum)
      expect(comparison.after.hp).toBe(
        condition === "full" ? comparison.after.maxHp : hp
      )
      expect(comparison.after.durability).toBe(0)
      expect(comparison.after.maxDurability).toBe(0)
      expect(game.state).toBe(before)
      expect(
        game.queries.armorRemovalComparison(before, original.id)
      ).toBeNull()
      expect(game.queries.armorRemovalComparison(before, "missing")).toBeNull()
      const weapon = game.queries
        .gear(before)
        .find((gear) => gear.weapon !== null)!
      expect(
        game.queries.armorRemovalComparison(before, weapon.gear)
      ).toBeNull()
      eventsOrThrow(game.send({ type: "unequip", gear: "remove-bonus-armor" }))
      const actual = game.queries.member(game.state, owner)!
      for (const key of ["hp", "maxHp", "str", "tec", "spd"] as const)
        expect(actual[key]).toBe(comparison.after[key])
      expect(
        game.queries.armorRemovalComparison(game.state, "remove-bonus-armor")
      ).toBeNull()
    }
  )
  it("乗り場は到達した層の防具だけを案内し、品物や未到達の名前を増やさない", () => {
    for (const reached of [0, 1, 4]) {
      const game = createTestGame({
        state: aState().withReached(reached).build(),
      })
      const before = game.state
      const saved = game.save()
      const destinations = game.queries.destinations(before)
      const candidates = game.queries.shop(before, armory)!.appraisalArmor
      expect(
        destinations.flatMap((entry) => entry.armorFinds).map((good) => good.id)
      ).toEqual(candidates.map((good) => good.id))
      for (const destination of destinations) {
        if (!destination.open) {
          expect(destination.name).toBe("？？？")
          expect(destination.armorFinds).toEqual([])
        }
        for (const good of destination.armorFinds) {
          expect(catalog.good(good.id)!.appraiseFrom).toBe(destination.no)
          expect(good.own).toBe(0)
          expect(good.stat).toBeTruthy()
        }
      }
      expect(game.state).toBe(before)
      expect(game.save()).toEqual(saved)
    }
  })
  it.each(finds)(
    "$name の着替え比較は強化・消耗を含み、実際の装備後と一致する",
    (good) => {
      const initial = withMayu().build()
      const member = initial.members.find((entry) =>
        catalog.canEquip(entry.id, good.id)
      )!
      const game = createTestGame({
        state: withMayu()
          .withGear([
            ...initial.gear,
            {
              id: "comparison-armor",
              good: good.id,
              owner: null,
              plus: 2,
              wear: 3,
              progress: 0,
              weapon: null,
            },
          ])
          .build(),
      })
      const before = game.state
      const saved = game.save()
      const option = game.queries
        .equipOptions(before, member.id)
        .find((entry) => entry.gear === "comparison-armor")!
      const comparison = game.queries.armorComparison(
        before,
        member.id,
        option.gear
      )!
      expect(comparison).not.toBeNull()
      const shownBefore = game.queries.member(before, member.id)!
      for (const key of ["hp", "maxHp", "str", "tec", "spd"] as const)
        expect(comparison.before[key]).toBe(shownBefore[key])
      expect(comparison.before.durability).toBe(
        shownBefore.armor?.durability ?? 0
      )
      expect(comparison.after.maxDurability - comparison.after.durability).toBe(
        3
      )
      expect(game.state).toBe(before)
      expect(game.save()).toEqual(saved)
      eventsOrThrow(
        game.send({ type: "equip", gear: option.gear, member: member.id })
      )
      const after = game.queries.member(game.state, member.id)!
      for (const key of ["hp", "maxHp", "str", "tec", "spd"] as const)
        expect(comparison.after[key]).toBe(after[key])
      expect(comparison.after.durability).toBe(after.armor!.durability)
      expect(comparison.after.maxDurability).toBe(after.armor!.maxDurability)
      expect(game.queries.problems(game.state)).toEqual([])
    }
  )

  it("各層に1つ、店と生産では手に入らない防具がある", () => {
    for (const layer of gameContent.layers) {
      const armor = finds.filter((good) => good.appraiseFrom === layer.no)
      expect(armor, layer.name).toHaveLength(1)
      expect(Object.keys(armor[0].bonus!)).toHaveLength(2)
      expect(
        gameContent.shops.some((shop) => shop.goods.includes(armor[0].id))
      ).toBe(false)
      expect(
        gameContent.smithy!.recipes.some(
          (recipe) => recipe.good === armor[0].id
        )
      ).toBe(false)
      for (const stage of gameContent.layers)
        expect(
          catalog.appraisalPool(armory, stage.no).includes(armor[0].id)
        ).toBe(stage.no >= layer.no)
    }
  })

  it("鑑定画面の候補は最高到達層に追従し、未解禁を表示せず、収集用の古い防具を保持する", () => {
    for (const reached of [0, 1, 2, 3, 4]) {
      const game = createTestGame({
        state: aState().withReached(reached).build(),
      })
      const candidates = game.queries.shop(game.state, armory)!.appraisalArmor
      expect(candidates.map((entry) => entry.id)).toEqual(
        finds
          .filter((good) => reached >= good.appraiseFrom!)
          .map((good) => good.id)
      )
      expect(candidates.every((entry) => entry.desc && entry.stat)).toBe(true)
    }
  })

  it("古い収集防具は低い重みで残し、古い店売り武器は混ぜない", () => {
    const oldArmor = finds.find((good) => good.appraiseFrom === 0)!
    expect(catalog.appraisalPool(armory, 4)).toContain(oldArmor.id)
    expect(catalog.appraisalWeight(oldArmor.id, 4)).toBe(
      oldArmor.appraisalRetentionWeight
    )
    expect(catalog.appraisalWeight(oldArmor.id, 0)).toBe(1)
    expect(catalog.appraisalPool(armory, 4)).not.toContain(
      contentId("greatsword")
    )
  })

  it.each(
    finds.flatMap((good) =>
      [...new Set([good.appraiseFrom!, 4])].map(
        (reached) => [good.name, good.id, reached] as const
      )
    )
  )("%s を鑑定し、装備・保存・強化できる", (_name, id, reached) => {
    const pool = catalog.appraisalPool(armory, reached)
    const weights = pool.map((entry) => catalog.appraisalWeight(entry, reached))
    const total = weights.reduce((sum, weight) => sum + weight, 0)
    const index = pool.indexOf(id)
    const roll =
      (weights.slice(0, index).reduce((sum, weight) => sum + weight, 0) +
        weights[index] / 2) /
      total
    const good = catalog.good(id)!
    const game = createTestGame({
      state: withMayu()
        .withReached(reached)
        .withGold(10000)
        .withItem("junk", 1)
        .withItem("bone", 10)
        .build(),
      random: roll,
    })
    const member = game.state.members.find((entry) =>
      catalog.canEquip(entry.id, id)
    )!
    const owned = () => {
      const shopCount = game.queries
        .shop(game.state, armory)!
        .appraisalArmor.find((entry) => entry.id === id)!.own
      expect(
        game.queries
          .destinations(game.state)
          .flatMap((entry) => entry.armorFinds)
          .find((entry) => entry.id === id)!.own
      ).toBe(shopCount)
      return shopCount
    }
    expect(owned()).toBe(0)
    eventsOrThrow(game.send({ type: "appraise", shop: armory }))
    expect(owned()).toBe(1)
    const gear = game.state.gear.find((entry) => entry.good === id)!
    expect(gear.weapon).toBeNull()
    eventsOrThrow(
      game.send({ type: "equip", gear: gear.id, member: member.id })
    )
    expect(game.state.gear.find((entry) => entry.id === gear.id)!.owner).toBe(
      member.id
    )
    expect(game.restore(game.save())).toBeUndefined()
    expect(owned()).toBe(1)
    expect(game.state.gear.find((entry) => entry.id === gear.id)!.good).toBe(id)
    eventsOrThrow(game.send({ type: "upgrade", gear: gear.id }))
    expect(game.state.gear.find((entry) => entry.id === gear.id)!.plus).toBe(1)
    expect(game.queries.problems(game.state)).toEqual([])
    const before = game.state
    expect(
      game.send({ type: "buy", shop: armory, good: good.id })
    ).toMatchObject({ code: "UNKNOWN" })
    expect(game.state).toBe(before)
    eventsOrThrow(game.send({ type: "unequip", gear: gear.id }))
    eventsOrThrow(game.send({ type: "sell", gear: gear.id }))
    expect(owned()).toBe(0)
  })
})
