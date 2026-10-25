import { describe, expect, it } from "vite-plus/test"
import {
  GameCommandError,
  GameDefinition,
  type Game,
  type GameAction,
  type GameState,
} from "@/lib/wiz"
import {
  GameStateBuilder,
  InMemorySaveStore,
  contentId,
  realContent,
  seededRandom,
  sequentialIds,
  startedState,
  testEnvironment,
  turnActionFor,
} from "@/lib/wiz/testing"
import type { Random } from "@/lib/wiz/rules"

const definition = new GameDefinition(realContent())

/** 鍛冶屋・鑑定・売り買いまで届くように、素材と金貨を持たせた街から始める。 */
function startingState() {
  return GameStateBuilder.from(startedState(definition), definition.catalog)
    .withGold(3000)
    .withItem("bone", 9)
    .withItem("cinder", 5)
    .withItem("crystal", 5)
    .withItem("junk", 9)
    .build()
}

function playOf(seed: number) {
  return definition.create(
    testEnvironment({ random: seededRandom(seed), ids: sequentialIds("gear") }),
    startingState()
  )
}

function pickOne<T>(random: Random, list: readonly T[]): T {
  return list[Math.min(list.length - 1, Math.floor(random() * list.length))]
}

/** いまの場面から送れそうな操作を並べる。断られても状態は変わらないので選び放題。 */
function choices(game: Game, random: Random): GameAction[] {
  const state = game.state
  const queries = game.queries
  if (state.phase.type === "battle") {
    const view = queries.battle(state)!
    if (view.current.kind === "foe") return [{ type: "foe-turn" }]
    const items = queries.commands(state, view.current.id)?.items ?? []
    return [
      turnActionFor(game, view.current.id),
      { type: "act", command: "guard" },
      ...(items.length
        ? [
            {
              type: "act" as const,
              command: "item" as const,
              good: pickOne(random, items).id,
            },
          ]
        : []),
    ]
  }
  if (state.phase.type === "expedition") {
    const route = queries.route(state)!
    if (route.discovery)
      return route.discovery.choices.flatMap((choice): GameAction[] =>
        choice.blessings
          ? choice.blessings.flatMap((skill) =>
              state.party.map((member) => ({
                type: "discover" as const,
                choice: choice.id,
                skill: skill.id,
                member,
              }))
            )
          : [{ type: "discover", choice: choice.id }]
      )
    if (route.pending) return [{ type: "acknowledge" }]
    return [
      ...route.choices.map((to) => ({ type: "advance" as const, to })),
      ...route.choices.map((to) => ({ type: "advance" as const, to })),
      { type: "retreat" },
      ...queries
        .items(state)
        .filter((item) => item.field)
        .map((item) => ({ type: "use" as const, good: item.id })),
    ]
  }
  const gear = state.gear
  const members = state.members
  const shops = ["armory", "tools", "apothecary"].map((slug) => contentId(slug))
  const shop = pickOne(random, shops)
  const good = pickOne(random, queries.shop(state, shop)!.goods).id
  const sellables = queries.sellables(state)
  const sellable = sellables.length ? pickOne(random, sellables) : null
  const member = pickOne(random, members).id
  const options = queries.equipOptions(state, member)
  const smithy = queries.smithy(state)!
  return [
    { type: "depart", layer: queries.defaultDestination(state) },
    { type: "rest", room: pickOne(random, queries.rooms(state)).id },
    { type: "buy", shop, good },
    ...(sellable
      ? [
          sellable.sell.gear
            ? { type: "sell" as const, gear: sellable.sell.gear }
            : { type: "sell" as const, good: sellable.sell.good! },
        ]
      : []),
    { type: "appraise", shop },
    ...(options.length
      ? [
          {
            type: "equip" as const,
            gear: pickOne(random, options).gear,
            member,
          },
        ]
      : []),
    { type: "unequip", gear: pickOne(random, gear).id },
    { type: "swap", out: pickOne(random, state.party), in: member },
    {
      type: "swap-rows",
      a: pickOne(random, state.party),
      b: pickOne(random, state.party),
    },
    { type: "recruit", recruit: pickOne(random, state.board) },
    { type: "summon" },
    { type: "choose-demon", demon: pickOne(random, state.demons).id },
    { type: "reroll" },
    { type: "upgrade", gear: pickOne(random, gear).id },
    ...(smithy.recipes.length
      ? [
          {
            type: "craft" as const,
            recipe: pickOne(random, smithy.recipes).recipe,
          },
        ]
      : []),
    { type: "repair" },
    {
      type: "accept-quest",
      quest: pickOne(random, queries.quests(state)).id,
    },
    { type: "claim-quest", quest: pickOne(random, queries.quests(state)).id },
    { type: "chat", liked: pickOne(random, state.party) },
    { type: "dismiss-wipe" },
    { type: "see-ending" },
    ...queries
      .items(state)
      .filter((item) => item.field)
      .map((item) => ({ type: "use" as const, good: item.id })),
  ]
}

/** 仕様の不変条件。どの操作のあとでも壊れてはいけない。 */
function checkInvariants(game: Game, where: string) {
  const state = game.state
  expect(state.gold, `${where}: 金貨`).toBeGreaterThanOrEqual(0)
  expect(state.stones, `${where}: 召喚石`).toBeGreaterThanOrEqual(0)
  expect(state.party.length, `${where}: 出撃の人数`).toBe(3)
  expect(new Set(state.party).size, `${where}: 出撃の重複`).toBe(3)
  for (const entry of state.bag)
    expect(entry.count, `${where}: ${entry.good} の数`).toBeGreaterThan(0)
  for (const member of state.members) {
    expect(member.hp, `${where}: ${member.id} のHP`).toBeGreaterThanOrEqual(0)
    expect(member.lv, `${where}: ${member.id} のレベル`).toBeGreaterThan(0)
    expect(member.fatigue).toBeGreaterThanOrEqual(0)
    expect(member.fatigue).toBeLessThanOrEqual(100)
    expect(member.dirt).toBeGreaterThanOrEqual(0)
    expect(member.dirt).toBeLessThanOrEqual(100)
    for (const used of member.used)
      expect(
        used.count,
        `${where}: ${member.id}/${used.skill}`
      ).toBeGreaterThan(0)
  }
  if (state.phase.type === "battle")
    for (const foe of state.phase.battle.foes) {
      expect(foe.hp, `${where}: ${foe.id} のHP`).toBeGreaterThanOrEqual(0)
      expect(foe.hp).toBeLessThanOrEqual(foe.maxHp)
    }
}

/** 表示の側から見た不変条件。重いので折り目ごとに確かめる。 */
function checkViewInvariants(game: Game, where: string) {
  const state = game.state
  expect(game.queries.problems(state), `${where}: 食い違い`).toEqual([])
  for (const member of state.members) {
    const view = game.queries.member(state, member.id)!
    expect(member.hp, `${where}: ${member.id} のHPの上限`).toBeLessThanOrEqual(
      view.maxHp
    )
    expect(view.weapon!.attack).toBeGreaterThanOrEqual(1)
  }
  for (const entry of game.queries.gear(state)) {
    expect(entry.plus, `${where}: ${entry.gear} の段`).toBeGreaterThanOrEqual(0)
    if (entry.unidentified) {
      expect(entry.price).toBe(0)
      expect(entry.weapon).toBeNull()
      expect(entry.rarity).toBeNull()
      expect(entry.stat).toBe("未鑑定")
      expect(entry.name).toMatch(/^だれかの/)
    } else
      expect(entry.price, `${where}: ${entry.gear} の売値`).toBeGreaterThan(0)
    if (entry.armor) {
      expect(entry.armor.durability).toBeGreaterThanOrEqual(0)
      expect(entry.armor.durability).toBeLessThanOrEqual(
        entry.armor.maxDurability
      )
      expect(entry.armor.wear).toBeGreaterThanOrEqual(0)
    }
    if (entry.weapon) expect(entry.weapon.skills.length).toBe(3)
  }
  if (state.phase.type !== "battle") return
  for (const id of state.party) {
    const commands = game.queries.commands(state, id)
    for (const skill of [
      ...(commands?.weaponSkills ?? []),
      ...(commands?.skills ?? []),
      ...(commands?.blessing ? [commands.blessing] : []),
    ]) {
      expect(
        skill.left ?? 0,
        `${where}: ${id}/${skill.id}`
      ).toBeGreaterThanOrEqual(0)
      if (skill.uses !== null && skill.left !== null)
        expect(skill.left).toBeLessThanOrEqual(skill.uses)
    }
  }
}

/** 場面ごとの表示をまとめて比べられる形にする。 */
function viewsOf(game: Game) {
  const state = game.state
  const queries = game.queries
  return {
    party: queries.party(state),
    reserve: queries.reserve(state),
    gear: queries.gear(state),
    items: queries.items(state),
    materials: queries.materials(state),
    sellables: queries.sellables(state),
    smithy: queries.smithy(state),
    reforges: queries.reforges(state),
    repairs: queries.repairs(state),
    shop: queries.shop(state, "armory"),
    rooms: queries.rooms(state),
    recruits: queries.recruits(state),
    quests: queries.quests(state),
    demons: queries.demons(state),
    marks: queries.marks(state),
    result: queries.result(state),
    destinations: queries.destinations(state),
    route: queries.route(state),
    battle: queries.battle(state),
    readiness: queries.readiness(state),
    commands: state.party.map((id) => queries.commands(state, id)),
  }
}

function playRandomly(seed: number, steps: number, seen = new Set<string>()) {
  const game = playOf(seed)
  const choose = seededRandom(seed * 31 + 7)
  for (let step = 0; step < steps; step++) {
    const options = choices(game, choose)
    const action = pickOne(choose, options)
    const result = game.send(action)
    if (result instanceof GameCommandError)
      expect(result.code, `seed ${seed} / ${JSON.stringify(action)}`).not.toBe(
        "ENGINE_FAILURE"
      )
    else for (const event of result) seen.add(event.type)
    checkInvariants(game, `seed ${seed} step ${step}`)
    if (step % 30 === 0) checkViewInvariants(game, `seed ${seed} step ${step}`)
  }
  checkViewInvariants(game, `seed ${seed} 終わり`)
  return game
}

const seeds = [1, 2, 3, 7, 11, 13, 23]
const fewSeeds = [1, 23]
/** でたらめに遊ぶ検証は重いので、待つ時間を長めに取る。 */
const SLOW = 30_000

describe("たくさん遊んでからの保存と復元（hunt）", () => {
  it(
    "どの種でもエンジンは落ちず、不変条件を保ち、戦闘から宿まで実際に通る",
    () => {
      const seen = new Set<string>()
      // 祭壇の選択が増えた分も含め、罠のある区間まで遊んで検証する。
      for (const seed of seeds) playRandomly(seed, 360, seen)
      for (const type of [
        "departed",
        "arrived",
        "encounter",
        "acted",
        "victory",
        "treasure",
        "trap",
        "returned",
        "rested",
        "bought",
        "sold",
        "appraised",
        "upgraded",
        "equipped",
        "recruited",
        "crafted",
        "used",
        "unequipped",
        "acknowledged",
      ])
        expect([...seen], type).toContain(type)
    },
    SLOW
  )

  it(
    "遊んだ途中の状態は、保存して別のプレイへ復元しても同じになる",
    () => {
      for (const seed of fewSeeds) {
        const game = playRandomly(seed, 45)
        const store = new InMemorySaveStore()
        store.write(JSON.stringify(game.save()))
        const other = definition.create(testEnvironment())
        expect(other.restore(JSON.parse(store.read()!)), `seed ${seed}`).toBe(
          undefined
        )
        expect(other.state, `seed ${seed}`).toEqual(game.state)
        expect(viewsOf(other), `seed ${seed}`).toEqual(viewsOf(game))
        // もう一度保存すると同じ中身になる
        expect(other.save()).toEqual(game.save())
        expect(store.writes).toBe(1)
      }
    },
    SLOW
  )

  it(
    "同じ種なら、同じ操作で同じ状態になる",
    () => {
      for (const seed of fewSeeds) {
        const first = playRandomly(seed, 35)
        const second = playRandomly(seed, 35)
        expect(second.state, `seed ${seed}`).toEqual(first.state)
        expect(second.save()).toEqual(first.save())
      }
    },
    SLOW
  )

  it(
    "種が違えば、たいてい違う状態になる",
    () => {
      const saves = fewSeeds.map(
        (seed) => JSON.stringify(playRandomly(seed, 30).save().snapshot).length
      )
      expect(new Set(saves).size).toBeGreaterThan(1)
    },
    SLOW
  )

  it(
    "復元を断っても、いまの状態と保存の中身は変わらない",
    () => {
      const game = playRandomly(23, 30)
      const save = JSON.parse(JSON.stringify(game.save()))
      const before = game.state
      const broken: unknown[] = [
        null,
        "壊れている",
        42,
        {},
        { ...save, snapshot: null },
        { ...save, contentVersion: "別の構成" },
        { ...save, schemaVersion: 99 },
        { ...save, snapshot: { ...save.snapshot, gold: -1 } },
        { ...save, snapshot: { ...save.snapshot, party: [] } },
        { ...save, snapshot: { ...save.snapshot, extra: true } },
        { ...save, snapshot: { ...save.snapshot, members: [] } },
        { ...save, snapshot: { ...save.snapshot, contract: "いない悪魔" } },
      ]
      for (const input of broken) {
        const error = game.restore(input)
        expect(error, JSON.stringify(input).slice(0, 60)).toBeInstanceOf(
          GameCommandError
        )
        expect((error as GameCommandError).code).toBe("INVALID_SAVE")
        expect(game.state).toBe(before)
        expect(game.save()).toEqual(save)
      }
      // 断られた後も、正しい保存なら読み込める
      expect(game.restore(save)).toBe(undefined)
      expect(game.state).toEqual(before)
    },
    SLOW
  )

  it("復元を断った直後の写しには理由が残り、次の操作で消える", () => {
    const game = playOf(5)
    expect(game.restore({ nothing: true })).toBeInstanceOf(GameCommandError)
    expect(game.getSnapshot().error).toBe("INVALID_SAVE")
    game.send({ type: "chat", liked: game.state.party[0] })
    expect(game.getSnapshot().error).toBe("NOT_READY")
    game.send({ type: "choose-demon", demon: game.state.demons[0].id })
    expect(game.getSnapshot().error).toBe(null)
  })

  it(
    "断られた操作は状態を一つも変えない",
    () => {
      const game = playRandomly(11, 25)
      const before = game.state
      const rejected: GameAction[] = [
        { type: "advance", to: "n1" },
        { type: "act", command: "guard" },
        { type: "foe-turn" },
        { type: "acknowledge" },
        { type: "retreat" },
        { type: "buy", shop: contentId("armory"), good: "いない品物" },
        { type: "sell", good: "いない品物" },
        { type: "equip", gear: "いない装備", member: contentId("alda") },
        { type: "unequip", gear: "いない装備" },
        { type: "upgrade", gear: "いない装備" },
        { type: "reforge", gear: "いない装備", material: "いない装備" },
        { type: "craft", recipe: "いないレシピ" },
        { type: "recruit", recruit: "いない募集" },
        { type: "choose-demon", demon: "いない悪魔" },
        { type: "accept-quest", quest: "いない依頼" },
        { type: "claim-quest", quest: "いない依頼" },
        { type: "chat", liked: "いない仲間" },
        { type: "use", good: "いない品物" },
        { type: "rest", room: "いない部屋" },
        { type: "swap", out: "alda", in: "alda" },
        { type: "swap-rows", a: "alda", b: "alda" },
      ]
      let rejections = 0
      for (const action of rejected) {
        const was = game.state
        const result = game.send(action)
        if (!(result instanceof GameCommandError)) continue
        rejections += 1
        expect(result.code, JSON.stringify(action)).not.toBe("ENGINE_FAILURE")
        expect(game.state, JSON.stringify(action)).toBe(was)
      }
      expect(rejections).toBeGreaterThan(10)
      expect(game.state.gold).toBe(before.gold)
    },
    SLOW
  )

  it("形の合わない操作は INVALID_ACTION で断り、状態を変えない", () => {
    const game = playOf(3)
    const before = game.state
    for (const action of [
      { type: "depart" },
      { type: "depart", layer: "" },
      { type: "depart", layer: contentId("layer0"), extra: 1 },
      { type: "act", command: "unknown" },
      { type: "sell" },
      { type: "sell", good: contentId("potion"), gear: "x" },
      { type: "知らない操作" },
      null,
      "depart",
      [],
    ]) {
      const error = game.sendUnknown(action)
      expect(error, JSON.stringify(action)).toBeInstanceOf(GameCommandError)
      expect((error as GameCommandError).code).toBe("INVALID_ACTION")
      expect(game.state).toBe(before)
    }
  })

  it(
    "状態を渡して始めたプレイは、その状態から動き出す",
    () => {
      const game = playRandomly(42, 25)
      const copy = definition.create(
        testEnvironment({ random: seededRandom(1) }),
        game.state as GameState
      )
      expect(copy.state).toEqual(game.state)
      expect(viewsOf(copy)).toEqual(viewsOf(game))
    },
    SLOW
  )
})
