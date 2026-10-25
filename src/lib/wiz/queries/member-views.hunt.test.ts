import { describe, expect, it } from "vite-plus/test"
import type { GameState } from "@/lib/wiz"
import {
  aState,
  contentId,
  createTestGame,
  eventsOrThrow,
  goodBySlug,
  memberBySlug,
  realContent,
  sequentialIds,
} from "@/lib/wiz/testing"

const weapons = ["greatsword", "sword", "axe", "gun", "dagger"] as const
const armors = ["coat", "leather", "mail", "robe"] as const
/** 出撃の3人と、控えに雇ったマユ（ローブを着られる仲間）。 */
const partySlugs = ["hero", "alda", "mayu", "mort"] as const
const idOf = (slug: string) => memberBySlug(slug).id

function richGame(
  state: GameState = aState().withGold(5000).withJoined("mayu").build()
) {
  return createTestGame({ state, ids: sequentialIds("bought") })
}

describe("仲間の見え方（hunt）", () => {
  it("登録した主人公の名前が持ち主・修理・持ち替え案内と保存復元に反映される", () => {
    const game = richGame(aState().withHero("コハク").withGold(5000).build())
    const hero = idOf("hero")
    eventsOrThrow(
      game.send({
        type: "buy",
        shop: contentId("armory"),
        good: contentId("dagger"),
      })
    )
    eventsOrThrow(
      game.send({
        type: "equip",
        member: hero,
        gear: game.state.gear.at(-1)!.id,
      })
    )
    const verify = (current: typeof game) => {
      expect(
        current.queries
          .gear(current.state)
          .find((entry) => entry.ownerId === hero)?.owner
      ).toBe("コハク")
      expect(
        current.queries
          .repairs(current.state)
          .rows.find((entry) => entry.member === hero)?.memberName
      ).toBeUndefined() // 主人公は防具を着けず、修理対象にならない
      const upgrade = realContent()
        .goods.filter((good) => good.kind === "weapon")
        .flatMap((good) =>
          current.queries.upgradesForGood(current.state, good.id)
        )
        .find((entry) => entry.member === hero)
      expect(upgrade?.name).toBe("コハク")
      expect(
        current.queries
          .repairs(current.state)
          .rows.find((entry) => entry.member === idOf("alda"))?.memberName
      ).toBe(memberBySlug("alda").name)
    }
    verify(game)
    const restored = richGame()
    expect(restored.restore(game.save())).toBeUndefined()
    verify(restored)
  })

  it("武器の当たり具合は、実際に着けたあとの攻撃力と一致する", () => {
    for (const slug of weapons) {
      const goodId = goodBySlug(slug).id
      const game = richGame()
      eventsOrThrow(
        game.send({ type: "buy", shop: contentId("armory"), good: goodId })
      )
      const gear = game.state.gear.at(-1)!
      for (const memberSlug of partySlugs) {
        const memberId = idOf(memberSlug)
        const fit = game.queries.weaponFit(game.state, memberId, goodId)!
        const probe = createTestGame({
          state: game.state,
          ids: sequentialIds("probe"),
        })
        eventsOrThrow(
          probe.send({ type: "equip", gear: gear.id, member: memberId })
        )
        const weapon = probe.queries.member(probe.state, memberId)!.weapon!
        expect(weapon.attack, `${memberSlug}/${slug}`).toBe(fit.attack)
        expect(weapon.met).toBe(fit.met)
        expect(weapon.short).toEqual(fit.short)
        expect(weapon.favorite).toBe(fit.favorite)
      }
    }
  })

  it("武器ではない品物の当たり具合は null", () => {
    const game = richGame()
    const alda = idOf("alda")
    expect(game.queries.weaponFit(game.state, alda, contentId("leather"))).toBe(
      null
    )
    expect(game.queries.weaponFit(game.state, alda, contentId("potion"))).toBe(
      null
    )
    expect(
      game.queries.weaponFit(game.state, "ghost", contentId("sword"))
    ).toBe(null)
  })

  it("武器を着けていなければ素の武器で戦う", () => {
    const state = aState().withJoined("mayu").withGear([]).build()
    const game = createTestGame({ state })
    for (const slug of partySlugs) {
      const definition = memberBySlug(slug)
      const weapon = game.queries.member(state, definition.id)!.weapon!
      expect(weapon.good, slug).toBe(definition.defaultWeapon)
      expect(weapon.equipped).toBe(false)
      expect(weapon.gear).toBe(null)
      expect(weapon.plus).toBe(0)
      expect(weapon.usesBonus).toBe(0)
      expect(weapon.rarity).toBe("N")
      expect(weapon.extraPower).toBe(0)
      expect(weapon.favorite).toBe(true)
      expect(weapon.met).toBe(true)
      expect(game.queries.member(state, definition.id)!.armor).toBe(null)
    }
  })

  it("強化すると攻撃力と使用回数の表示が上がる", () => {
    const alda = idOf("alda")
    const greatsword = goodBySlug("greatsword")
    const game = richGame(
      aState()
        .withGold(5000)
        .withItem("bone", 9)
        .withEquipped("alda", "greatsword")
        .build()
    )
    const gear = game.state.gear.find(
      (entry) => entry.owner === alda && entry.good === greatsword.id
    )!
    const before = game.queries.member(game.state, alda)!.weapon!
    expect(before.power).toBe(greatsword.power)
    expect(before.usesBonus).toBe(0)
    const per = realContent().balance.weapon.usesPerPlus
    eventsOrThrow(game.send({ type: "upgrade", gear: gear.id }))
    const plus1 = game.queries.member(game.state, alda)!.weapon!
    expect(plus1.plus).toBe(1)
    expect(plus1.power).toBe(greatsword.power! + 1)
    expect(plus1.attack).toBeGreaterThanOrEqual(before.attack)
    expect(plus1.usesBonus).toBe(0)
    eventsOrThrow(game.send({ type: "upgrade", gear: gear.id }))
    const plus2 = game.queries.member(game.state, alda)!.weapon!
    expect(plus2.power).toBe(greatsword.power! + 2)
    // usesPerPlus の段ごとにワザの最大が1増える
    expect(plus2.usesBonus).toBe(Math.floor(2 / per))
    for (const skill of plus2.skills)
      expect(skill.uses, skill.id).toBe(
        game.queries.skill(skill.id)!.uses! + plus2.usesBonus
      )
  })

  it("防具の補正が能力に足され、外すと戻る", () => {
    for (const slug of ["mail", "robe"] as const) {
      const member = idOf(slug === "robe" ? "mayu" : "alda")
      const good = goodBySlug(slug)
      const [key, delta] = Object.entries(good.bonus!)[0] as [
        "spd" | "tec",
        number,
      ]
      const game = richGame()
      eventsOrThrow(
        game.send({ type: "buy", shop: contentId("armory"), good: good.id })
      )
      const gear = game.state.gear.at(-1)!
      const before = game.queries.member(game.state, member)!
      eventsOrThrow(game.send({ type: "equip", gear: gear.id, member }))
      const after = game.queries.member(game.state, member)!
      expect(after[key], slug).toBe(before[key] + delta)
      expect(after.base).toEqual(before.base)
      eventsOrThrow(game.send({ type: "unequip", gear: gear.id }))
      expect(game.queries.member(game.state, member)![key]).toBe(before[key])
    }
  })

  it("防具の耐久と修理の費用が見える", () => {
    const alda = idOf("alda")
    const leather = goodBySlug("leather")
    const game = richGame()
    eventsOrThrow(
      game.send({ type: "buy", shop: contentId("armory"), good: leather.id })
    )
    const gear = game.state.gear.at(-1)!
    eventsOrThrow(game.send({ type: "equip", gear: gear.id, member: alda }))
    const full = game.queries.member(game.state, alda)!.armor!
    const durability = leather.durability!
    expect(full.maxDurability).toBe(durability)
    expect(full.durability).toBe(durability)
    expect(full.wear).toBe(0)
    expect(full.gold).toBe(0)
    expect(full.name).toBe(leather.name)
    const wear = 7
    const worn = {
      ...game.state,
      gear: game.state.gear.map((entry) =>
        entry.id === gear.id ? { ...entry, wear, plus: 1 } : entry
      ),
    } as GameState
    const view = createTestGame({ state: worn }).queries.member(
      worn,
      alda
    )!.armor!
    const { durabilityPerPlus, repairPerPoint } = realContent().balance.armor
    // 強化1段で durabilityPerPlus だけ増える
    expect(view.maxDurability).toBe(durability + durabilityPerPlus)
    expect(view.durability).toBe(durability + durabilityPerPlus - wear)
    expect(view.wear).toBe(wear)
    expect(view.gold).toBe(Math.ceil(wear * repairPerPoint))
    expect(view.name).toBe(`${leather.name}+1`)
  })

  it("防具は一人一つで、着け替えると前の防具が外れる", () => {
    for (const member of [idOf("alda"), idOf("mort")]) {
      const game = richGame()
      for (const slug of armors.filter(
        (slug) =>
          goodBySlug(slug).allowedJobs?.includes(
            memberBySlug(member === idOf("alda") ? "alda" : "mort").job
          ) ?? true
      ))
        eventsOrThrow(
          game.send({
            type: "buy",
            shop: contentId("armory"),
            good: goodBySlug(slug).id,
          })
        )
      const bought = game.state.gear.filter((gear) => !gear.owner)
      for (const gear of bought)
        eventsOrThrow(game.send({ type: "equip", gear: gear.id, member }))
      const view = game.queries.member(game.state, member)!
      expect(view.gear.filter((entry) => entry.slot === "armor").length).toBe(1)
      expect(view.armor!.gear).toBe(bought.at(-1)!.id)
      expect(
        game.state.gear.filter((gear) => gear.owner === member).length
      ).toBe(1)
    }
  })

  it("隊列は並びの左2人が前衛で、入れ替えると変わる", () => {
    const game = createTestGame({ state: aState().build() })
    const rows = () =>
      game.queries.party(game.state).map((member) => [member.id, member.row])
    const [hero, alda, mort] = ["hero", "alda", "mort"].map(idOf)
    expect(rows()).toEqual([
      [hero, "front"],
      [alda, "front"],
      [mort, "back"],
    ])
    eventsOrThrow(game.send({ type: "swap-rows", a: hero, b: mort }))
    expect(rows()).toEqual([
      [mort, "front"],
      [alda, "front"],
      [hero, "back"],
    ])
    expect(game.queries.member(game.state, hero)!.row).toBe("back")
  })

  it("控えの仲間は隊列を持たず、出撃の印も立たない", () => {
    const jig = idOf("jig")
    const alda = idOf("alda")
    const game = createTestGame({
      state: aState().withGold(500).withBoard(["r-jig"]).build(),
    })
    eventsOrThrow(game.send({ type: "recruit", recruit: contentId("r-jig") }))
    const joined = game.queries.member(game.state, jig)!
    expect(joined.row).toBe(null)
    expect(joined.inParty).toBe(false)
    expect(
      game.queries.party(game.state).map((entry) => entry.id)
    ).not.toContain(jig)
    eventsOrThrow(game.send({ type: "swap", out: alda, in: jig }))
    expect(game.queries.member(game.state, jig)!.row).toBe("front")
    expect(game.queries.member(game.state, jig)!.inParty).toBe(true)
    expect(game.queries.member(game.state, alda)!.row).toBe(null)
    expect(game.queries.reserve(game.state).map((entry) => entry.id)).toEqual([
      alda,
    ])
  })

  it("成長の型と次のレベルまでの経験値が出る", () => {
    const game = createTestGame({
      state: aState().withGold(500).withBoard(["r-jig"]).build(),
    })
    eventsOrThrow(game.send({ type: "recruit", recruit: contentId("r-jig") }))
    const alda = game.queries.member(game.state, idOf("alda"))!
    expect(alda.growthType).toBe("normal")
    expect(alda.growthTypeName).toBe("普通")
    const { expBase, expPower } = realContent().balance
    expect(alda.next).toBe(Math.round(expBase * alda.lv ** expPower))
    const jig = game.queries.member(game.state, idOf("jig"))!
    expect(jig.growthType).toBe("early")
    expect(jig.growthTypeName).toBe("早熟")
    expect(jig.unique).toBe(false)
  })

  it("ユニークの仲間には印が立つ", () => {
    const definition = memberBySlug("husky")
    const game = createTestGame({
      state: aState().withGold(1000).withBoard(["sr-husky", "r-alma"]).build(),
    })
    const listed = (recruit: string) =>
      game.queries
        .recruits(game.state)
        .find((entry) => entry.id === contentId(recruit))?.unique
    expect(listed("sr-husky")).toBe(true)
    // 悪魔と契約して戦う仲間（R）はユニークではない
    expect(listed("r-alma")).toBe(false)
    eventsOrThrow(
      game.send({ type: "recruit", recruit: contentId("sr-husky") })
    )
    eventsOrThrow(game.send({ type: "recruit", recruit: contentId("r-alma") }))
    const husky = game.queries.member(game.state, definition.id)!
    expect(husky.unique).toBe(true)
    expect(husky.growthTypeName).toBe("普通")
    expect(husky.weapon!.good).toBe(definition.weapon)
    expect(husky.weapon!.equipped).toBe(true)
    expect(husky.armor!.good).toBe(definition.gear![0])
    expect(husky.pact).toBe(null)
    const alma = game.queries.member(game.state, idOf("alma"))!
    expect(alma.unique).toBe(false)
    expect(alma.armor).toBe(null)
    expect(alma.weapon!.good).toBe(memberBySlug("alma").pact!.modes[0]!.weapon)
    expect(alma.pact!.map((mode) => mode.current)).toEqual([true])
  })

  it("いない仲間を聞かれたら null", () => {
    const game = createTestGame()
    expect(game.queries.member(game.state, "ghost")).toBe(null)
    expect(game.queries.armor(game.state, { id: "ghost" })).toBe(null)
  })

  it("状態異常には日本語の名前が付く", () => {
    const alda = idOf("alda")
    const state = aState()
      .withMember("alda", {
        status: [
          { kind: "poison", turns: 2 },
          { kind: "protect", turns: 1 },
        ],
      })
      .build()
    const view = createTestGame({ state }).queries.member(state, alda)!
    expect(view.status.map((entry) => entry.name)).toEqual(["毒", "守り"])
  })

  it("最大HPは1より下がらない", () => {
    const alda = idOf("alda")
    const state = aState()
      .withMember("alda", { stats: { maxHp: 1, str: 0, tec: 0, spd: 0 } })
      .build()
    const view = createTestGame({ state }).queries.member(state, alda)!
    expect(view.maxHp).toBeGreaterThanOrEqual(1)
    expect(view.str).toBeGreaterThanOrEqual(0)
    expect(view.weapon!.attack).toBeGreaterThanOrEqual(1)
  })
})

describe("合体の耐性の見え方", () => {
  it("悪魔の一覧と主人公で上限到達を無効として案内し閲覧で保存を変えない", () => {
    for (const level of [1, 20]) {
      const game = richGame(
        aState()
          .withDemons([{ id: "lox", lv: level, exp: 0 }])
          .build()
      )
      const before = game.save()
      const hero = game.queries.member(game.state, idOf("hero"))!
      const demon = game.queries.demons(game.state)[0]!
      const expected = level === 20 ? "縛り無効" : "縛り8%"
      expect(hero.fusion!.resist[0]!.label).toBe(expected)
      expect(demon.fusion!.resist[0]!.label).toBe(expected)
      expect(hero.fusion!.resist[0]!.immune).toBe(level === 20)
      expect(game.save()).toEqual(before)
    }
  })
})
