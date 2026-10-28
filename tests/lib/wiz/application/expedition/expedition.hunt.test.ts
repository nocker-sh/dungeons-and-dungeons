import { describe, expect, it } from "vite-plus/test"
import { GameStateBuilder, aState } from "@/lib/wiz/testing/state-builder"
import { SequenceRandom } from "@/lib/wiz/testing/sequence-random"
import { aContent } from "@/lib/wiz/testing/content-builder"
import { contentId } from "@/lib/wiz/testing/content-id"
import { memberBySlug } from "@/lib/wiz/testing/member-by-slug"
import { realContent } from "@/lib/wiz/testing/real-content"
import { createTestGame } from "@/lib/wiz/testing/create-test-game"
import { createTestPlay } from "@/lib/wiz/testing/create-test-play"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"
import { fightToEnd } from "@/lib/wiz/testing/fight-to-end"
import { seededRandom } from "@/lib/wiz/testing/seeded-random"
import { sequentialIds } from "@/lib/wiz/testing/sequential-ids"
import { GameCommandError } from "@/lib/wiz/game/game-command-error"
import { phaseOf } from "@/lib/wiz/phases/phase-of"
import type { GameAction } from "@/lib/wiz/commands"

const idOf = (slug: string) => memberBySlug(slug).id
/** 0層の終点（ボスの地点）。 */
const bossStation = realContent().layers[0].stations.find(
  (station) => station.boss
)!.id

/** 探索（出撃・進む・撤退・板）の不変条件をさがす。 */
describe("探索の不変条件", () => {
  const trapAt = (station: string) =>
    aContent()
      .withStation("layer0", station, { event: "trap", discovery: undefined })
      .build()
  const treasureAt = (station: string) =>
    aContent()
      .withLayerFoes("layer0", ["hiyokobu"])
      .withLayer("layer0", { group: [1, 1] })
      .withStation("layer0", station, {
        event: "treasure",
        discovery: undefined,
      })
      .build()

  it("[feature:W001] 疲れは99なら出撃でき、100で拒否される（境界）", () => {
    for (const [fatigue, code] of [
      [98, null],
      [99, null],
      [100, "TIRED"],
    ] as const) {
      const state = aState().withMember("alda", { fatigue }).build()
      const game = createTestGame({ state })
      const result = game.send({ type: "depart", layer: contentId("layer0") })
      if (code === null) expect(game.state.phase.type).toBe("expedition")
      else {
        expect((result as GameCommandError).code).toBe(code)
        expect(game.state.phase.type).toBe("town")
      }
    }
  })

  it("[feature:W001] 拒否された出撃は状態も乱数も消費しない", () => {
    for (const state of [
      aState().withMember("alda", { hp: 0 }).build(),
      aState().withMember("mort", { fatigue: 100 }).build(),
      aState().build(),
    ]) {
      const random = new SequenceRandom([0.1, 0.2, 0.3])
      const game = createTestGame({ state, random: random.next })
      const before = game.state
      const result = game.send({ type: "depart", layer: contentId("layer3") })
      expect(result).toBeInstanceOf(GameCommandError)
      expect(game.state).toBe(before)
      expect(random.used).toBe(0)
    }
  })

  it("[feature:W001] 控えが倒れて疲れ切っていても出撃できる（見るのは出撃の4人だけ）", () => {
    const { definition, game } = createTestPlay()
    eventsOrThrow(game.send({ type: "recruit", recruit: contentId("r-jig") }))
    eventsOrThrow(
      game.send({ type: "swap", out: idOf("mort"), in: idOf("jig") })
    )
    const state = GameStateBuilder.from(game.state, definition.catalog)
      .withMember("mort", { hp: 0, fatigue: 100 })
      .build()
    const withReserve = createTestGame({ state })
    eventsOrThrow(
      withReserve.send({ type: "depart", layer: contentId("layer0") })
    )
    expect(withReserve.state.phase.type).toBe("expedition")
    expect(withReserve.queries.readiness(withReserve.state).ready).toBe(true)
  })

  it("[feature:W001] 出撃のたびに探索は空から始まり、前回の拾い物や通過した地点を引き継がない", () => {
    const content = treasureAt("n2")
    const game = createTestGame({ content })
    eventsOrThrow(game.send({ type: "depart", layer: contentId("layer0") }))
    eventsOrThrow(game.send({ type: "advance", to: "n1" }))
    fightToEnd(game)
    eventsOrThrow(game.send({ type: "acknowledge" }))
    eventsOrThrow(game.send({ type: "advance", to: "n2" }))
    eventsOrThrow(game.send({ type: "acknowledge" }))
    const carried = game.queries.expedition(game.state)!
    expect(carried.loot.gold).toBeGreaterThan(0)
    eventsOrThrow(game.send({ type: "retreat" }))
    eventsOrThrow(game.send({ type: "depart", layer: contentId("layer0") }))
    expect(game.queries.expedition(game.state)).toMatchObject({
      layer: contentId("layer0"),
      at: "s",
      visited: ["s"],
      events: [],
      pending: null,
      loot: { gold: 0, goods: [] },
      cleared: false,
    })
  })

  it("[feature:W002] 板を閉じるまで進めず、拒否は状態も乱数も変えない", () => {
    const random = new SequenceRandom([0.5, 0.5, 0.5, 0.5], 0.5)
    const game = createTestGame({
      content: treasureAt("n2"),
      random: random.next,
    })
    eventsOrThrow(game.send({ type: "depart", layer: contentId("layer0") }))
    eventsOrThrow(game.send({ type: "advance", to: "n1" }))
    fightToEnd(game)
    eventsOrThrow(game.send({ type: "acknowledge" }))
    eventsOrThrow(game.send({ type: "advance", to: "n2" }))
    const before = game.state
    const used = random.used
    const result = game.send({ type: "advance", to: "n3" })
    expect((result as GameCommandError).code).toBe("PENDING")
    expect(game.state).toBe(before)
    expect(random.used).toBe(used)
  })

  it("[feature:W002] 隣でない地点・知らない地点へは進めず、乱数も疲れも動かない", () => {
    const random = new SequenceRandom([], 0.5)
    const game = createTestGame({ random: random.next })
    eventsOrThrow(game.send({ type: "depart", layer: contentId("layer0") }))
    const before = game.state
    for (const [to, code] of [
      ["n4", "NOT_NEXT"],
      ["no-such-station", "NOT_NEXT"],
      ["s", "NOT_NEXT"],
    ] as const) {
      const result = game.send({ type: "advance", to })
      expect((result as GameCommandError).code).toBe(code)
      expect(game.state).toBe(before)
      expect(random.used).toBe(0)
    }
  })

  it("[feature:W002] 終点に着いた後は進めない（AT_END）", () => {
    const game = createTestGame({
      state: aState()
        .inExpedition({
          at: bossStation,
          visited: ["s", bossStation],
          cleared: true,
        })
        .build(),
    })
    const result = game.send({ type: "advance", to: bossStation })
    expect((result as GameCommandError).code).toBe("AT_END")
  })

  it("[feature:W002] 進むと出撃の4人だけ疲れと汚れが増え、控えは変わらない", () => {
    const base = createTestGame()
    eventsOrThrow(base.send({ type: "recruit", recruit: contentId("r-jig") }))
    const withReserve = base.state
    const game = createTestGame({ state: withReserve, content: trapAt("n1") })
    eventsOrThrow(game.send({ type: "depart", layer: contentId("layer0") }))
    eventsOrThrow(game.send({ type: "advance", to: "n1" }))
    const { wear } = realContent().balance
    for (const member of game.state.members) {
      const expected = game.state.party.includes(member.id)
        ? { fatigue: wear.fatigue, dirt: wear.dirt }
        : { fatigue: 0, dirt: 0 }
      expect([member.id, member.fatigue, member.dirt]).toEqual([
        member.id,
        expected.fatigue,
        expected.dirt,
      ])
    }
  })

  it("[feature:W002] 疲れと汚れは100で止まる", () => {
    const game = createTestGame({
      content: trapAt("n1"),
      state: aState()
        .withMembers({ fatigue: 99, dirt: 98 })
        .inExpedition()
        .build(),
    })
    eventsOrThrow(game.send({ type: "advance", to: "n1" }))
    for (const member of game.state.members) {
      expect(member.fatigue).toBe(100)
      expect(member.dirt).toBe(100)
    }
  })

  it("[feature:W002] 罠では倒れず、すでに倒れている仲間のHPは0のまま", () => {
    const game = createTestGame({
      content: trapAt("n1"),
      state: aState()
        .withMember("alda", { hp: 3 })
        .withMember("mort", { hp: 0 })
        .inExpedition()
        .build(),
    })
    const events = eventsOrThrow(game.send({ type: "advance", to: "n1" }))
    // 乱数0.5の基礎被害に、生存しているアルダの罠対策を適用する。
    const [least, most] = realContent().layers[0].trap
    const damage = Math.ceil(Math.round(least + (most - least) * 0.5) * 0.75)
    expect(events).toContainEqual({ type: "trap", damage })
    const hp = (id: string) =>
      game.state.members.find((member) => member.id === id)!.hp
    expect(hp(idOf("alda"))).toBe(1)
    expect(hp(idOf("mort"))).toBe(0)
    for (const member of game.state.members)
      expect(member.hp).toBeGreaterThanOrEqual(0)
  })

  it("[feature:W002] 宝箱は袋と拾い物の両方に入り、二重に数えない", () => {
    const game = createTestGame({ content: treasureAt("n1") })
    const gold = game.state.gold
    const owned = (good: string) =>
      game.state.bag.find((entry) => entry.good === good)?.count ?? 0
    const before = new Map(
      realContent().layers[0].treasure.goods.map((entry) => [
        entry.good,
        owned(entry.good),
      ])
    )
    eventsOrThrow(game.send({ type: "depart", layer: contentId("layer0") }))
    const events = eventsOrThrow(game.send({ type: "advance", to: "n1" }))
    const treasure = events.find((event) => event.type === "treasure")!
    // 宝は層の表から1種類。金貨は層の範囲（深さの手当てつき）
    const [least, most] = realContent().layers[0].treasure.gold
    expect(treasure.gold).toBeGreaterThanOrEqual(least)
    expect(treasure.goods.length).toBe(1)
    expect([...before.keys()]).toContain(treasure.goods[0].good)
    expect(most).toBeGreaterThan(0)
    // 袋と拾い物の両方に入り、二重に数えない
    expect(game.state.gold).toBe(gold + treasure.gold)
    for (const entry of treasure.goods)
      expect(owned(entry.good)).toBe(
        (before.get(entry.good) ?? 0) + entry.count
      )
    expect(game.queries.expedition(game.state)!.loot).toEqual({
      gold: treasure.gold,
      goods: treasure.goods,
    })
  })

  it("[feature:W002] 分岐はどちらへも進めるが、通ったのは選んだ方だけ", () => {
    const at = { at: "n4", visited: ["s", "n1", "n2", "n3", "n4"] }
    for (const to of ["u5", "l5"]) {
      const game = createTestGame({
        content: trapAt(to),
        state: aState().inExpedition(at).build(),
      })
      expect(game.queries.route(game.state)!.choices).toEqual(["u5", "l5"])
      eventsOrThrow(game.send({ type: "advance", to }))
      const expedition = game.queries.expedition(game.state)!
      expect(expedition.at).toBe(to)
      expect(expedition.visited).toEqual([...at.visited, to])
      const other = to === "u5" ? "l5" : "u5"
      expect(expedition.visited).not.toContain(other)
      // 通っていない分岐の地点には出来事が付かない
      const stations = game.queries.route(game.state)!.stations
      expect(stations.find((station) => station.id === other)?.event).toBeNull()
      expect(stations.find((station) => station.id === to)?.event).toBe("trap")
    }
  })

  it("[feature:W002] 終点ではボスが出て、倒すと次の層が開いて踏破の印が付く", () => {
    const beforeBoss = realContent().layers[0].stations.find((station) =>
      station.next.includes(bossStation)
    )!.id
    const game = createTestGame({
      content: aContent().withWeaponPower(900).build(),
      state: aState()
        .inExpedition({ at: beforeBoss, visited: ["s", beforeBoss] })
        .withMembers({
          lv: 30,
          stats: { maxHp: 900, str: 60, tec: 60, spd: 20 },
        })
        .build(),
    })
    const events = eventsOrThrow(
      game.send({ type: "advance", to: bossStation })
    )
    expect(events).toContainEqual({
      type: "encounter",
      foes: [realContent().layers[0].boss],
      boss: true,
    })
    expect(game.queries.battle(game.state)).toMatchObject({ boss: true })
    fightToEnd(game)
    expect(game.state.reached).toBe(1)
    expect(game.queries.expedition(game.state)!.cleared).toBe(true)
    expect(game.state.cleared).toBe(false)
    // ボスを倒した後は終点から先へ進めない
    eventsOrThrow(game.send({ type: "acknowledge" }))
    expect(
      (game.send({ type: "advance", to: bossStation }) as GameCommandError).code
    ).toBe("AT_END")
  })

  it("[feature:W006] 板がないときに閉じると NOT_READY で状態は変わらない", () => {
    const game = createTestGame({ state: aState().inExpedition().build() })
    const before = game.state
    expect((game.send({ type: "acknowledge" }) as GameCommandError).code).toBe(
      "NOT_READY"
    )
    expect(game.state).toBe(before)
    const town = createTestGame()
    expect((town.send({ type: "acknowledge" }) as GameCommandError).code).toBe(
      "WRONG_PHASE"
    )
  })

  it("[feature:W006] 板を閉じても拾い物・地点・金貨は変わらない", () => {
    const game = createTestGame({ content: treasureAt("n1") })
    eventsOrThrow(game.send({ type: "depart", layer: contentId("layer0") }))
    eventsOrThrow(game.send({ type: "advance", to: "n1" }))
    const before = game.state
    eventsOrThrow(game.send({ type: "acknowledge" }))
    expect(game.state.gold).toBe(before.gold)
    expect(game.state.bag).toEqual(before.bag)
    expect(game.queries.expedition(game.state)).toEqual({
      ...(before.phase.type === "expedition"
        ? before.phase.expedition
        : undefined),
      pending: null,
    })
  })

  it("[feature:W003] 戦闘中は撤退できず、状態を変えない", () => {
    const game = createTestGame()
    eventsOrThrow(game.send({ type: "depart", layer: contentId("layer0") }))
    eventsOrThrow(game.send({ type: "advance", to: "n1" }))
    const before = game.state
    expect((game.send({ type: "retreat" }) as GameCommandError).code).toBe(
      "WRONG_PHASE"
    )
    expect(game.state).toBe(before)
    expect(
      (createTestGame().send({ type: "retreat" }) as GameCommandError).code
    ).toBe("WRONG_PHASE")
  })

  it("[feature:W003] 板が出ていても撤退でき、拾い物はそのまま持ち帰る", () => {
    const game = createTestGame({ content: treasureAt("n1") })
    eventsOrThrow(game.send({ type: "depart", layer: contentId("layer0") }))
    eventsOrThrow(game.send({ type: "advance", to: "n1" }))
    const gold = game.state.gold
    const loot = game.queries.expedition(game.state)!.loot
    const events = eventsOrThrow(game.send({ type: "retreat" }))
    expect(events[0]).toMatchObject({
      type: "returned",
      gold: loot.gold,
      goods: loot.goods,
    })
    expect(game.state.phase.type).toBe("town")
    expect(game.state.gold).toBe(gold)
  })

  it("[feature:W002] 全員が倒れたまま次の地点へは進めない（進めると戦闘で手が止まる）", () => {
    // 保存の形としては通る状態：出撃の4人が全員倒れたまま探索中。
    // ここから進むと、誰も手番を持てない戦闘に入って撤退もできなくなる。
    const state = aState()
      .withMembers({ hp: 0 })
      .inExpedition({ at: "n1", visited: ["s", "n1"] })
      .build()
    const game = createTestGame({ state, random: 0.1 })
    const before = game.state
    const result = game.send({ type: "advance", to: "n2" })
    expect((result as GameCommandError).code).toBe("DOWN")
    expect(game.state).toBe(before)
    // 撤退という出口は残る
    eventsOrThrow(game.send({ type: "retreat" }))
    expect(game.state.phase.type).toBe("town")
  })

  it("[feature:W005] 全員が倒れた手番は、敵を倒し切っていても全滅になる", () => {
    const content = aContent().withFoe("kamokutsu", { hp: 10 }).build()
    const state = aState(content)
      .withWeaponSkills("alda", ["whirl"])
      .withMembers((member) =>
        member.id === idOf("alda")
          ? { hp: 1, status: [{ kind: "poison", turns: 3 }] }
          : { hp: 0 }
      )
      .inBattle({ foes: ["kamokutsu"], order: ["alda", "foe-1"] })
      .build()
    const game = createTestGame({ content, state, random: 0.1 })
    // 毒で最後の一人が倒れた手で敵も倒れる
    const events = eventsOrThrow(
      game.send({ type: "act", command: "skill", skill: contentId("whirl") })
    )
    expect(events.map((event) => event.type)).toContain("defeated")
    expect(game.state.phase.type).toBe("town")
    expect(game.state.wipe).not.toBeNull()
    for (const member of game.queries.party(game.state))
      expect(member.hp).toBe(1)
  })

  it("[feature:W002] 同じ種の乱数なら同じ探索になる（再現できる）", () => {
    const play = (seed: number) => {
      const game = createTestGame({ random: seededRandom(seed) })
      const events: string[] = []
      eventsOrThrow(game.send({ type: "depart", layer: contentId("layer0") }))
      for (const to of ["n1", "n2", "n3", "n4"]) {
        if (game.state.phase.type === "battle") fightToEnd(game)
        const discovery = game.queries.route(game.state)?.discovery
        if (discovery) {
          const choice = discovery.choices.find(
            (entry) => !entry.blessings?.length
          )!
          eventsOrThrow(game.send({ type: "discover", choice: choice.id }))
        }
        if (
          game.state.phase.type === "expedition" &&
          game.state.phase.expedition.pending
        )
          eventsOrThrow(game.send({ type: "acknowledge" }))
        if (game.state.phase.type !== "expedition") break
        for (const event of eventsOrThrow(game.send({ type: "advance", to })))
          events.push(event.type)
      }
      return { events, state: JSON.stringify(game.state) }
    }
    for (const seed of [1, 7, 23, 99]) {
      const first = play(seed)
      const second = play(seed)
      expect(second.events).toEqual(first.events)
      expect(second.state).toBe(first.state)
    }
  })

  it(
    "[feature:W002] どの種でも探索を回し切って不変条件を保つ",
    { timeout: 30000 },
    () => {
      for (let seed = 1; seed <= 8; seed++) {
        const random = seededRandom(seed)
        const game = createTestGame({ random })
        eventsOrThrow(game.send({ type: "depart", layer: contentId("layer0") }))
        for (let step = 0; step < 300; step++) {
          const phase = phaseOf(game)
          if (phase.kind === "town") break
          if (phase.kind === "foe-turn") {
            const result = phase.resolve()
            if (result instanceof GameCommandError)
              throw new Error(`${seed}: 敵の手番が ${result.code}`)
          } else if (phase.kind === "member-turn") {
            fightToEnd(game)
          } else if (phase.kind === "pending") {
            const discovery = game.queries.route(game.state)?.discovery
            // 払えない・条件を満たさない選択肢は選ばない（無ければ立ち去る）
            const choice = discovery?.choices.find(
              (entry) => entry.available && !entry.blessings?.length
            )
            const result = choice
              ? phase.discover(choice.id)
              : phase.acknowledge()
            if (result instanceof GameCommandError)
              throw new Error(`${seed}: 板が ${result.code}`)
          } else {
            const choices = game.queries.route(game.state)!.choices
            if (!choices.length) {
              eventsOrThrow(game.send({ type: "retreat" }))
              break
            }
            const to = choices[Math.floor(random() * choices.length)]
            const result = game.send({ type: "advance", to })
            if (result instanceof GameCommandError) {
              expect(result.code).toBe("DOWN")
              eventsOrThrow(game.send({ type: "retreat" }))
              break
            }
          }
          const state = game.state
          expect(state.gold).toBeGreaterThanOrEqual(0)
          for (const member of state.members) {
            expect(member.hp).toBeGreaterThanOrEqual(0)
            expect(member.fatigue).toBeLessThanOrEqual(100)
            expect(member.dirt).toBeLessThanOrEqual(100)
          }
          for (const gear of state.gear)
            expect(gear.wear).toBeGreaterThanOrEqual(0)
          for (const entry of state.bag) expect(entry.count).toBeGreaterThan(0)
        }
      }
    }
  )

  it("[feature:W002] 探索の途中の保存は同じ状態へ戻る（板つき）", () => {
    const game = createTestGame({ content: treasureAt("n1") })
    eventsOrThrow(game.send({ type: "depart", layer: contentId("layer0") }))
    eventsOrThrow(game.send({ type: "advance", to: "n1" }))
    const saved = JSON.parse(JSON.stringify(game.save()))
    const before = JSON.parse(JSON.stringify(game.state))
    const restored = createTestGame({ content: treasureAt("n1") })
    expect(restored.restore(saved)).toBeUndefined()
    // 項目の並び順は問わない（読み込んだ状態は保存の形の順に並ぶ）
    expect(JSON.parse(JSON.stringify(restored.state))).toStrictEqual(before)
    expect(restored.state.phase.type).toBe("expedition")
    eventsOrThrow(restored.send({ type: "acknowledge" }))
    eventsOrThrow(restored.send({ type: "advance", to: "n2" }))
  })

  it(
    "[feature:W002] でたらめな操作の並びでもエンジンは壊れず、HPは最大を超えない",
    { timeout: 30000 },
    () => {
      // 装備で最大HPが増える・減るデータにして、付け外しの取りこぼしも見る
      const content = aContent()
        .withGood("leather", { bonus: { maxHp: 20 } })
        .withGood("mail", { bonus: { maxHp: -30, spd: -1 } })
        .build()
      const failures: string[] = []
      const stations = realContent().layers[0].stations.map(
        (station) => station.id
      )
      for (let seed = 1; seed <= 6; seed++) {
        const random = seededRandom(seed)
        const game = createTestGame({
          content,
          random,
          ids: sequentialIds(`s${seed}`),
        })
        const one = <T>(list: readonly T[]) =>
          list[Math.floor(random() * list.length)]
        for (let step = 0; step < 120; step++) {
          const state = game.state
          const gear = state.gear.map((entry) => entry.id)
          const members = state.members.map((member) => member.id)
          const goods = state.bag.map((entry) => entry.good)
          const result = game.send(
            one([
              {
                type: "depart",
                layer: one(["layer0", "layer1"].map(contentId)),
              },
              { type: "advance", to: one(stations) },
              { type: "retreat" },
              { type: "acknowledge" },
              { type: "equip", gear: one(gear), member: one(members) },
              { type: "unequip", gear: one(gear) },
              { type: "swap", out: one(members), in: one(members) },
              { type: "swap-rows", a: one(members), b: one(members) },
              {
                type: "use",
                good: one(goods),
                member: one([...members, undefined]),
              },
              {
                type: "rest",
                room: one(["attic", "normal", "deluxe"].map(contentId)),
              },
              {
                type: "buy",
                shop: contentId("armory"),
                good: one(["leather", "mail"].map(contentId)),
              },
              {
                type: "recruit",
                recruit: one(["r-jig", "n-luca"].map(contentId)),
              },
              {
                type: "act",
                command: one(["skill", "guard", "item", "brawl"]),
                skill: one(
                  ["whirl", "charge", "focus", "prayer"].map(contentId)
                ),
                good: one(goods),
                target: one([...members, "foe-1", undefined]),
              },
              { type: "foe-turn" },
            ] satisfies GameAction[])
          )
          if (
            result instanceof GameCommandError &&
            (result.code === "ENGINE_FAILURE" || result.code === "INVALID_SAVE")
          )
            failures.push(
              `${seed}/${step}: ${result.code} ${String(result.cause)}`
            )
          for (const member of game.state.members) {
            const view = game.queries.member(game.state, member.id)!
            if (member.hp > view.maxHp)
              failures.push(
                `${seed}/${step}: ${member.id} の HP ${member.hp} が最大 ${view.maxHp} を超えた`
              )
          }
        }
      }
      expect(failures.slice(0, 5)).toEqual([])
    }
  )
})
