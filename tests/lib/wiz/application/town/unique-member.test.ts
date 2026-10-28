import { describe, expect, it } from "vite-plus/test"
import { GameStateBuilder } from "@/lib/wiz/testing/state-builder"
import { contentId } from "@/lib/wiz/testing/content-id"
import { goodBySlug } from "@/lib/wiz/testing/good-by-slug"
import { memberBySlug } from "@/lib/wiz/testing/member-by-slug"
import { realContent } from "@/lib/wiz/testing/real-content"
import { createTestPlay } from "@/lib/wiz/testing/create-test-play"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"
import { startedState } from "@/lib/wiz/testing/started-state"
import { GameCommandError } from "@/lib/wiz/game/game-command-error"
import { WizWorldEnvironment } from "@/lib/wiz/core/world/world"

const idOf = (slug: string) => memberBySlug(slug).id

describe("ユニークの仲間", () => {
  const alda = idOf("alda")
  const mort = idOf("mort")
  const husky = idOf("husky")
  const ironGloves = goodBySlug("iron-gloves")
  const { progressPerStep, gold: reforgeGold } = realContent().balance.unique
  /** ハスキー（SR・固有の武器と固定の防具）を雇い、出撃メンバーへ入れる。 */
  function hireHusky(gold = 2000) {
    const { definition } = createTestPlay()
    const base = startedState(definition)
    const game = definition.create(
      WizWorldEnvironment.create({
        random: () => 0.5,
        now: () => 0,
        nextId: (() => {
          let serial = 0
          return () => `id-${++serial}`
        })(),
      }),
      GameStateBuilder.from(base, definition.catalog)
        .withGold(gold)
        .withBoard(["sr-husky"])
        .withItem("bone", 9)
        .build()
    )
    eventsOrThrow(
      game.send({ type: "recruit", recruit: contentId("sr-husky") })
    )
    eventsOrThrow(game.send({ type: "swap", out: mort, in: husky }))
    return game
  }

  it("[feature:W017] ユニークの仲間には装備を着けられない", () => {
    const game = hireHusky()
    eventsOrThrow(
      game.send({
        type: "buy",
        shop: contentId("armory"),
        good: contentId("greatsword"),
      })
    )
    const bought = game.state.gear.at(-1)!
    expect(
      (
        game.send({
          type: "equip",
          gear: bought.id,
          member: husky,
        }) as GameCommandError
      ).code
    ).toBe("FIXED_GEAR")
    // 固有の武器をほかの仲間へ移すこともできない
    const sword = game.state.gear.find((gear) => gear.good === ironGloves.id)!
    expect(
      (
        game.send({
          type: "equip",
          gear: sword.id,
          member: alda,
        }) as GameCommandError
      ).code
    ).toBe("FIXED_GEAR")
    // ハスキーは武器も防具も候補を持たず、理由が出る
    expect(game.queries.equipOptions(game.state, husky)).toEqual([])
    expect(game.queries.gearLock(husky)).toContain("ユニークの仲間")
    expect(game.queries.gearLock(alda)).toBeNull()
  })

  it("[feature:W018] ユニークの仲間の装備は外せない", () => {
    const game = hireHusky()
    const sword = game.state.gear.find((gear) => gear.good === ironGloves.id)!
    expect(
      (game.send({ type: "unequip", gear: sword.id }) as GameCommandError).code
    ).toBe("FIXED_GEAR")
    const armor = game.state.gear.find(
      (gear) => gear.owner === husky && gear.id !== sword.id
    )!
    expect(
      (game.send({ type: "unequip", gear: armor.id }) as GameCommandError).code
    ).toBe("FIXED_GEAR")
    expect(game.queries.member(game.state, husky)?.weapon?.name).toBe(
      ironGloves.name
    )
    expect(game.queries.member(game.state, husky)?.unique).toBe(true)
    expect(game.queries.member(game.state, husky)?.growthTypeName).toBe("普通")
  })

  it("[feature:W017] 固定装備の仲間（SR ハスキー）は防具も変えられない", () => {
    const game = hireHusky()
    eventsOrThrow(
      game.send({
        type: "buy",
        shop: contentId("armory"),
        good: contentId("mail"),
      })
    )
    const mail = game.state.gear.at(-1)!
    const before = game.state
    expect(
      (
        game.send({
          type: "equip",
          gear: mail.id,
          member: husky,
        }) as GameCommandError
      ).code
    ).toBe("FIXED_GEAR")
    const armor = game.queries.member(game.state, husky)!.armor!
    expect(
      (game.send({ type: "unequip", gear: armor.gear }) as GameCommandError)
        .code
    ).toBe("FIXED_GEAR")
    expect(
      (
        game.send({
          type: "equip",
          gear: armor.gear,
          member: alda,
        }) as GameCommandError
      ).code
    ).toBe("FIXED_GEAR")
    expect(game.state).toBe(before)
    expect(game.queries.gearLock(husky)).toContain("装備は変えられない")
    expect(game.queries.member(game.state, husky)?.fixedArmor).toBe(true)
  })

  it("[feature:W026] 固有の武器は拾った武器を素材にして鍛え直す", () => {
    const game = hireHusky()
    const sword = game.state.gear.find((gear) => gear.good === ironGloves.id)!
    // 店の武器はレア度 N。1振りで得る手応えは materialProgress の N
    const gained = realContent().balance.unique.materialProgress.N
    const needed = Math.ceil(progressPerStep / gained)
    const buy = () => {
      eventsOrThrow(
        game.send({
          type: "buy",
          shop: contentId("armory"),
          good: contentId("dagger"),
        })
      )
      return game.state.gear.at(-1)!
    }
    const first = buy()
    const gold = game.state.gold
    const events = eventsOrThrow(
      game.send({ type: "reforge", gear: sword.id, material: first.id })
    )
    expect(events).toEqual([
      {
        type: "reforged",
        gear: sword.id,
        material: first.id,
        gained,
        plus: 0,
        progress: gained,
      },
    ])
    // 素材は消え、お金も減る
    expect(game.state.gear.some((gear) => gear.id === first.id)).toBe(false)
    expect(game.state.gold).toBe(gold - reforgeGold)
    // progressPerStep だけたまると一段上がる
    for (let step = 2; step < needed; step++)
      eventsOrThrow(
        game.send({ type: "reforge", gear: sword.id, material: buy().id })
      )
    const last = buy()
    const stepped = eventsOrThrow(
      game.send({ type: "reforge", gear: sword.id, material: last.id })
    )
    expect(stepped).toContainEqual({
      type: "reforged",
      gear: sword.id,
      material: last.id,
      gained,
      plus: 1,
      progress: gained * needed - progressPerStep,
    })
    expect(game.state.gear.find((gear) => gear.id === sword.id)?.plus).toBe(1)
    // 戦闘・持ち物・鍛え直しで、固定武器の強化量が一致する
    const power = Math.round(ironGloves.power! + (ironGloves.powerPerPlus ?? 1))
    expect(game.queries.member(game.state, husky)?.weapon?.power).toBe(power)
    expect(
      game.queries.gear(game.state).find((entry) => entry.gear === sword.id)
        ?.weapon?.power
    ).toBe(power)
    expect(
      game.queries.reforges(game.state).find((entry) => entry.gear === sword.id)
        ?.stat
    ).toContain(`攻撃力 ${power}`)
    const saved = game.save()
    const restored = hireHusky()
    expect(restored.restore(saved)).toBeUndefined()
    expect(restored.queries.member(restored.state, husky)?.weapon).toEqual(
      game.queries.member(game.state, husky)?.weapon
    )
  })

  it("[feature:W026] 防具も変えられない仲間は、鍛え直しで段が上がると固有の防具の最大の耐久も伸びる", () => {
    const game = hireHusky()
    const sword = game.state.gear.find(
      (gear) => gear.good === goodBySlug("iron-gloves").id
    )!
    const before = game.queries.member(game.state, husky)!.armor!
    const gained = realContent().balance.unique.materialProgress.N
    const needed = Math.ceil(progressPerStep / gained)
    const buy = () => {
      eventsOrThrow(
        game.send({
          type: "buy",
          shop: contentId("armory"),
          good: contentId("dagger"),
        })
      )
      return game.state.gear.at(-1)!
    }
    // 手応えが progressPerStep たまるまでは防具も変わらない
    for (let step = 1; step < needed; step++) {
      eventsOrThrow(
        game.send({ type: "reforge", gear: sword.id, material: buy().id })
      )
      expect(game.queries.member(game.state, husky)!.armor!.maxDurability).toBe(
        before.maxDurability
      )
    }
    eventsOrThrow(
      game.send({ type: "reforge", gear: sword.id, material: buy().id })
    )
    const after = game.queries.member(game.state, husky)!.armor!
    // 段が1つ上がった分だけ最大の耐久が増える（durabilityPerPlus）
    const per = realContent().balance.armor.durabilityPerPlus
    expect(after.maxDurability).toBe(before.maxDurability + per)
    // 減っていない耐久はそのまま増える
    expect(after.durability).toBe(before.durability + per)
  })

  it.each([1, 2])(
    "[feature:W026] 防具を先に%d段強化しても、鍛え直しの上限で保存・復元できる",
    (upgrades) => {
      const game = hireHusky(50000)
      const sword = game.state.gear.find((gear) => gear.good === ironGloves.id)!
      const armorId = game.queries.member(game.state, husky)!.armor!.gear
      for (let index = 0; index < upgrades; index++) {
        expect(
          game.queries
            .smithy(game.state)!
            .upgrades.find((entry) => entry.gear === armorId)?.ready
        ).toBe(true)
        eventsOrThrow(game.send({ type: "upgrade", gear: armorId }))
      }
      const {
        maxPlus,
        progressPerStep: need,
        materialProgress,
        gold,
      } = realContent().balance.unique
      const count = Math.ceil((maxPlus * need) / materialProgress.N)
      for (let index = 0; index < count; index++) {
        eventsOrThrow(
          game.send({
            type: "buy",
            shop: contentId("armory"),
            good: contentId("dagger"),
          })
        )
        const material = game.state.gear.at(-1)!
        const before = game.state
        eventsOrThrow(
          game.send({ type: "reforge", gear: sword.id, material: material.id })
        )
        expect(game.state.gold).toBe(before.gold - gold)
        expect(game.state.gear.some((entry) => entry.id === material.id)).toBe(
          false
        )
        const weaponPlus = game.state.gear.find(
          (gear) => gear.id === sword.id
        )!.plus
        expect(game.state.gear.find((gear) => gear.id === armorId)?.plus).toBe(
          Math.min(maxPlus, upgrades + weaponPlus)
        )
      }
      const saved = game.save()
      expect(game.restore(saved)).toBeUndefined()
      expect(game.save()).toEqual(saved)
      expect(game.state.gear.find((gear) => gear.id === sword.id)?.plus).toBe(
        maxPlus
      )
      expect(game.state.gear.find((gear) => gear.id === armorId)?.plus).toBe(
        maxPlus
      )
      const before = game.state
      eventsOrThrow(
        game.send({
          type: "buy",
          shop: contentId("armory"),
          good: contentId("dagger"),
        })
      )
      const material = game.state.gear.at(-1)!
      const full = game.save()
      expect(
        (
          game.send({
            type: "reforge",
            gear: sword.id,
            material: material.id,
          }) as GameCommandError
        ).code
      ).toBe("MAX")
      expect(game.save()).toEqual(full)
      expect(game.queries.member(game.state, husky)!.armor!.maxDurability).toBe(
        game.queries.member(before, husky)!.armor!.maxDurability
      )
    }
  )

  it("[feature:W026] 着けている武器・ユニークでない武器は拒否する", () => {
    const game = hireHusky()
    const sword = game.state.gear.find((gear) => gear.good === ironGloves.id)!
    eventsOrThrow(
      game.send({
        type: "buy",
        shop: contentId("armory"),
        good: contentId("greatsword"),
      })
    )
    const worn = game.state.gear.at(-1)!
    eventsOrThrow(game.send({ type: "equip", gear: worn.id, member: alda }))
    expect(
      (
        game.send({
          type: "reforge",
          gear: sword.id,
          material: worn.id,
        }) as GameCommandError
      ).code
    ).toBe("UNAVAILABLE")
    eventsOrThrow(
      game.send({
        type: "buy",
        shop: contentId("armory"),
        good: contentId("dagger"),
      })
    )
    const material = game.state.gear.at(-1)!
    expect(
      (
        game.send({
          type: "reforge",
          gear: worn.id,
          material: material.id,
        }) as GameCommandError
      ).code
    ).toBe("NOT_UNIQUE")
    // ふつうの強化ではユニークの固有の武器を扱わない
    expect(
      (game.send({ type: "upgrade", gear: sword.id }) as GameCommandError).code
    ).toBe("FIXED_GEAR")
    expect(
      game.queries.smithy(game.state)?.upgrades.some((e) => e.gear === sword.id)
    ).toBe(false)
    expect(
      game.queries.reforges(game.state).map((entry) => entry.gear)
    ).toEqual([sword.id])
  })
})
