import { describe, expect, it } from "vite-plus/test"
import {
  aContent,
  aState,
  battleStateOf,
  contentId,
  createTestGame,
  createTestPlay,
  eventsOrThrow,
  fightToEnd,
  foeBySlug,
  memberBySlug,
  realContent,
  skillBySlug,
  startedState,
} from "@/lib/wiz/testing"
import {
  GameCatalog,
  GameCommandError,
  GameDefinition,
  BattleRules,
  PartyRules,
  WizWorldEnvironment,
  type GameEvent,
  type GameState,
} from "@/lib/wiz"

const idOf = (slug: string) => memberBySlug(slug).id

describe("戦闘", () => {
  const hero = idOf("hero")
  const mort = idOf("mort")
  const kamokutsu = foeBySlug("kamokutsu")

  it("[feature:W004] 後衛も攻撃できるが、後衛から近接の攻撃は被害が減る", () => {
    // 主人公を後衛に置く。短剣の「刺突」は近接、「投げナイフ」は遠距離
    const melee = skillBySlug("thrust")
    const ranged = skillBySlug("throwknife")
    const withMelee = (factor: number) => {
      const content = aContent()
        .withBalance({ backRow: { melee: factor, hit: 1 } })
        .build()
      return createTestGame({
        content,
        random: 0.5,
        state: aState(content)
          .withParty(["alda", "mort", "hero"])
          .inBattle({ foes: ["kamokutsu"], order: ["hero", "foe-1"] })
          .build(),
      })
    }
    const game = withMelee(0.5)
    const weakOf = (target: typeof game, member: string, skill: string) =>
      target.queries
        .commands(target.state, member)
        ?.weaponSkills.find((entry) => entry.id === skill)?.weak
    expect(weakOf(game, hero, melee.id)).toBe(true)
    expect(weakOf(game, hero, ranged.id)).toBe(false)
    const damage = (target: typeof game) => {
      const events = eventsOrThrow(
        target.send({ type: "act", command: "skill", skill: melee.id })
      )
      const acted = events.find((event) => event.type === "acted")
      return acted?.type === "acted" ? (acted.results[0].damage ?? 0) : 0
    }
    expect(game.queries.battle(game.state)?.current).toEqual({
      kind: "member",
      id: hero,
    })
    expect(damage(game)).toBeLessThan(damage(withMelee(1)))
  })

  it("[feature:W005] 敵の近接は前衛だけを狙い、前衛のタンクは重みの分だけ狙われやすい", () => {
    const { game } = createTestPlay()
    const members = game.state.party.map((id) =>
      game.state.members.find((member) => member.id === id)!
    )
    // 並びは主人公・アルダ（タンク）が前衛、モートが後衛
    expect(game.state.party).toEqual([hero, idOf("alda"), mort])
    const rulesWith = (tank: number) => {
      const catalog = new GameCatalog(
        aContent().withBalance({ tankTarget: tank }).build()
      )
      return new BattleRules(catalog, new PartyRules(catalog))
    }
    const tank = 3
    const rules = rulesWith(tank)
    const step = 0.001
    // 近接：前衛の主人公1・アルダ3。境目のすぐ手前はその枠の仲間
    const melee = 1 + tank
    expect(rules.target(members, () => 1 / melee - step, "melee")?.id).toBe(
      hero
    )
    expect(rules.target(members, () => 1 / melee + step, "melee")?.id).toBe(
      idOf("alda")
    )
    // 端の乱数でも後衛には届かない
    expect(rules.target(members, () => 1 - step, "melee")?.id).toBe(
      idOf("alda")
    )
    // 遠距離：後衛のモートにも重み1で届く
    const ranged = 2 + tank
    expect(
      rules.target(members, () => (1 + tank) / ranged - step, "ranged")?.id
    ).toBe(idOf("alda"))
    expect(rules.target(members, () => 1 - step, "ranged")?.id).toBe(mort)
    // タンクの重みが1なら、前衛は等しく狙われる
    expect(rulesWith(1).target(members, () => 0.5 - step, "melee")?.id).toBe(
      hero
    )
    expect(rulesWith(1).target(members, () => 0.5 + step, "melee")?.id).toBe(
      idOf("alda")
    )
  })

  it("[feature:W004] 一回の指示で一人分の結果だけが出て、手番が次へ回る", () => {
    const thrust = skillBySlug("thrust")
    const game = createTestGame({
      state: aState()
        .inBattle({ foes: ["kamokutsu"], order: ["hero", "mort"] })
        .build(),
    })
    const events = eventsOrThrow(
      game.send({ type: "act", command: "skill", skill: thrust.id })
    )
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      type: "acted",
      actor: { kind: "member", id: hero },
      name: thrust.name,
    })
    expect(
      game.queries
        .commands(game.state, hero)
        ?.weaponSkills.find((skill) => skill.id === thrust.id)?.left
    ).toBe(thrust.uses! - 1)
    expect(battleStateOf(game.state).foes[0].hp).toBeLessThan(kamokutsu.hp)
    expect(game.queries.battle(game.state)?.current).toEqual({
      kind: "member",
      id: mort,
    })
  })

  it("[feature:W005] 自分の手番でない者は動けない", () => {
    const { game } = createTestPlay()
    eventsOrThrow(game.send({ type: "depart", layer: contentId("layer0") }))
    eventsOrThrow(game.send({ type: "advance", to: "n1" }))
    expect((game.send({ type: "foe-turn" }) as GameCommandError).code).toBe(
      "NOT_YOUR_TURN"
    )
  })

  it("[feature:W005] 防御すると次の敵の被害が半分になる", () => {
    // 乱数0では敵は重みの先頭（並びの一人目）を狙い、被害の振れ幅も一定
    const guard = realContent().balance.guard
    const game = createTestGame({
      random: 0,
      state: aState()
        .withParty(["alda", "hero", "mort"])
        .inBattle({
          foes: ["kamokutsu"],
          order: ["foe-1", "hero", "alda", "mort"],
        })
        .build(),
    })
    const first = game.state.party[0]
    const plain = eventsOrThrow(game.send({ type: "foe-turn" }))[0] as Extract<
      GameEvent,
      { type: "acted" }
    >
    expect(plain.results[0]).toMatchObject({
      target: { id: first },
      guarded: false,
    })
    // 一巡してから、全員が防御した次の敵の手番を受ける
    for (const _ of game.state.party)
      eventsOrThrow(game.send({ type: "act", command: "guard" }))
    const halved = eventsOrThrow(game.send({ type: "foe-turn" }))[0] as Extract<
      GameEvent,
      { type: "acted" }
    >
    expect(halved.results[0]).toMatchObject({
      target: { id: first },
      guarded: true,
    })
    expect(halved.results[0].damage).toBe(
      Math.ceil(plain.results[0].damage! * guard)
    )
    expect(game.queries.battle(game.state)?.guarding).toEqual([])
  })

  it("[feature:W006] 勝つと戦利品の板が出て、閉じるまで進めない", () => {
    const content = aContent()
      .withLayerFoes("layer0", ["hiyokobu"])
      .withLayer("layer0", { group: [1, 1] })
      .build()
    const { game } = createTestPlay(0.5, content)
    eventsOrThrow(game.send({ type: "depart", layer: contentId("layer0") }))
    eventsOrThrow(game.send({ type: "advance", to: "n1" }))
    const events = fightToEnd(game)
    const victory = events.find((event) => event.type === "victory")
    expect(victory).toBeDefined()
    expect(game.queries.route(game.state)?.pending?.kind).toBe("loot")
    expect(
      (game.send({ type: "advance", to: "n2" }) as GameCommandError).code
    ).toBe("PENDING")
    eventsOrThrow(game.send({ type: "acknowledge" }))
    const exp = victory?.type === "victory" ? victory.exp : 0
    expect(exp).toBeGreaterThan(0)
    expect(
      game.queries
        .party(game.state)
        .every((member) => member.exp === (member.hero ? 0 : exp))
    ).toBe(true)
  })

  it("[feature:W012] 召喚石を落とす敵を倒すと、戦利品に召喚石が入る", () => {
    const stones = 2
    const content = aContent()
      .withFoe("kamokutsu", { stones })
      .withWeaponPower(400)
      .build()
    const game = createTestGame({
      content,
      random: 0.5,
      state: aState(content)
        .inBattle({ foes: ["kamokutsu"] })
        .build(),
    })
    const before = game.state.stones
    const events = fightToEnd(game)
    const victory = events.find((event) => event.type === "victory")
    expect(victory).toMatchObject({ stones })
    expect(game.queries.route(game.state)?.pending).toMatchObject({
      kind: "loot",
      stones,
    })
    expect(game.state.stones).toBe(before + stones)
  })

  it("[feature:W005] 全滅すると今回の拾い物を失い、HP1で街へ戻る", () => {
    const { game } = createTestPlay(0.99)
    const strong = {
      ...game.state,
      members: game.state.members.map((member) => ({ ...member, hp: 1 })),
    }
    const definition = new GameDefinition(realContent())
    const weak = definition.create(
      WizWorldEnvironment.create({
        random: () => 0.99,
        now: () => 0,
        nextId: () => "x",
      }),
      strong as GameState
    )
    const gold = weak.state.gold
    eventsOrThrow(weak.send({ type: "depart", layer: contentId("layer0") }))
    eventsOrThrow(weak.send({ type: "advance", to: "n1" }))
    const events = fightToEnd(weak, "guard")
    expect(events.at(-1)).toEqual({ type: "defeated" })
    expect(weak.state.phase.type).toBe("town")
    expect(weak.state.gold).toBe(gold)
    expect(
      weak.queries.party(weak.state).every((member) => member.hp === 1)
    ).toBe(true)
  })

  it("[feature:W002] ボスを倒すと次の層が開く", () => {
    // 一撃で終わらせるため、武器の攻撃力だけ上げたデータで試す
    const content = aContent().withWeaponPower(900).build()
    const definition = new GameDefinition(content)
    const layer1 = realContent().layers[1]
    const boss = layer1.stations.find((station) => station.boss)!.id
    const beforeBoss = layer1.stations.find((station) =>
      station.next.includes(boss)
    )!.id
    const base = startedState(definition)
    const state: GameState = {
      ...base,
      members: base.members.map((member) => ({
        ...member,
        lv: 30,
        stats: { ...member.stats, maxHp: 4000, str: 60, tec: 60, spd: 20 },
        hp: 4000,
      })),
      reached: 1,
      phase: {
        type: "expedition",
        expedition: {
          layer: layer1.id,
          at: beforeBoss,
          visited: ["s"],
          events: [],
          pending: null,
          loot: { gold: 0, goods: [] },
          cleared: false,
        },
      },
    }
    const game = definition.create(
      WizWorldEnvironment.create({
        random: () => 0.5,
        now: () => 0,
        nextId: () => "x",
      }),
      state
    )
    const arrived = eventsOrThrow(game.send({ type: "advance", to: boss }))
    expect(arrived).toContainEqual({
      type: "encounter",
      foes: [layer1.boss],
      boss: true,
    })
    const events = fightToEnd(game)
    expect(events).toContainEqual({
      type: "layer-cleared",
      layer: layer1.id,
      opened: contentId("layer2"),
    })
    expect(game.state.reached).toBe(2)
    eventsOrThrow(game.send({ type: "acknowledge" }))
    expect(
      (game.send({ type: "advance", to: boss }) as GameCommandError).code
    ).toBe("AT_END")
  })
})
