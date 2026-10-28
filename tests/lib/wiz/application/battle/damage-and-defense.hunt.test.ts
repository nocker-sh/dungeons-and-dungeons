import { describe, expect, it } from "vite-plus/test"
import { aContent } from "@/lib/wiz/testing/content-builder"
import { aState } from "@/lib/wiz/testing/state-builder"
import { advanceUntilFoeTurn } from "@/lib/wiz/testing/advance-until-foe-turn"
import { contentId } from "@/lib/wiz/testing/content-id"
import { goodBySlug } from "@/lib/wiz/testing/good-by-slug"
import { memberBySlug } from "@/lib/wiz/testing/member-by-slug"
import { skillBySlug } from "@/lib/wiz/testing/skill-by-slug"
import { createTestGame } from "@/lib/wiz/testing/create-test-game"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"

const idOf = (slug: string) => memberBySlug(slug).id
import { GameCatalog } from "@/lib/wiz/content/game-catalog"
import { PartyRules } from "@/lib/wiz/rules/party-rules"
import type { ActionResult } from "@/lib/wiz/state/action-result"
import type { GameContent } from "@/lib/wiz/content/content-schema"
import type { GameEvent } from "@/lib/wiz/state/game-event"
import type { GameState, Gear } from "@/lib/wiz/state/state-schema"

/** 行動の出来事から最初の結果を取り出す。 */
function firstResult(events: readonly GameEvent[]): ActionResult {
  const acted = events.find((event) => event.type === "acted")
  if (acted?.type !== "acted") throw new Error("行動の出来事がない")
  return acted.results[0]
}

/** その仲間の防具を差し替える（同じ部位を二つにしない）。 */
function withArmor(
  state: GameState,
  member: string,
  good: string,
  plus = 0
): Gear[] {
  return [
    ...state.gear.filter(
      (gear) => !(gear.owner === member && gear.weapon === null)
    ),
    {
      id: `armor-${member}`,
      good: contentId(good),
      owner: member,
      plus,
      progress: 0,
      wear: 0,
      weapon: null,
    },
  ]
}

describe("被害と守り（hunt）", () => {
  const fixture = aContent()
    .withGood("robe", { allowedJobs: undefined })
    .build()
  // 乱数0のとき敵が狙うのは並びの一人目
  const front = idOf("alda")
  const alda = idOf("hero")
  const sion = idOf("sion")
  /** 一撃で分かるよう攻撃力を上げた敵。 */
  const heavyFoe = (content: GameContent, atk: number) =>
    aContent(content).withFoe("kamokutsu", { atk, hp: 4000 }).build()

  it("[feature:W005] 守りの加護→防御→防具の順に被害を減らす", () => {
    const content = aContent(heavyFoe(fixture, 100))
      .withBalance({
        protect: 0.5,
        guard: 0.5,
        backRow: { melee: 1, hit: 1 },
      })
      .build()
    const damageWith = (protect: boolean, guard: boolean) => {
      const state = aState(content)
        .withParty(["alda", "hero", "mort"])
        .withMember(
          "alda",
          protect ? { status: [{ kind: "protect", turns: 1 }] } : {}
        )
        .inBattle({
          foes: ["kamokutsu"],
          order: ["foe-1", "hero", "alda", "mort"],
          guarding: guard ? ["alda"] : [],
        })
        .build()
      const game = createTestGame({ content, state, random: 0 })
      return firstResult(eventsOrThrow(game.send({ type: "foe-turn" })))
    }
    const plain = damageWith(false, false).damage!
    expect(damageWith(true, false).damage).toBe(Math.floor(plain * 0.5))
    expect(damageWith(false, true).damage).toBe(Math.ceil(plain * 0.5))
    // 加護で半分にしたあとに防御の半分が掛かる
    expect(damageWith(true, true).damage).toBe(
      Math.ceil(Math.floor(plain * 0.5) * 0.5)
    )
  })

  it("[feature:W005] 守りの加護で被害が減ったときは、被害が残っていても防いだ印が付く", () => {
    const content = aContent(heavyFoe(fixture, 100))
      .withBalance({
        protect: 0.5,
        guard: 0.5,
        backRow: { melee: 1, hit: 1 },
      })
      .build()
    const resultWith = (protect: boolean) => {
      const state = aState(content)
        .withParty(["alda", "hero", "mort"])
        .withMember(
          "alda",
          protect ? { status: [{ kind: "protect", turns: 1 }] } : {}
        )
        .inBattle({
          foes: ["kamokutsu"],
          order: ["foe-1", "hero", "alda", "mort"],
        })
        .build()
      const game = createTestGame({ content, state, random: 0 })
      return firstResult(eventsOrThrow(game.send({ type: "foe-turn" })))
    }
    const blocked = resultWith(true)
    expect(blocked.blocked).toBe(true)
    expect(blocked.damage).toBeGreaterThan(0)
    // 加護がなければ印は付かない
    expect(resultWith(false).blocked).toBeUndefined()
  })

  it("[feature:W005] 守りの加護で被害が0になるときは防いだ結果になり、HPも耐久も減らない", () => {
    // 完全に防ぐ境目を測るので、balance.protect だけ0に上書きする
    const content = aContent(heavyFoe(fixture, 100))
      .withBalance({ protect: 0 })
      .build()
    const base = aState(content)
      .withParty(["alda", "hero", "mort"])
      .withMember("alda", {
        status: [{ kind: "protect", turns: 1 }],
      })
    const state = base
      .withGear(withArmor(base.build(), front, "robe"))
      .inBattle({
        foes: ["kamokutsu"],
        order: ["foe-1", "hero", "alda", "mort"],
      })
      .build()
    const game = createTestGame({ content, state, random: 0 })
    const hp = game.queries.member(game.state, front)!.hp
    const result = firstResult(eventsOrThrow(game.send({ type: "foe-turn" })))
    expect(result).toMatchObject({
      target: { kind: "member", id: front },
      damage: 0,
      blocked: true,
    })
    expect(result.armor).toBeUndefined()
    expect(game.queries.member(game.state, front)!.hp).toBe(hp)
    expect(game.queries.member(game.state, front)!.armor!.wear).toBe(0)
    // 加護は一度で消える
    expect(game.queries.member(game.state, front)!.status).toEqual([])
  })

  it("[feature:W005] 守りの加護は一撃で消え、次の一撃は減らない", () => {
    const content = aContent(heavyFoe(fixture, 40))
      .withBalance({
        protect: 0.5,
        guard: 0.5,
        backRow: { melee: 1, hit: 1 },
      })
      .build()
    const state = aState(content)
      .withParty(["alda", "hero", "mort"])
      .withMember("alda", { status: [{ kind: "protect", turns: 1 }] })
      .inBattle({
        foes: ["kamokutsu", "kamokutsu"],
        order: ["foe-1", "foe-2", "hero", "alda", "mort"],
      })
      .build()
    const game = createTestGame({ content, state, random: 0 })
    const reduced = firstResult(eventsOrThrow(game.send({ type: "foe-turn" })))
    expect(game.queries.member(game.state, front)!.status).toEqual([])
    const full = firstResult(eventsOrThrow(game.send({ type: "foe-turn" })))
    expect(full.target.id).toBe(front)
    // 加護のある一撃は balance.protect の割だけ小さい
    expect(reduced.damage).toBe(
      Math.floor(full.damage! * content.balance.protect)
    )
    expect(full.blocked).toBeUndefined()
  })

  it("[feature:W004] 後衛からの近接だけ威力が下がり、遠距離は変わらない", () => {
    const damageOf = (melee: number, skill: string, member: string) => {
      const content = aContent(fixture)
        .withBalance({ backRow: { melee, hit: 1 } })
        .build()
      const state = aState(content)
        .withParty(["alda", "mort", "hero"])
        .inBattle({
          foes: ["kamokutsu"],
          order: [member, "foe-1"],
          expedition: {},
        })
        .build()
      const game = createTestGame({ content, state, random: 0.5 })
      return firstResult(
        eventsOrThrow(game.send({ type: "act", command: "skill", skill }))
      ).damage!
    }
    // 主人公は並びの3番目（後衛）。短剣の「刺突」は近接、「投げ短剣」は遠距離
    const melee = skillBySlug("thrust").id
    const ranged = skillBySlug("throwknife").id
    const aldaMelee = skillBySlug("helmsplit").id
    expect(damageOf(0.5, melee, "hero")).toBeLessThan(
      damageOf(1, melee, "hero")
    )
    expect(damageOf(0.5, ranged, "hero")).toBe(damageOf(1, ranged, "hero"))
    // 前衛の近接は減らない
    expect(damageOf(0.5, aldaMelee, "alda")).toBe(
      damageOf(1, aldaMelee, "alda")
    )
  })

  it("[feature:W005] 被害は防具の耐久から先に減り、超えた分だけHPへ届く", () => {
    const content = heavyFoe(fixture, 100)
    const coat = goodBySlug("coat")
    const base = aState(content).withParty(["alda", "hero", "mort"])
    const state = base
      .withGear(withArmor(base.build(), front, "coat"))
      .inBattle({
        foes: ["kamokutsu"],
        order: ["foe-1", "hero", "alda", "mort"],
      })
      .build()
    const game = createTestGame({ content, state, random: 0 })
    const hp = game.queries.member(game.state, front)!.hp
    const result = firstResult(eventsOrThrow(game.send({ type: "foe-turn" })))
    const after = game.queries.member(game.state, front)!
    expect(result.armor).toBe(coat.durability)
    expect(result.broke).toBe(true)
    expect(result.damage).toBe(result.armor! + (hp - after.hp))
    expect(after.armor!.durability).toBe(0)
    expect(after.armor!.wear).toBe(coat.durability)
  })

  it("[feature:W005] 何度受けても耐久は最大を超えて減らず、HPも負にならない", () => {
    const content = aContent(fixture)
      .withFoe("kamokutsu", { atk: 9, hp: 4000 })
      .build()
    const base = aState(content).withParty(["alda", "hero", "mort"])
    const state = base
      .withGear(withArmor(base.build(), front, "coat"))
      .inBattle({
        foes: ["kamokutsu"],
        order: ["foe-1", "hero", "alda", "mort"],
      })
      .build()
    // 乱数0では敵はいつも並びの一人目を狙う
    const game = createTestGame({ content, state, random: 0 })
    for (let round = 0; round < 10; round++) {
      advanceUntilFoeTurn(game)
      eventsOrThrow(game.send({ type: "foe-turn" }))
      const view = game.queries.member(game.state, front)!
      expect(view.armor!.wear).toBeLessThanOrEqual(view.armor!.maxDurability)
      expect(view.armor!.durability).toBeGreaterThanOrEqual(0)
      expect(view.hp).toBeGreaterThanOrEqual(0)
    }
    expect(game.queries.member(game.state, front)!.armor!.durability).toBe(0)
  })

  it("[feature:W005] 一撃でHPを超える被害を受けてもHPは0で止まり、状態を失う", () => {
    const content = heavyFoe(fixture, 999)
    const state = aState(content)
      .withParty(["alda", "hero", "mort"])
      .withMember("alda", { status: [{ kind: "poison", turns: 3 }] })
      .inBattle({
        foes: ["kamokutsu"],
        order: ["foe-1", "hero", "alda", "mort"],
      })
      .build()
    const game = createTestGame({ content, state, random: 0 })
    const result = firstResult(eventsOrThrow(game.send({ type: "foe-turn" })))
    expect(result.target.id).toBe(front)
    expect(result.down).toBe(true)
    const view = game.queries.member(game.state, front)!
    expect(result.damage).toBeGreaterThan(view.maxHp)
    expect(view.hp).toBe(0)
    expect(view.status).toEqual([])
  })

  it("[feature:W004] 回復は最大HPを超えず、満タンなら0のまま", () => {
    const content = fixture
    const fullState = aState(content).build()
    const maxHp = createTestGame({ content, state: fullState }).queries.member(
      fullState,
      alda
    )!.maxHp
    const healOf = (hp: number) => {
      const state = aState(content)
        .withJoined("sion", { replacing: "mort" })
        .withParty(["alda", "hero", "sion"])
        .withMember("hero", { hp })
        .inBattle({ foes: ["kamokutsu"], order: ["sion", "foe-1"] })
        .build()
      const game = createTestGame({ content, state, random: 0.5 })
      const result = firstResult(
        eventsOrThrow(
          game.send({
            type: "act",
            command: "skill",
            skill: contentId("prayer"),
            target: alda,
          })
        )
      )
      return { result, hp: game.queries.member(game.state, alda)!.hp }
    }
    const brimming = healOf(maxHp - 1)
    expect(brimming.result.heal).toBe(1)
    expect(brimming.hp).toBe(maxHp)
    const full = healOf(maxHp)
    expect(full.result.heal).toBe(0)
    expect(full.hp).toBe(maxHp)
    const hurt = healOf(10)
    expect(hurt.result.heal).toBeGreaterThan(1)
    expect(hurt.hp).toBe(10 + hurt.result.heal!)
  })

  it("[feature:W004] 回復の量は (base+攻撃力)×威力 の振れ幅の内側", () => {
    const content = fixture
    const state = aState(content)
      .withJoined("sion", { replacing: "mort" })
      .withParty(["alda", "hero", "sion"])
      .withMember("hero", { hp: 1 })
      .inBattle({ foes: ["kamokutsu"], order: ["sion", "foe-1"] })
      .build()
    const catalog = new GameCatalog(content)
    const party = new PartyRules(catalog)
    const healer = state.members.find((member) => member.id === sion)!
    const attack = party.attack(healer, state)
    const { base, swing } = content.balance.heal
    const power = skillBySlug("prayer").power!
    const game = createTestGame({ content, state, random: 0.5 })
    const result = firstResult(
      eventsOrThrow(
        game.send({
          type: "act",
          command: "skill",
          skill: contentId("prayer"),
          target: alda,
        })
      )
    )
    expect(result.heal).toBeGreaterThanOrEqual(
      Math.round((base + attack) * power * swing[0])
    )
    expect(result.heal).toBeLessThanOrEqual(
      Math.round((base + attack) * power * swing[1])
    )
  })

  it("[feature:W004] 固定の量の道具は振れ幅に左右されない", () => {
    const content = fixture
    const bombOf = (random: number) => {
      const state = aState(content)
        .withParty(["alda", "hero", "mort"])
        .withItem("bomb", 2)
        .inBattle({ foes: ["kamokutsu"], order: ["hero", "foe-1"] })
        .build()
      const game = createTestGame({ content, state, random })
      return firstResult(
        eventsOrThrow(
          game.send({ type: "act", command: "item", good: contentId("bomb") })
        )
      ).damage
    }
    const bomb = goodBySlug("bomb")
    const amount = bomb.effect?.type === "damage" ? bomb.effect.amount : 0
    expect(bombOf(0)).toBe(amount)
    expect(bombOf(0.99)).toBe(amount)
  })

  it("[feature:W005] 防御しても被害は1より下がらない", () => {
    const content = aContent(fixture).withFoe("kamokutsu", { atk: 1 }).build()
    const state = aState(content)
      .withParty(["alda", "hero", "mort"])
      .inBattle({
        foes: ["kamokutsu"],
        order: ["foe-1", "hero", "alda", "mort"],
        guarding: ["alda"],
      })
      .build()
    const game = createTestGame({ content, state, random: 0 })
    const result = firstResult(eventsOrThrow(game.send({ type: "foe-turn" })))
    expect(result.guarded).toBe(true)
    expect(result.damage).toBe(1)
  })

  it("[feature:W004] 敵全員を狙うワザは生きている敵だけに一度ずつ当たる", () => {
    const content = aContent(fixture).withFoe("kamokutsu", { hp: 4000 }).build()
    const state = aState(content)
      .withParty(["alda", "hero", "mort"])
      .withWeaponSkills("hero", ["whirl"])
      .inBattle({
        foes: ["kamokutsu", "kamokutsu", "kamokutsu"],
        order: ["hero", "foe-1", "foe-2", "foe-3"],
      })
      .build()
    const withDead: GameState = {
      ...state,
      phase:
        state.phase.type === "battle"
          ? {
              ...state.phase,
              battle: {
                ...state.phase.battle,
                foes: state.phase.battle.foes.map((foe) =>
                  foe.id === "foe-2" ? { ...foe, hp: 0 } : foe
                ),
              },
            }
          : state.phase,
    }
    const game = createTestGame({ content, state: withDead, random: 0.5 })
    const events = eventsOrThrow(
      game.send({ type: "act", command: "skill", skill: contentId("whirl") })
    )
    const acted = events.find((event) => event.type === "acted")!
    if (acted.type !== "acted") throw new Error("行動の出来事がない")
    expect(acted.results.map((result) => result.target.id)).toEqual([
      "foe-1",
      "foe-3",
    ])
  })
})
