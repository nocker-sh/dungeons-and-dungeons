import { describe, expect, it } from "vite-plus/test"
import {
  aContent,
  aState,
  battleStateOf,
  contentId,
  createTestGame,
  eventsOrThrow,
  fightToEnd,
  foeBySlug,
  memberBySlug,
  questBySlug,
  realContent,
  seededRandom,
  skillBySlug,
} from "@/lib/wiz/testing"

const idOf = (slug: string) => memberBySlug(slug).id
import {
  GameCatalog,
  GameCommandError,
  PartyRules,
  type GameContent,
  type GameEvent,
  type GameState,
} from "@/lib/wiz"
import type { FoeState } from "@/lib/wiz/state"

/** 戦闘中の敵を書き換える。 */
function patchFoes(
  state: GameState,
  patch: (foe: FoeState) => Partial<FoeState>
): GameState {
  if (state.phase.type !== "battle") throw new Error("戦闘ではない")
  return {
    ...state,
    phase: {
      ...state.phase,
      battle: {
        ...state.phase.battle,
        foes: state.phase.battle.foes.map((foe) => ({
          ...foe,
          ...patch(foe),
        })),
      },
    },
  }
}

function actedOf(events: readonly GameEvent[]) {
  const acted = events.find((event) => event.type === "acted")
  if (acted?.type !== "acted") throw new Error("行動の出来事がない")
  return acted
}

function victoryOf(events: readonly GameEvent[]) {
  const victory = events.find((event) => event.type === "victory")
  if (victory?.type !== "victory") throw new Error("勝利の出来事がない")
  return victory
}

describe("手番と決着（hunt）", () => {
  const fixture = aContent().build()
  const hero = idOf("hero")
  const alda = idOf("alda")
  const mort = idOf("mort")
  // アルダの素の武器（両手剣）に付く近接のワザ
  const melee = skillBySlug("helmsplit")

  /** 一撃で敵を倒せるデータ（決着まで短くする）。 */
  const strongWeapons = (content: GameContent = fixture) =>
    aContent(content).withWeaponPower(400).build()

  it("[feature:W004] 同じ種なら出来事も状態もそっくり同じで、種を変えると変わる", () => {
    const content = fixture
    const state = aState(content)
      .inBattle({
        foes: ["kamokutsu", "koburakuda"],
        order: ["alda", "foe-1", "hero", "foe-2", "mort"],
      })
      .build()
    const run = (seed: number) => {
      const game = createTestGame({
        content,
        state,
        random: seededRandom(seed),
      })
      const events = fightToEnd(game)
      return { events, state: game.state }
    }
    const first = run(5)
    const again = run(5)
    expect(again.events).toEqual(first.events)
    expect(again.state).toEqual(first.state)
    const streams = [1, 2, 3, 4, 5].map((seed) =>
      JSON.stringify(run(seed).events)
    )
    expect(new Set(streams).size).toBeGreaterThan(1)
  })

  it("[feature:W004] 途中で保存して復元しても、続きの結果が変わらない", () => {
    const content = fixture
    const state = aState(content)
      .inBattle({
        foes: ["kamokutsu"],
        order: ["alda", "foe-1", "hero", "mort"],
      })
      .build()
    const game = createTestGame({ content, state, random: 0.5 })
    eventsOrThrow(game.send({ type: "act", command: "skill", skill: melee.id }))
    eventsOrThrow(game.send({ type: "foe-turn" }))
    const save = game.save()
    const restored = createTestGame({ content, state, random: 0.5 })
    expect(restored.restore(save)).toBeUndefined()
    expect(restored.state).toEqual(game.state)
    const events = fightToEnd(game)
    const restoredEvents = fightToEnd(restored)
    expect(restoredEvents).toEqual(events)
    expect(restored.state).toEqual(game.state)
  })

  it("[feature:W006] 勝つと経験値・金貨・落とし物が入り、戦利品の板が出る", () => {
    const content = strongWeapons()
    const state = aState(content)
      .inBattle({
        foes: ["kamokutsu", "kamokutsu"],
        order: ["alda", "hero", "mort", "foe-1", "foe-2"],
      })
      .build()
    const game = createTestGame({ content, state, random: 0.5 })
    const gold = state.gold
    const events = fightToEnd(game)
    const victory = victoryOf(events)
    const kamokutsu = foeBySlug("kamokutsu")
    expect(victory.exp).toBe(kamokutsu.exp * 2)
    expect(victory.gold).toBeGreaterThanOrEqual(kamokutsu.gold[0] * 2)
    expect(victory.gold).toBeLessThanOrEqual(kamokutsu.gold[1] * 2)
    expect(victory.boss).toBe(false)
    expect(game.state.gold).toBe(gold + victory.gold)
    expect(game.state.phase.type).toBe("expedition")
    expect(game.queries.route(game.state)?.pending?.kind).toBe("loot")
    // 落とし物は袋と今回の拾い物の両方に入る
    for (const drop of victory.goods) {
      expect(
        game.state.bag.find((entry) => entry.good === drop.good)?.count
      ).toBeGreaterThanOrEqual(drop.count)
    }
    expect(
      game.state.phase.type === "expedition" &&
        game.state.phase.expedition.loot.gold
    ).toBe(victory.gold)
  })

  it("[feature:W006] 倒れている仲間は経験値をもらえず、勝つと状態異常は消える", () => {
    const content = strongWeapons()
    const state = aState(content)
      .withMember("mort", { hp: 0 })
      .withMember("alda", { status: [{ kind: "poison", turns: 3 }] })
      .inBattle({
        foes: ["kamokutsu"],
        order: ["alda", "hero", "mort", "foe-1"],
      })
      .build()
    const game = createTestGame({ content, state, random: 0.5 })
    const victory = victoryOf(fightToEnd(game))
    expect(victory.exp).toBeGreaterThan(0)
    const expOf = (id: string) =>
      game.state.members.find((member) => member.id === id)!.exp
    expect(expOf(alda)).toBe(victory.exp)
    expect(expOf(mort)).toBe(0)
    expect(
      game.state.members.every((member) => member.status.length === 0)
    ).toBe(true)
  })

  it("[feature:W006] 討伐の進みは倒した数だけ増え、依頼の数を超えない", () => {
    const content = strongWeapons()
    const battleState = (progress: number) =>
      aState(content)
        .withQuest("q-mole", progress)
        .inBattle({
          foes: ["kamokutsu", "kamokutsu"],
          order: ["alda", "hero", "mort", "foe-1", "foe-2"],
        })
        .build()
    const quest = questBySlug("q-mole")
    const first = createTestGame({
      content,
      state: battleState(0),
      random: 0.5,
    })
    fightToEnd(first)
    expect(
      first.state.quests.find((entry) => entry.id === quest.id)?.progress
    ).toBe(2)
    const second = createTestGame({
      content,
      state: battleState(quest.count - 1),
      random: 0.5,
    })
    fightToEnd(second)
    // 依頼の数を超えない
    expect(
      second.state.quests.find((entry) => entry.id === quest.id)?.progress
    ).toBe(quest.count)
  })

  it("[feature:W005] 毒で最後の敵が倒れても勝利になる", () => {
    const content = fixture
    const base = aState(content)
      .inBattle({ foes: ["kamokutsu"], order: ["alda", "foe-1"] })
      .build()
    const state = patchFoes(base, () => ({
      hp: 1,
      maxHp: 1,
      status: [
        { kind: "poison" as const, turns: 3 },
        { kind: "bind" as const, turns: 1 },
      ],
    }))
    const game = createTestGame({ content, state, random: 0.5 })
    const events = eventsOrThrow(game.send({ type: "act", command: "guard" }))
    expect(events).toContainEqual({
      type: "skipped",
      actor: { kind: "foe", id: "foe-1" },
      status: "bind",
    })
    expect(events).toContainEqual({
      type: "ticked",
      target: { kind: "foe", id: "foe-1" },
      status: "poison",
      damage: 1,
      down: true,
    })
    expect(victoryOf(events).exp).toBeGreaterThan(0)
    expect(game.state.phase.type).toBe("expedition")
  })

  it("[feature:W004] 縛られた敵は一度だけ手番を飛ばし、次の巡りでは動く", () => {
    const content = aContent(fixture).withFoe("kamokutsu", { hp: 4000 }).build()
    const base = aState(content)
      .inBattle({ foes: ["kamokutsu"], order: ["alda", "foe-1"] })
      .build()
    const state = patchFoes(base, () => ({
      status: [{ kind: "bind" as const, turns: 1 }],
    }))
    const game = createTestGame({ content, state, random: 0.5 })
    const events = eventsOrThrow(game.send({ type: "act", command: "guard" }))
    expect(events).toContainEqual({
      type: "skipped",
      actor: { kind: "foe", id: "foe-1" },
      status: "bind",
    })
    expect(game.queries.battle(game.state)?.current).toEqual({
      kind: "member",
      id: alda,
    })
    expect(battleStateOf(game.state).foes[0].status).toEqual([])
    eventsOrThrow(game.send({ type: "act", command: "guard" }))
    expect(game.queries.battle(game.state)?.current).toEqual({
      kind: "foe",
      id: "foe-1",
    })
    eventsOrThrow(game.send({ type: "foe-turn" }))
  })

  it("[feature:W004] 倒れている敵を狙っても、生きている敵に当たる", () => {
    const content = aContent(fixture).withFoe("kamokutsu", { hp: 4000 }).build()
    const base = aState(content)
      .inBattle({
        foes: ["kamokutsu", "kamokutsu"],
        order: ["alda", "foe-1", "foe-2"],
      })
      .build()
    const state = patchFoes(base, (foe) =>
      foe.id === "foe-1" ? { hp: 0 } : {}
    )
    const game = createTestGame({ content, state, random: 0.5 })
    const acted = actedOf(
      eventsOrThrow(
        game.send({
          type: "act",
          command: "skill",
          skill: melee.id,
          target: "foe-1",
        })
      )
    )
    expect(acted.results).toHaveLength(1)
    expect(acted.results[0].target.id).toBe("foe-2")
  })

  it("[feature:W005] 全員倒れると全滅になり、拾った分を失いHP1で街へ戻る", () => {
    const content = aContent(fixture).withFoe("kamokutsu", { atk: 999 }).build()
    const state = aState(content)
      .withGold(100)
      .withBag([{ good: contentId("potion"), count: 2 }])
      .withMembers((member) => (member.id === alda ? { hp: 1 } : { hp: 0 }))
      .inBattle({
        foes: ["kamokutsu"],
        order: ["foe-1", "alda", "hero", "mort"],
        expedition: {
          loot: { gold: 40, goods: [{ good: contentId("potion"), count: 1 }] },
        },
      })
      .build()
    const game = createTestGame({ content, state, random: 0 })
    const events = eventsOrThrow(game.send({ type: "foe-turn" }))
    expect(events.at(-1)).toEqual({ type: "defeated" })
    expect(game.state.phase.type).toBe("town")
    expect(game.state.gold).toBe(60)
    expect(game.state.bag).toEqual([{ good: contentId("potion"), count: 1 }])
    expect(game.state.wipe).toEqual({
      layer: contentId("layer0"),
      gold: 40,
      goods: [{ good: contentId("potion"), count: 1 }],
    })
    expect(
      game.queries.party(game.state).every((member) => member.hp === 1)
    ).toBe(true)
  })

  it("[feature:W005] 敵を倒し切っても仲間が全員倒れていれば全滅になる", () => {
    // 最後の一人が毒で倒れながら最後の敵を倒す場面。
    // 勝利にすると全員倒れたまま探索が続き、次の戦闘で誰も動けなくなる
    const content = aContent(fixture)
      .withFoe("kamokutsu", { hp: 1, atk: 1 })
      .build()
    const state = aState(content)
      .withWeaponSkills("hero", ["shears"])
      .withGold(100)
      .withMembers((member) =>
        member.id === hero
          ? { hp: 1, status: [{ kind: "poison", turns: 3 }] }
          : { hp: 0 }
      )
      .inBattle({
        foes: ["kamokutsu"],
        order: ["hero", "foe-1"],
        expedition: { loot: { gold: 40, goods: [] } },
      })
      .build()
    const game = createTestGame({ content, state, random: 0.5 })
    const events = eventsOrThrow(
      game.send({ type: "act", command: "skill", skill: contentId("shears") })
    )
    expect(events.some((event) => event.type === "victory")).toBe(false)
    expect(events.at(-1)).toEqual({ type: "defeated" })
    expect(game.state.phase.type).toBe("town")
    expect(game.state.gold).toBe(60)
    expect(
      game.queries.party(game.state).every((member) => member.hp === 1)
    ).toBe(true)
  })

  it("[feature:W005] 毒で最後の一人が倒れても全滅になる", () => {
    const content = aContent(fixture).withFoe("kamokutsu", { hp: 4000 }).build()
    const state = aState(content)
      .withMembers((member) =>
        member.id === alda
          ? { hp: 1, status: [{ kind: "poison", turns: 3 }] }
          : { hp: 0 }
      )
      .inBattle({ foes: ["kamokutsu"], order: ["alda", "foe-1"] })
      .build()
    const game = createTestGame({ content, state, random: 0.5 })
    const events = eventsOrThrow(game.send({ type: "act", command: "guard" }))
    expect(events).toContainEqual({
      type: "ticked",
      target: { kind: "member", id: alda },
      status: "poison",
      // 削られるのは残っていたHPの分だけ（毒の量は14でもHPは1しかない）
      damage: 1,
      down: true,
    })
    expect(events.at(-1)).toEqual({ type: "defeated" })
    expect(game.state.phase.type).toBe("town")
  })

  it("[feature:W006] ボスでない戦闘では層が開かず、踏破にもならない", () => {
    const content = strongWeapons()
    const state = aState(content)
      .inBattle({
        foes: ["kamokutsu"],
        order: ["alda", "hero", "mort", "foe-1"],
      })
      .build()
    const game = createTestGame({ content, state, random: 0.5 })
    const events = fightToEnd(game)
    expect(events.some((event) => event.type === "layer-cleared")).toBe(false)
    expect(events.some((event) => event.type === "game-cleared")).toBe(false)
    expect(game.state.reached).toBe(0)
    expect(game.state.cleared).toBe(false)
    expect(
      game.state.phase.type === "expedition" &&
        game.state.phase.expedition.cleared
    ).toBe(false)
  })

  it("[feature:W002] 中ボスの地点は決まった敵が出るが、勝っても層は開かない", () => {
    const midboss = realContent().layers[0].boss
    const content = aContent(strongWeapons())
      .withStation("layer0", "n2", {
        event: "midboss",
        discovery: undefined,
        foes: [midboss],
      })
      .build()
    const state = aState(content)
      .inExpedition({ at: "n1", visited: ["s", "n1"] })
      .build()
    const game = createTestGame({ content, state, random: 0.5 })
    const arrived = eventsOrThrow(game.send({ type: "advance", to: "n2" }))
    expect(arrived).toContainEqual({
      type: "encounter",
      foes: [midboss],
      boss: false,
    })
    expect(game.queries.battle(game.state)?.midboss).toBe(true)
    expect(game.queries.battle(game.state)?.boss).toBe(false)
    const events = fightToEnd(game)
    expect(victoryOf(events).boss).toBe(false)
    expect(events.some((event) => event.type === "layer-cleared")).toBe(false)
    expect(game.state.reached).toBe(0)
  })

  it("[feature:W004] 手番の番号が行動順の長さを超えても順に巡る", () => {
    const content = aContent(fixture).withFoe("kamokutsu", { hp: 4000 }).build()
    const state = aState(content)
      .inBattle({
        foes: ["kamokutsu"],
        order: ["alda", "hero", "mort", "foe-1"],
        turn: 97,
      })
      .build()
    const game = createTestGame({ content, state, random: 0.5 })
    // 97 % 5 = 2 → 行動順の3人目
    expect(game.queries.battle(game.state)?.current).toEqual({
      kind: "member",
      id: hero,
    })
    eventsOrThrow(game.send({ type: "act", command: "guard" }))
    expect(battleStateOf(game.state).turn).toBe(98)
    expect(game.queries.battle(game.state)?.current).toEqual({
      kind: "member",
      id: mort,
    })
  })

  it("[feature:W004] 勝った後は戦闘の指示を送れない", () => {
    const content = strongWeapons()
    const state = aState(content)
      .inBattle({
        foes: ["kamokutsu"],
        order: ["alda", "hero", "mort", "foe-1"],
      })
      .build()
    const game = createTestGame({ content, state, random: 0.5 })
    fightToEnd(game)
    const before = game.state
    for (const action of [
      { type: "act", command: "guard" } as const,
      { type: "foe-turn" } as const,
    ]) {
      const error = game.send(action)
      expect(error).toBeInstanceOf(GameCommandError)
      expect((error as GameCommandError).code).toBe("WRONG_PHASE")
      expect(game.state).toBe(before)
    }
  })

  it("[feature:W004] 起こした仲間は次の巡りで手番をもらえる", () => {
    const content = aContent(fixture).withFoe("kamokutsu", { hp: 4000 }).build()
    const state = aState(content)
      .withJoined("sion", { replacing: "mort" })
      .withWeaponSkills("sion", ["revival-light"])
      .withMember("alda", { hp: 0 })
      .inBattle({ foes: ["kamokutsu"], order: ["sion", "alda", "foe-1"] })
      .build()
    const game = createTestGame({ content, state, random: 0.5 })
    const acted = actedOf(
      eventsOrThrow(
        game.send({
          type: "act",
          command: "skill",
          skill: skillBySlug("revival-light").id,
        })
      )
    )
    expect(acted.results[0]).toMatchObject({
      target: { kind: "member", id: alda },
      revived: true,
    })
    expect(game.queries.member(game.state, alda)!.hp).toBeGreaterThan(0)
    expect(game.queries.battle(game.state)?.current).toEqual({
      kind: "member",
      id: alda,
    })
    eventsOrThrow(game.send({ type: "act", command: "guard" }))
  })

  it("[feature:W005] 敵の遠距離の全体ワザは生きている仲間全員に一度ずつ当たり、近接は前衛だけに当たる", () => {
    const hitsOf = (skill: string, down: string | null) => {
      const content = aContent(fixture)
        .withFoe("kamokutsu", {
          hp: 4000,
          skills: [contentId(skill)],
          skillRate: 1,
        })
        .build()
      let builder = aState(content)
      if (down) builder = builder.withMember(down, { hp: 0 })
      const state = builder
        .inBattle({
          foes: ["kamokutsu"],
          order: ["foe-1", "alda", "hero", "mort"],
        })
        .build()
      // 乱数0.5は後衛への遠距離の命中（backRow.hit）より下なので当たる
      const game = createTestGame({ content, state, random: 0.5 })
      const acted = actedOf(eventsOrThrow(game.send({ type: "foe-turn" })))
      for (const result of acted.results)
        expect(result.damage).toBeGreaterThanOrEqual(1)
      return { state, ids: acted.results.map((result) => result.target.id) }
    }
    // 遠距離（結晶の雨）は後衛にも届き、倒れた仲間には当たらない
    expect(skillBySlug("crystal-spray").reach).toBe("ranged")
    const ranged = hitsOf("crystal-spray", null)
    expect(ranged.ids).toEqual(ranged.state.party)
    const rangedDown = hitsOf("crystal-spray", "alda")
    expect(rangedDown.ids).toEqual(
      rangedDown.state.party.filter((id) => id !== alda)
    )
    // 近接（回転斬り）は前衛の2人だけ
    expect(skillBySlug("whirl").reach).toBe("melee")
    const melee = hitsOf("whirl", null)
    expect(melee.ids).toEqual(melee.state.party.slice(0, 2))
    expect(melee.ids).not.toContain(mort)
  })

  // 本物の作品データでは決着まで手番が多いので、待つ時間を長めに取る
  it(
    "[feature:W004] どの種でも戦闘を終えたときの値が枠の内側に収まる",
    { timeout: 30000 },
    () => {
      const content = fixture
      const catalog = new GameCatalog(content)
      const party = new PartyRules(catalog)
      for (let seed = 1; seed <= 15; seed++) {
        const state = aState(content)
          .inBattle({
            foes: ["kamokutsu", "koburakuda"],
            order: ["alda", "foe-1", "hero", "foe-2", "mort"],
          })
          .build()
        const game = createTestGame({
          content,
          state,
          random: seededRandom(seed),
        })
        fightToEnd(game)
        const now = game.state
        expect(["expedition", "town"], `seed ${seed}`).toContain(now.phase.type)
        expect(now.gold, `seed ${seed}`).toBeGreaterThanOrEqual(0)
        for (const member of now.members) {
          const stats = party.stats(member, now)
          expect(member.hp, `${member.id} seed ${seed}`).toBeGreaterThanOrEqual(
            0
          )
          expect(member.hp, `${member.id} seed ${seed}`).toBeLessThanOrEqual(
            stats.maxHp
          )
          for (const entry of member.used) {
            const max = party.skills.maxUses(member, now, entry.skill)
            expect(entry.count, `${member.id}/${entry.skill}`).toBeGreaterThan(
              0
            )
            if (max !== null)
              expect(
                entry.count,
                `${member.id}/${entry.skill}`
              ).toBeLessThanOrEqual(max)
          }
          for (const entry of member.status)
            expect(entry.turns, `${member.id} の状態`).toBeGreaterThan(0)
        }
        for (const gear of now.gear) {
          const good = catalog.good(gear.good)
          expect(gear.wear, gear.id).toBeGreaterThanOrEqual(0)
          expect(gear.wear, gear.id).toBeLessThanOrEqual(
            party.equipment.maxDurabilityOf(good ?? {}, gear.plus)
          )
        }
        for (const entry of now.bag) expect(entry.count).toBeGreaterThan(0)
      }
    }
  )
})
