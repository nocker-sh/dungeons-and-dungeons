import { describe, expect, it } from "vite-plus/test"
import { aContent } from "@/lib/wiz/testing/content-builder"
import { aState } from "@/lib/wiz/testing/state-builder"
import { advanceUntilFoeTurn } from "@/lib/wiz/testing/advance-until-foe-turn"
import { fightToEnd } from "@/lib/wiz/testing/fight-to-end"
import { contentId } from "@/lib/wiz/testing/content-id"
import { goodBySlug } from "@/lib/wiz/testing/good-by-slug"
import { memberBySlug } from "@/lib/wiz/testing/member-by-slug"
import { skillBySlug } from "@/lib/wiz/testing/skill-by-slug"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"
import { startedState } from "@/lib/wiz/testing/started-state"
import { GameCommandError } from "@/lib/wiz/game/game-command-error"
import { GameDefinition } from "@/lib/wiz/definition/game-definition"
import { WizWorldEnvironment } from "@/lib/wiz/core/world/world"
import type { GameEvent } from "@/lib/wiz/state/game-event"
import type { GameState } from "@/lib/wiz/state/state-schema"

// 耐久の計算を同じ防具・4人で測る専用データ。職業制限は armor-jobs.test.ts で実データを使って測る。
const armorContent = aContent()
  .mapGoods((good) =>
    good.kind === "armor" ? { ...good, allowedJobs: undefined } : good
  )
  .build()

describe("防具の耐久", () => {
  const alda = memberBySlug("alda").id
  const sion = memberBySlug("sion").id
  const mend = skillBySlug("mend")
  const { guard, armor } = armorContent.balance

  /** 乱数を固定したプレイ。content を渡せばデータを差し替える。 */
  function armorPlay(content: unknown = armorContent, random = 0) {
    let serial = 0
    const definition = new GameDefinition(content)
    return definition.create(
      WizWorldEnvironment.create({
        random: () => random,
        now: () => 1000,
        nextId: () => `id-${++serial}`,
      }),
      startedState(definition)
    )
  }

  /** 一撃で耐久を超える敵（どの敵も攻撃力40）。 */
  const strongFoes = aContent(armorContent)
    .mapFoes((foe) => ({ ...foe, atk: 40 }))
    .build()

  /** 出撃の3人のうち主人公以外に同じ防具だけを着せた状態。最初から着けている防具は外す。 */
  function armored(slug: string, content: unknown = armorContent) {
    // 防具の修復は最初の仲間にいないシオンのワザなので、モートと入れ替えて出撃させる
    let builder = aState(content)
      .withJoined("sion", { replacing: "mort" })
      .withParty(["alda", "hero", "sion"])
      .withGear([])
      .withGold(5000)
    for (const member of ["alda", "sion"])
      builder = builder.withEquipped(member, slug)
    return builder.withWeaponSkills("sion", ["mend"])
  }

  /**
   * 敵が先に動く戦闘。誰も防御していないので、一撃だけを測れる。
   * 装備の個体IDは着せた順（gear-1 から）。
   */
  function withArmor(slug: string, content: unknown = armorContent) {
    const good = goodBySlug(slug)
    const definition = new GameDefinition(content)
    let serial = 0
    const party = ["alda", "hero", "sion"]
    const game = definition.create(
      WizWorldEnvironment.create({
        random: () => 0,
        now: () => 1000,
        nextId: () => `id-${++serial}`,
      }),
      armored(slug, content)
        .inBattle({ foes: ["hiyokobu"], order: ["foe-1", ...party] })
        .build()
    )
    const gears = new Map(
      ["alda", "sion"].map((member, index) => [
        memberBySlug(member).id,
        `gear-${index + 1}`,
      ])
    )
    return { game, gears, good }
  }

  function armorOf(game: ReturnType<typeof armorPlay>, member: string) {
    return game.queries.member(game.state, member)!.armor
  }

  function firstResult(events: readonly GameEvent[]) {
    const acted = events.find((event) => event.type === "acted")
    if (acted?.type !== "acted") throw new Error("行動の出来事がない")
    return acted.results[0]
  }

  it("[feature:W005] 受けた被害は防具の耐久から先に減り、HPは減らない", () => {
    const { game, good } = withArmor("mail")
    const hpBefore = new Map(
      game.state.members.map((member) => [member.id, member.hp])
    )
    const result = firstResult(eventsOrThrow(game.send({ type: "foe-turn" })))
    const target = result.target.id
    expect(result.armor).toBe(result.damage)
    expect(result.broke).toBeUndefined()
    expect(game.queries.member(game.state, target)!.hp).toBe(
      hpBefore.get(target)
    )
    expect(armorOf(game, target)!.durability).toBe(
      good.durability! - result.damage!
    )
  })

  it("[feature:W005] 耐久を超えた分だけHPへ届き、尽きると防具が砕ける", () => {
    // 旅装の外套は攻撃力40の一撃で砕け、残りがHPへ届く
    const { game, good } = withArmor("coat", strongFoes)
    const hpBefore = new Map(
      game.state.members.map((member) => [member.id, member.hp])
    )
    const result = firstResult(eventsOrThrow(game.send({ type: "foe-turn" })))
    const target = result.target.id
    expect(result.armor).toBe(good.durability)
    expect(result.broke).toBe(true)
    expect(result.damage).toBeGreaterThan(good.durability!)
    expect(game.queries.member(game.state, target)!.hp).toBe(
      hpBefore.get(target)! - (result.damage! - good.durability!)
    )
    expect(armorOf(game, target)!.durability).toBe(0)
  })

  it("[feature:W005] 耐久が0の防具は着けたままで、被害はすべてHPへ届く", () => {
    const { game, good } = withArmor("coat", strongFoes)
    const broken = firstResult(eventsOrThrow(game.send({ type: "foe-turn" })))
    const target = broken.target.id
    expect(armorOf(game, target)!.durability).toBe(0)
    // 同じ相手がもう一度狙われるまで敵の手番を送る
    for (let guardStep = 0; guardStep < 12; guardStep++) {
      advanceUntilFoeTurn(game)
      const hp = game.queries.member(game.state, target)!.hp
      const result = firstResult(eventsOrThrow(game.send({ type: "foe-turn" })))
      if (result.target.id !== target) continue
      expect(result.armor).toBeUndefined()
      expect(game.queries.member(game.state, target)!.hp).toBe(
        hp - result.damage!
      )
      // 砕けても防具は外れない
      expect(armorOf(game, target)!.name).toBe(good.name)
      return
    }
    throw new Error("同じ相手が狙われなかった")
  })

  it("[feature:W005] 防御で減らしてから耐久へ振り分ける", () => {
    const plain = withArmor("mail", strongFoes).game
    const before = firstResult(eventsOrThrow(plain.send({ type: "foe-turn" })))
    expect(before.guarded).toBe(false)
    const guarded = withArmor("mail", strongFoes).game
    // 一巡目で仲間が防御してから、二巡目の一撃を受ける
    eventsOrThrow(guarded.send({ type: "foe-turn" }))
    advanceUntilFoeTurn(guarded)
    const after = firstResult(eventsOrThrow(guarded.send({ type: "foe-turn" })))
    expect(after.guarded).toBe(true)
    expect(after.damage).toBe(Math.ceil(before.damage! * guard))
    expect(after.armor).toBe(after.damage)
  })

  it("[feature:W005] 毒は防具を通さず、HPから直に減る", () => {
    // 毒だけを測るので、敵の攻撃力は0にする
    const harmless = aContent(armorContent)
      .mapFoes((foe) => ({ ...foe, atk: 0 }))
      .build()
    const definition = new GameDefinition(harmless)
    const poisoned = definition.create(
      WizWorldEnvironment.create({
        random: () => 0.5,
        now: () => 0,
        nextId: () => "x",
      }),
      armored("mail", harmless)
        .withMember("alda", { status: [{ kind: "poison", turns: 3 }] })
        .inBattle({ foes: ["hiyokobu"], order: ["alda", "foe-1"] })
        .build()
    )
    const hp = poisoned.queries.member(poisoned.state, alda)!.hp
    const durability = armorOf(poisoned, alda)!.durability
    const events: GameEvent[] = []
    for (let step = 0; step < 12; step++) {
      if (events.some((event) => event.type === "ticked")) break
      const view = poisoned.queries.battle(poisoned.state)!
      events.push(
        ...eventsOrThrow(
          view.current.kind === "foe"
            ? poisoned.send({ type: "foe-turn" })
            : poisoned.send({ type: "act", command: "guard" })
        )
      )
    }
    expect(events.find((event) => event.type === "ticked")).toMatchObject({
      target: { id: alda },
      status: "poison",
    })
    expect(poisoned.queries.member(poisoned.state, alda)!.hp).toBeLessThan(hp)
    expect(armorOf(poisoned, alda)!.durability).toBe(durability)
  })

  it("[feature:W004] 「防具の修復」は味方ひとりの耐久を戻し、使用回数を使う", () => {
    const { game } = withArmor("mail", strongFoes)
    const hit = firstResult(eventsOrThrow(game.send({ type: "foe-turn" })))
    const target = hit.target.id
    const wear = armorOf(game, target)!.wear
    expect(wear).toBeGreaterThan(0)
    // シオンの手番まで進めてから「防具の修復」
    for (let step = 0; step < 10; step++) {
      const view = game.queries.battle(game.state)!
      if (view.current.kind === "member" && view.current.id === sion) break
      eventsOrThrow(
        view.current.kind === "foe"
          ? game.send({ type: "foe-turn" })
          : game.send({ type: "act", command: "guard" })
      )
    }
    const results = firstResult(
      eventsOrThrow(
        game.send({
          type: "act",
          command: "skill",
          skill: mend.id,
          target,
        })
      )
    )
    expect(results).toMatchObject({
      target: { kind: "member", id: target },
      repaired: Math.min(mend.repair!, wear),
    })
    expect(armorOf(game, target)!.wear).toBe(Math.max(0, wear - mend.repair!))
    expect(
      game.queries
        .commands(game.state, sion)
        ?.weaponSkills.find((skill) => skill.id === mend.id)?.left
    ).toBe(mend.uses! - 1)
  })

  it("[feature:W025] 鍛冶屋で減った耐久を直し、減った分だけお金を払う", () => {
    const { game, gears, good } = withArmor("mail", strongFoes)
    const hit = firstResult(eventsOrThrow(game.send({ type: "foe-turn" })))
    const target = hit.target.id
    expect(armorOf(game, target)!.wear).toBeGreaterThan(0)
    // 街へ戻っても宿に泊まっても耐久は戻らない（戦闘の終わりまでに受けた分を測る）
    fightToEnd(game)
    const wear = armorOf(game, target)!.wear
    eventsOrThrow(game.send({ type: "acknowledge" }))
    eventsOrThrow(game.send({ type: "retreat" }))
    eventsOrThrow(game.send({ type: "rest", room: contentId("attic") }))
    expect(armorOf(game, target)!.wear).toBe(wear)
    const repairs = game.queries.repairs(game.state)
    const row = repairs.rows.find((entry) => entry.member === target)!
    expect(row.gold).toBe(Math.ceil(wear * armor.repairPerPoint))
    expect(repairs.all.gold).toBe(row.gold)
    const gold = game.state.gold
    const events = eventsOrThrow(game.send({ type: "repair", member: target }))
    expect(events[0]).toEqual({
      type: "repaired",
      gears: [gears.get(target)],
      durability: wear,
      gold: row.gold,
    })
    expect(game.state.gold).toBe(gold - row.gold)
    expect(armorOf(game, target)!.durability).toBe(good.durability)
    // 満タンなら直せない
    expect(
      (game.send({ type: "repair", member: target }) as GameCommandError).code
    ).toBe("ALREADY")
  })

  it("[feature:W025] お金が足りなければ拒否し、耐久も所持金も変えない", () => {
    const { game } = withArmor("mail", strongFoes)
    eventsOrThrow(game.send({ type: "foe-turn" }))
    fightToEnd(game)
    eventsOrThrow(game.send({ type: "acknowledge" }))
    eventsOrThrow(game.send({ type: "retreat" }))
    const poor = new GameDefinition(strongFoes).create(
      WizWorldEnvironment.create({
        random: () => 0.5,
        now: () => 0,
        nextId: () => "x",
      }),
      { ...game.state, gold: 0 } as GameState
    )
    const before = poor.state
    const error = poor.send({ type: "repair" })
    expect(error).toBeInstanceOf(GameCommandError)
    expect((error as GameCommandError).code).toBe("NO_GOLD")
    expect(poor.state).toBe(before)
  })

  it("[feature:W025] 防具を着けている仲間がいなければ直せない", () => {
    const definition = new GameDefinition(armorContent)
    const game = definition.create(undefined, aState().withGear([]).build())
    expect((game.send({ type: "repair" }) as GameCommandError).code).toBe(
      "ALREADY"
    )
    expect(game.queries.repairs(game.state).rows).toEqual([])
  })

  it("[feature:W023] 強化すると最大の耐久が増え、その分だけ今の耐久も増える", () => {
    const definition = new GameDefinition(armorContent)
    const game = definition.create(
      undefined,
      armored("leather").withItem("bone", 9).inTown().build()
    )
    const good = goodBySlug("leather")
    const gears = new Map(
      ["alda", "sion"].map((member, index) => [
        memberBySlug(member).id,
        `gear-${index + 1}`,
      ])
    )
    const gear = gears.get(alda)!
    const base = good.durability!
    const per = armor.durabilityPerPlus
    expect(armorOf(game, alda)).toMatchObject({
      durability: base,
      maxDurability: base,
    })
    eventsOrThrow(game.send({ type: "upgrade", gear }))
    expect(armorOf(game, alda)).toMatchObject({
      name: `${good.name}+1`,
      durability: base + per,
      maxDurability: base + per,
    })
    expect(
      game.queries.gear(game.state).find((entry) => entry.gear === gear)?.stat
    ).toBe(`耐久 ${base + per}`)
  })
})
