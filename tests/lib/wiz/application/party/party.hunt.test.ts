import { describe, expect, it } from "vite-plus/test"
import { aContent } from "@/lib/wiz/testing/content-builder"
import { aState } from "@/lib/wiz/testing/state-builder"
import { contentId } from "@/lib/wiz/testing/content-id"
import { goodBySlug } from "@/lib/wiz/testing/good-by-slug"
import { memberBySlug } from "@/lib/wiz/testing/member-by-slug"
import { skillBySlug } from "@/lib/wiz/testing/skill-by-slug"
import { createTestGame } from "@/lib/wiz/testing/create-test-game"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"
import { seededRandom } from "@/lib/wiz/testing/seeded-random"
import { GameCommandError } from "@/lib/wiz/game/game-command-error"
import type { GameAction } from "@/lib/wiz/commands"

const idOf = (slug: string) => memberBySlug(slug).id

/** 装備と隊列（W017〜W020）の不変条件をさがす。 */
describe("装備と隊列の不変条件", () => {
  const hero = idOf("hero")
  const alda = idOf("alda")
  const mayu = idOf("mayu")
  const mort = idOf("mort")
  const jig = idOf("jig")
  const gearOf = (
    game: ReturnType<typeof createTestGame>,
    good: string,
    owner: string | null = null
  ) =>
    game.state.gear.find(
      (entry) => entry.good === contentId(good) && entry.owner === owner
    )!

  /** 控えのマユに木こりの斧を持たせた街（本物の始まりは誰も武器を持たない）。 */
  const armedGame = (gold = 500) =>
    createTestGame({
      state: aState()
        .withGold(gold)
        .withJoined("mayu")
        .withEquipped("mayu", "axe")
        .build(),
    })

  it("[feature:W017] 拒否された装備は状態を変えない", () => {
    const game = armedGame()
    const axe = gearOf(game, "axe", mayu)
    for (const [action, code] of [
      [{ type: "equip", gear: "no-such-gear", member: alda }, "NOT_OWNED"],
      [{ type: "equip", gear: axe.id, member: "no-such-member" }, "UNKNOWN"],
      [{ type: "equip", gear: axe.id, member: mayu }, "ALREADY"],
      [{ type: "unequip", gear: "no-such-gear" }, "NOT_OWNED"],
    ] as const satisfies readonly [GameAction, string][]) {
      const before = game.state
      const result = game.send(action)
      expect((result as GameCommandError).code).toBe(code)
      expect(game.state).toBe(before)
    }
  })

  it("[feature:W018] 誰も着けていない装備は外せない（ALREADY）", () => {
    const game = createTestGame({ state: aState().withGold(500).build() })
    eventsOrThrow(
      game.send({
        type: "buy",
        shop: contentId("armory"),
        good: contentId("leather"),
      })
    )
    const leather = gearOf(game, "leather")
    const before = game.state
    expect(
      (game.send({ type: "unequip", gear: leather.id }) as GameCommandError)
        .code
    ).toBe("ALREADY")
    expect(game.state).toBe(before)
  })

  it("[feature:W017] 街の外では装備も隊列も変えられず、状態を変えない", () => {
    const game = createTestGame({
      state: aState()
        .withJoined("mayu")
        .withEquipped("mayu", "axe")
        .inExpedition()
        .build(),
    })
    const axe = gearOf(game, "axe", mayu)
    for (const action of [
      { type: "equip", gear: axe.id, member: alda },
      { type: "unequip", gear: axe.id },
      { type: "swap", out: mort, in: jig },
      { type: "swap-rows", a: alda, b: mort },
    ] as const satisfies readonly GameAction[]) {
      const before = game.state
      const result = game.send(action)
      expect((result as GameCommandError).code).toBe("WRONG_PHASE")
      expect(game.state).toBe(before)
    }
  })

  it("[feature:W017] 固有の武器は着け替えられず、外せず、取り上げられない", () => {
    const husky = idOf("husky")
    const alma = idOf("alma")
    const game = createTestGame({
      state: aState()
        .withGold(1000)
        .withJoined("mayu")
        .withEquipped("mayu", "axe")
        .withBoard(["sr-husky", "r-alma"])
        .build(),
    })
    eventsOrThrow(
      game.send({ type: "recruit", recruit: contentId("sr-husky") })
    )
    eventsOrThrow(game.send({ type: "recruit", recruit: contentId("r-alma") }))
    const gloves = game.state.gear.find(
      (entry) => entry.good === contentId("iron-gloves")
    )!
    const axe = gearOf(game, "axe", mayu)
    for (const action of [
      { type: "equip", gear: axe.id, member: husky },
      { type: "equip", gear: gloves.id, member: alda },
      { type: "unequip", gear: gloves.id },
      // 悪魔と契約して戦う仲間（R）は武器を持たない
      { type: "equip", gear: axe.id, member: alma },
    ] as const satisfies readonly GameAction[]) {
      const before = game.state
      expect((game.send(action) as GameCommandError).code).toBe("FIXED_GEAR")
      expect(game.state).toBe(before)
    }
    // ハスキーは防具も含めて変えられない。アルマは武器も防具も持たない
    expect(game.queries.gearLock(husky)).toContain("ユニークの仲間")
    expect(game.queries.gearLock(alma)).toContain("悪魔と契約して戦う")
    expect(game.queries.weaponLock(alda)).toBeNull()
    expect(game.queries.gearLock(alda)).toBeNull()
  })

  it("[feature:W017] 武器を着け替えても防具は外れない（同じ枠だけ入れ替わる）", () => {
    const game = createTestGame({
      state: aState().withGold(500).withEquipped("alda", "greatsword").build(),
    })
    eventsOrThrow(
      game.send({
        type: "buy",
        shop: contentId("armory"),
        good: contentId("leather"),
      })
    )
    eventsOrThrow(
      game.send({
        type: "buy",
        shop: contentId("armory"),
        good: contentId("sword"),
      })
    )
    const leather = gearOf(game, "leather")
    const sword = gearOf(game, "sword")
    eventsOrThrow(game.send({ type: "equip", gear: leather.id, member: alda }))
    const events = eventsOrThrow(
      game.send({ type: "equip", gear: sword.id, member: alda })
    )
    const greatsword = game.state.gear.find(
      (entry) => entry.good === contentId("greatsword")
    )!
    expect(events[0]).toMatchObject({
      type: "equipped",
      replaced: greatsword.id,
    })
    expect(greatsword.owner).toBeNull()
    expect(
      game.state.gear
        .filter((entry) => entry.owner === alda)
        .map((entry) => entry.good)
        .toSorted()
    ).toEqual([contentId("leather"), contentId("sword")].toSorted())
  })

  it("[feature:W017] ほかの仲間から武器を取り上げると、元の持ち主は素の武器で戦う", () => {
    const game = armedGame()
    const axe = gearOf(game, "axe", mayu)
    eventsOrThrow(game.send({ type: "equip", gear: axe.id, member: alda }))
    // マユに残るのは防具だけ
    expect(
      game.state.gear.filter(
        (entry) =>
          entry.owner === mayu &&
          game.queries.good(entry.good)?.kind === "weapon"
      )
    ).toEqual([])
    const weapon = game.queries.member(game.state, mayu)!.weapon
    expect(weapon).toMatchObject({
      good: memberBySlug("mayu").defaultWeapon,
      equipped: false,
    })
    // 取り上げた側は武器が二つにならない
    expect(
      game.state.gear.filter(
        (entry) =>
          entry.owner === alda &&
          game.queries.good(entry.good)?.kind === "weapon"
      ).length
    ).toBe(1)
  })

  it("[feature:W018] 最大HPが下がると今のHPも上限に収まり、倒れた仲間は0のまま", () => {
    const bonus = 20
    const content = aContent()
      .withGood("leather", { bonus: { maxHp: bonus } })
      .build()
    const base = memberBySlug("alda").stats.maxHp
    const game = createTestGame({
      content,
      state: aState(content).withGold(500).build(),
    })
    eventsOrThrow(
      game.send({
        type: "buy",
        shop: contentId("armory"),
        good: contentId("leather"),
      })
    )
    const leather = gearOf(game, "leather")
    eventsOrThrow(game.send({ type: "equip", gear: leather.id, member: alda }))
    expect(game.queries.member(game.state, alda)!.maxHp).toBe(base + bonus)
    // 満タンまで回復してから外すと、今のHPが新しい最大へ収まる
    const healed = createTestGame({
      content,
      state: aState(content)
        .withGold(500)
        .withGear(game.state.gear)
        .withMember("alda", { hp: base + bonus })
        .withMember("mort", { hp: 0 })
        .build(),
    })
    eventsOrThrow(healed.send({ type: "unequip", gear: leather.id }))
    expect(healed.queries.member(healed.state, alda)!.hp).toBe(base)
    expect(healed.queries.member(healed.state, mort)!.hp).toBe(0)
  })

  it("[feature:W017] 最大HPが上がっても今のHPは増えない", () => {
    const bonus = 20
    const content = aContent()
      .withGood("leather", { bonus: { maxHp: bonus } })
      .build()
    const base = memberBySlug("alda").stats.maxHp
    const game = createTestGame({
      content,
      state: aState(content)
        .withGold(500)
        .withMember("alda", { hp: 100 })
        .build(),
    })
    eventsOrThrow(
      game.send({
        type: "buy",
        shop: contentId("armory"),
        good: contentId("leather"),
      })
    )
    const leather = gearOf(game, "leather")
    eventsOrThrow(game.send({ type: "equip", gear: leather.id, member: alda }))
    expect(game.queries.member(game.state, alda)!.hp).toBe(100)
    expect(game.queries.member(game.state, alda)!.maxHp).toBe(base + bonus)
  })

  it("[feature:W019] 交代の拒否は状態を変えず、出撃は3人のまま", () => {
    const game = createTestGame({ state: aState().withGold(500).build() })
    eventsOrThrow(game.send({ type: "recruit", recruit: contentId("r-jig") }))
    for (const [action, code] of [
      [{ type: "swap", out: hero, in: jig }, "HERO"],
      [{ type: "swap", out: jig, in: mort }, "UNKNOWN"],
      [{ type: "swap", out: mort, in: mort }, "UNKNOWN"],
      [{ type: "swap", out: mort, in: "no-one" }, "UNKNOWN"],
      [{ type: "swap", out: alda, in: mayu }, "UNKNOWN"],
    ] as const satisfies readonly [GameAction, string][]) {
      const before = game.state
      expect((game.send(action) as GameCommandError).code).toBe(code)
      expect(game.state).toBe(before)
    }
    expect(game.state.party.length).toBe(3)
  })

  it("[feature:W019] 何度入れ替えても出撃は3人で重複しない", () => {
    const game = createTestGame({
      state: aState().withGold(500).withBoard(["r-jig", "n-luca"]).build(),
    })
    eventsOrThrow(game.send({ type: "recruit", recruit: contentId("r-jig") }))
    eventsOrThrow(game.send({ type: "recruit", recruit: contentId("n-luca") }))
    const random = seededRandom(5)
    for (let step = 0; step < 40; step++) {
      const reserve = game.queries.reserve(game.state)
      const party = game.queries
        .party(game.state)
        .filter((member) => member.id !== hero)
      if (!reserve.length) break
      const out = party[Math.floor(random() * party.length)]
      const incoming = reserve[Math.floor(random() * reserve.length)]
      eventsOrThrow(game.send({ type: "swap", out: out.id, in: incoming.id }))
      expect(game.state.party.length).toBe(3)
      expect(new Set(game.state.party).size).toBe(3)
      expect(game.state.party).toContain(hero)
    }
  })

  it("[feature:W020] 同じ列・同じ仲間・出撃していない仲間は入れ替えられない", () => {
    const game = createTestGame()
    for (const [action, code] of [
      // 後衛は1人なので、同じ列は前衛の2人だけ
      [{ type: "swap-rows", a: hero, b: alda }, "UNAVAILABLE"],
      [{ type: "swap-rows", a: alda, b: alda }, "UNAVAILABLE"],
      [{ type: "swap-rows", a: alda, b: jig }, "UNKNOWN"],
    ] as const satisfies readonly [GameAction, string][]) {
      const before = game.state
      expect((game.send(action) as GameCommandError).code).toBe(code)
      expect(game.state).toBe(before)
    }
  })

  it("[feature:W020] 入れ替えは2か所だけ動かし、出来事は入れ替えた後の位置を出す", () => {
    const game = createTestGame()
    expect(game.state.party).toEqual([hero, alda, mort])
    const events = eventsOrThrow(
      game.send({ type: "swap-rows", a: alda, b: mort })
    )
    expect(game.state.party).toEqual([hero, mort, alda])
    // front には前衛へ入った者、back には後衛へ下がった者
    expect(events[0]).toEqual({
      type: "rows-swapped",
      front: mort,
      back: alda,
    })
    expect(game.queries.member(game.state, mort)!.row).toBe("front")
    expect(game.queries.member(game.state, alda)!.row).toBe("back")
    expect(game.queries.member(game.state, hero)!.row).toBe("front")
  })

  it("[feature:W020] 前衛と後衛の入れ替えを繰り返しても並びは元へ戻る", () => {
    const game = createTestGame()
    const before = game.state.party
    eventsOrThrow(game.send({ type: "swap-rows", a: alda, b: mort }))
    eventsOrThrow(game.send({ type: "swap-rows", a: mort, b: alda }))
    expect(game.state.party).toEqual(before)
  })

  it("[feature:W017] 装備と隊列を変えた後の保存は同じ状態へ戻る", () => {
    const game = createTestGame({ state: aState().withGold(500).build() })
    eventsOrThrow(
      game.send({
        type: "buy",
        shop: contentId("armory"),
        good: contentId("mail"),
      })
    )
    const mail = gearOf(game, "mail")
    eventsOrThrow(game.send({ type: "equip", gear: mail.id, member: alda }))
    eventsOrThrow(game.send({ type: "recruit", recruit: contentId("r-jig") }))
    eventsOrThrow(game.send({ type: "swap", out: mort, in: jig }))
    eventsOrThrow(game.send({ type: "swap-rows", a: alda, b: jig }))
    const saved = JSON.parse(JSON.stringify(game.save()))
    const before = JSON.stringify(game.state)
    const restored = createTestGame()
    expect(restored.restore(saved)).toBeUndefined()
    expect(JSON.stringify(restored.state)).toBe(before)
    // 戻した後も編成を続けられる
    eventsOrThrow(restored.send({ type: "swap", out: jig, in: mort }))
    expect(restored.state.party).toEqual([hero, mort, alda])
  })

  it("[feature:W004] 武器を弱いものに替えても、残りの使用回数は0より下がらない", () => {
    // 鉄の両手剣とアルダの素の武器は同じワザを持つ
    const whirl = skillBySlug("helmsplit")
    const greatsword = goodBySlug("greatsword")
    const plus = 2
    const game = createTestGame({ state: aState().withGold(500).build() })
    eventsOrThrow(
      game.send({ type: "buy", shop: contentId("armory"), good: greatsword.id })
    )
    const bought = gearOf(game, "greatsword")
    const upgraded = createTestGame({
      state: aState()
        .withGold(500)
        .withGear(
          game.state.gear.map((entry) =>
            entry.id === bought.id ? { ...entry, plus, owner: alda } : entry
          )
        )
        .withWeaponSkills("alda", ["helmsplit"])
        .withUses("alda", [{ skill: whirl.id, count: whirl.uses! + 99 }])
        .build(),
    })
    const commands = upgraded.queries.commands(upgraded.state, alda)!
    const view = commands.weaponSkills.find((skill) => skill.id === whirl.id)!
    // 強化の段で最大が増えても、使いすぎた残りは0で止まる
    expect(view.uses).toBeGreaterThan(whirl.uses!)
    expect(view.left).toBe(0)
    expect(view.usable).toBe(false)
    eventsOrThrow(upgraded.send({ type: "unequip", gear: bought.id }))
    const bare = upgraded.queries.commands(upgraded.state, alda)!
    const bareView = bare.weaponSkills.find((skill) => skill.id === whirl.id)!
    expect(bareView.uses).toBe(whirl.uses)
    expect(bareView.left).toBe(0)
  })
})
