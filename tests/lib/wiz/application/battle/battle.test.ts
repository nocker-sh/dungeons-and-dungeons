import { describe, expect, it } from "vite-plus/test"
import { aContent } from "@/lib/wiz/testing/content-builder"
import { aState } from "@/lib/wiz/testing/state-builder"
import { turnActionFor } from "@/lib/wiz/testing/turn-action-for"
import { battleStateOf } from "@/lib/wiz/testing/battle-state-of"
import { contentId } from "@/lib/wiz/testing/content-id"
import { foeBySlug } from "@/lib/wiz/testing/foe-by-slug"
import { memberBySlug } from "@/lib/wiz/testing/member-by-slug"
import { realContent } from "@/lib/wiz/testing/real-content"
import { catalogOf } from "@/lib/wiz/testing/catalog-of"
import { skillBySlug } from "@/lib/wiz/testing/skill-by-slug"
import { createTestGame } from "@/lib/wiz/testing/create-test-game"
import { createTestPlay } from "@/lib/wiz/testing/create-test-play"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"
import { fightToEnd } from "@/lib/wiz/testing/fight-to-end"
import { startedState } from "@/lib/wiz/testing/started-state"
import { GameCatalog } from "@/lib/wiz/content/game-catalog"
import { GameCommandError } from "@/lib/wiz/game/game-command-error"
import { GameDefinition } from "@/lib/wiz/definition/game-definition"
import { BattleRules } from "@/lib/wiz/rules/battle-rules"
import { PartyRules } from "@/lib/wiz/rules/party-rules"
import { WizWorldEnvironment } from "@/lib/wiz/core/world/world"
import type { GameEvent } from "@/lib/wiz/state/game-event"
import type { GameState } from "@/lib/wiz/state/state-schema"

const idOf = (slug: string) => memberBySlug(slug).id

describe("戦闘", () => {
  const alda = idOf("alda")
  const mort = idOf("mort")
  const mayu = idOf("mayu")
  const kamokutsu = foeBySlug("kamokutsu")

  it("[feature:W004] 後衛も攻撃できるが、後衛から近接の攻撃は被害が減る", () => {
    // モートを後衛に置く。鎚の「叩き割り」は近接、固有の「土くれ投げ」は遠距離
    const melee = skillBySlug("cleave")
    const ranged = skillBySlug("clod-throw")
    const withMelee = (factor: number) => {
      const content = aContent()
        .withBalance({ backRow: { melee: factor, hit: 1 } })
        .build()
      return createTestGame({
        content,
        random: 0.5,
        state: aState(content)
          .withParty(["alda", "mayu", "mort"])
          .inBattle({ foes: ["kamokutsu"], order: ["mort", "foe-1"] })
          .build(),
      })
    }
    const game = withMelee(0.5)
    const weakOf = (target: typeof game, member: string, skill: string) => {
      const commands = target.queries.commands(target.state, member)
      return [
        ...(commands?.weaponSkills ?? []),
        ...(commands?.skills ?? []),
      ].find((entry) => entry.id === skill)?.weak
    }
    expect(weakOf(game, mort, melee.id)).toBe(true)
    expect(weakOf(game, mort, ranged.id)).toBe(false)
    const damage = (target: typeof game) => {
      const events = eventsOrThrow(
        target.send({ type: "act", command: "skill", skill: melee.id })
      )
      const acted = events.find((event) => event.type === "acted")
      return acted?.type === "acted" ? (acted.results[0].damage ?? 0) : 0
    }
    expect(game.queries.battle(game.state)?.current).toEqual({
      kind: "member",
      id: mort,
    })
    expect(damage(game)).toBeLessThan(damage(withMelee(1)))
  })

  it("[feature:W005] 敵の近接は前衛だけを狙い、前衛のタンクは重みの分だけ狙われやすい", () => {
    const { game } = createTestPlay()
    const members = game.state.party.map((id) =>
      game.state.members.find((member) => member.id === id)!
    )
    // 並びはアルダ（タンク）・モートが前衛、マユが後衛
    expect(game.state.party).toEqual([alda, mort, mayu])
    const rulesWith = (tank: number) => {
      const catalog = new GameCatalog(
        aContent().withBalance({ tankTarget: tank }).build()
      )
      return new BattleRules(catalog, new PartyRules(catalog))
    }
    const tank = 3
    const rules = rulesWith(tank)
    const step = 0.001
    // 近接：前衛のアルダ3・モート1。境目のすぐ手前はその枠の仲間
    const melee = tank + 1
    expect(rules.target(members, () => tank / melee - step, "melee")?.id).toBe(
      alda
    )
    expect(rules.target(members, () => tank / melee + step, "melee")?.id).toBe(
      mort
    )
    // 端の乱数でも後衛には届かない
    expect(rules.target(members, () => 1 - step, "melee")?.id).toBe(mort)
    // 遠距離：後衛のマユにも重み1で届く
    const ranged = tank + 2
    expect(
      rules.target(members, () => (tank + 1) / ranged - step, "ranged")?.id
    ).toBe(mort)
    expect(rules.target(members, () => 1 - step, "ranged")?.id).toBe(mayu)
    // タンクの重みが1なら、前衛は等しく狙われる
    expect(rulesWith(1).target(members, () => 0.5 - step, "melee")?.id).toBe(
      alda
    )
    expect(rulesWith(1).target(members, () => 0.5 + step, "melee")?.id).toBe(
      mort
    )
  })

  it("[feature:W004] 一回の指示で一人分の結果だけが出て、手番が次へ回る", () => {
    const bullet = skillBySlug("magicbullet")
    const game = createTestGame({
      state: aState()
        .inBattle({ foes: ["kamokutsu"], order: ["mayu", "mort"] })
        .build(),
    })
    const events = eventsOrThrow(
      game.send({ type: "act", command: "skill", skill: bullet.id })
    )
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      type: "acted",
      actor: { kind: "member", id: mayu },
      name: bullet.name,
    })
    expect(
      game.queries
        .commands(game.state, mayu)
        ?.weaponSkills.find((skill) => skill.id === bullet.id)?.left
    ).toBe(bullet.uses! - 1)
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
        .withParty(["alda", "mayu", "mort"])
        .inBattle({
          foes: ["kamokutsu"],
          order: ["foe-1", "mayu", "alda", "mort"],
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
    // 受けた一人だけ防御が解け、狙われなかった二人は守ったまま
    expect(game.queries.battle(game.state)?.guarding).toEqual(
      game.state.party.slice(1)
    )
  })

  it("[feature:W005] 防御は自分が敵の行動を受けるか、自分の次の手番まで続く", () => {
    // 乱数0では敵は並びの一人目（アルダ）を狙う
    const game = createTestGame({
      random: 0,
      state: aState()
        .withParty(["alda", "mayu", "mort"])
        .inBattle({
          foes: ["kamokutsu", "kamokutsu"],
          order: ["alda", "mort", "foe-1", "foe-2", "mayu"],
        })
        .build(),
    })
    const [alda, , mort] = game.state.party
    const guarding = () => game.queries.battle(game.state)?.guarding
    eventsOrThrow(game.send({ type: "act", command: "guard" }))
    eventsOrThrow(game.send({ type: "act", command: "guard" }))
    expect(guarding()).toEqual([alda, mort])
    eventsOrThrow(game.send({ type: "foe-turn" }))
    // 別の仲間が狙われても、モートの防御は解けない
    expect(guarding()).toEqual([mort])
    const second = eventsOrThrow(game.send({ type: "foe-turn" }))[0] as Extract<
      GameEvent,
      { type: "acted" }
    >
    expect(second.results[0]).toMatchObject({
      target: { id: alda },
      guarded: false,
    })
    expect(guarding()).toEqual([mort])
    const mayu = game.state.party[1]
    eventsOrThrow(game.send({ type: "act", command: "guard" }))
    eventsOrThrow(game.send({ type: "act", command: "guard" }))
    expect(guarding()).toEqual([mort, mayu, alda])
    // 受けずに残った防御も、自分が次に動くときに解ける
    const attack = turnActionFor(game, mort)
    expect(attack).toMatchObject({ command: "skill" })
    eventsOrThrow(game.send(attack))
    expect(guarding()).toEqual([mayu, alda])
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
      game.queries.party(game.state).every((member) => member.exp === exp)
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
    const definition = new GameDefinition(catalogOf(realContent()))
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

  it("[feature:W005] 全滅すると、この探索で得た契約石も失い、結果に出す", () => {
    // 中ボスで石を2つ得た後の戦闘。手持ちの5つのうち、この探索の2つだけを失う
    const state = aState()
      .withStones(5)
      .inBattle({
        foes: ["kamokutsu"],
        expedition: { loot: { gold: 0, goods: [], stones: 2 } },
      })
      .build()
    const weak = createTestGame({
      random: 0.99,
      state: {
        ...state,
        members: state.members.map((member) => ({ ...member, hp: 1 })),
      },
    })
    const events = fightToEnd(weak, "guard")
    expect(events.at(-1)).toEqual({ type: "defeated" })
    expect(weak.state.stones).toBe(3)
    expect(weak.state.wipe?.stones).toBe(2)
    expect(weak.queries.result(weak.state)).toMatchObject({
      kind: "wipe",
      stones: 2,
    })
    expect(weak.restore(weak.save())).toBeUndefined()
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
