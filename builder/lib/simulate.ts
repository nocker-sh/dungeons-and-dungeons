import { lookAt, rateInterval, settled } from "./sequential"
import {
  applyOverride,
  buildContent,
  cloneSource,
  idOf,
  slugIndex,
  type Built,
} from "./content"
import {
  battleAction,
  buyGear,
  equipBestWeapon,
  expeditionAction,
  healItemFor,
  startParty,
  townDay,
  PUSH_PLAN,
  type BattleStyle,
  type ExpeditionPlan,
} from "./policy"
import { toGameContent } from "@/lib/content/game-content"
import { Session } from "./session"
import type { GameEvent } from "@/lib/wiz"

const LIMIT = 2000

/** 戦闘の中身の集計（誰がどれだけ削り、何を使ったか）。 */
export type Tally = {
  damage: Map<string, number>
  healing: Map<string, number>
  taken: Map<string, number>
  uses: Map<string, number>
}

export function newTally(): Tally {
  return {
    damage: new Map(),
    healing: new Map(),
    taken: new Map(),
    uses: new Map(),
  }
}

const add = (map: Map<string, number>, key: string, value: number) =>
  map.set(key, (map.get(key) ?? 0) + value)

/** 戦闘を終わるまで回す。tally を渡すと中身を数える。 */
export function fightToEnd(
  session: Session,
  style: BattleStyle,
  tally?: Tally
) {
  const random = session.random.fork(7)
  let actions = 0
  let rounds = 0
  // 戦闘中にいちばん減ったときの、出撃の3人のHPの合計の割合（ピンチの深さ）
  const ratio = () => {
    const party = session.queries.party(session.state)
    const max = party.reduce((sum, member) => sum + member.maxHp, 0)
    return max ? party.reduce((sum, member) => sum + member.hp, 0) / max : 0
  }
  const start = ratio()
  let lowest = start
  // 敵が落とした武器の個体の数
  let drops = 0
  let won = false
  const record = (events: readonly GameEvent[]) => {
    if (events.some((event) => event.type === "victory")) won = true
    if (!tally) return
    for (const event of events) {
      if (event.type !== "acted") continue
      const actor = event.actor.kind === "member" ? event.actor.id : "敵"
      add(
        tally.uses,
        `${event.actor.kind === "member" ? session.label(event.actor.id) : "敵"}:${event.name}`,
        1
      )
      for (const result of event.results) {
        if (result.damage && result.target.kind === "foe")
          add(tally.damage, actor, result.damage)
        if (result.damage && result.target.kind === "member")
          add(tally.taken, result.target.id, result.damage)
        if (result.heal) add(tally.healing, actor, result.heal)
      }
    }
  }
  for (
    let guard = 0;
    guard < LIMIT && session.state.phase.type === "battle";
    guard++
  ) {
    const view = session.queries.battle(session.state)!
    if (view.current.kind === "member") actions++
    if (view.turn % view.order.length === 0) rounds++
    const action = battleAction(session, style, random)
    const result = session.send(action)
    if (session.state.phase.type === "battle")
      lowest = Math.min(lowest, ratio())
    if (Array.isArray(result))
      for (const event of result)
        if (event.type === "victory") drops += event.weapons?.length ?? 0
    if (Array.isArray(result)) record(result)
    else {
      // 方針が選んだ手が拒否されたら防御で進める
      const fallback = session.send({ type: "act", command: "guard" })
      if (!Array.isArray(fallback))
        throw new Error(`戦闘が進まない: ${JSON.stringify(action)}`)
      record(fallback)
    }
  }
  if (won) lowest = Math.min(lowest, ratio())
  return { won, actions, rounds, start, lowest, drops }
}

export type ExpeditionResult = {
  outcome: "cleared" | "retreated" | "wiped"
  stations: number
  battles: number
  /** 道中の戦闘（ボス以外）のラウンドの合計と、ボス戦のラウンド。 */
  battleRounds: number
  bossRounds: number
  /** 戦闘ごとの記録（自分の手数・ラウンド・始めと一番減ったときのHPの割合・勝ったか）。 */
  fights: {
    boss: boolean
    station?: string
    midboss?: boolean
    foes?: { id: string; name: string }[]
    actions: number
    rounds: number
    start: number
    lowest: number
    won: boolean
  }[]
  /** 敵が落とした武器の個体の数。 */
  drops: number
  /** 分かれ目で行き先を選んだ回数。 */
  choices: number
  bossReached: boolean
  bossWon: boolean
  gold: number
  exp: number
  /** 持ち帰ったガラクタの数（武器集めの素）。 */
  junk: number
  /** 持ち帰った光るガラクタの数（必ず R 以上の武器になる）。 */
  rareJunk: number
  /** 手に入れた召喚石。 */
  stones: number
}

/** 出撃から街へ戻るまで。 */
export function runExpedition(
  session: Session,
  layer: string,
  plan: ExpeditionPlan,
  style: BattleStyle
): ExpeditionResult {
  const random = session.random.fork(11)
  const goldBefore = session.state.gold
  const junkId = session.catalog.data.junk
  const junkOf = () =>
    session.state.bag
      .filter((entry) => entry.good === junkId)
      .reduce((sum, entry) => sum + entry.count, 0)
  const junkBefore = junkOf()
  const rareId = session.catalog.data.rareJunk
  const rareOf = () =>
    session.state.bag
      .filter((entry) => entry.good === rareId)
      .reduce((sum, entry) => sum + entry.count, 0)
  const rareBefore = rareOf()
  const stonesBefore = session.state.stones
  const expBefore = session.state.members.reduce(
    (sum, member) => sum + member.exp,
    0
  )
  session.must({ type: "depart", layer })
  const result: ExpeditionResult = {
    outcome: "retreated",
    stations: 0,
    battles: 0,
    battleRounds: 0,
    bossRounds: 0,
    fights: [],
    drops: 0,
    choices: 0,
    bossReached: false,
    bossWon: false,
    gold: 0,
    exp: 0,
    junk: 0,
    rareJunk: 0,
    stones: 0,
  }
  for (let guard = 0; guard < LIMIT; guard++) {
    const phase = session.state.phase
    if (phase.type === "town") break
    if (phase.type === "battle") {
      result.battles++
      const boss = phase.battle.boss
      if (boss) result.bossReached = true
      const station = session.definition.catalog.station(
        phase.expedition.layer,
        phase.expedition.at
      )
      const foes = session.queries.battle(session.state)!.foes.map((foe) => ({
        id: foe.foe,
        name: foe.name,
      }))
      const fight = fightToEnd(session, style)
      if (boss) result.bossRounds = fight.rounds
      else result.battleRounds += fight.rounds
      result.drops += fight.drops
      result.fights.push({
        boss,
        station: phase.expedition.at,
        midboss: station?.event === "midboss",
        foes,
        actions: fight.actions,
        rounds: fight.rounds,
        start: fight.start,
        lowest: fight.lowest,
        won: fight.won,
      })
      if (!fight.won) {
        result.outcome = "wiped"
        break
      }
      if (boss) result.bossWon = true
      continue
    }
    const action = expeditionAction(session, plan, random)
    if (action.type === "advance") {
      result.stations++
      if ((session.queries.route(session.state)?.choices.length ?? 0) > 1)
        result.choices++
    }
    session.must(action)
  }
  if (result.bossWon) result.outcome = "cleared"
  result.gold = session.state.gold - goldBefore
  result.junk = junkOf() - junkBefore
  result.rareJunk = rareOf() - rareBefore
  result.stones = session.state.stones - stonesBefore
  result.exp =
    session.state.members.reduce((sum, member) => sum + member.exp, 0) -
    expBefore
  return result
}

/** 戦いたい敵だけの層（闘技場）を先頭に足したデータ。 */
export function arenaContent(
  overrides: readonly string[],
  foes: readonly string[],
  boss: boolean
): Built {
  const source = cloneSource()
  for (const expression of overrides) applyOverride(source, expression)
  const ids = foes.map((key) => {
    const id = idOf(source, key, "foes")
    if (!id) throw new Error(`敵 ${key} がない`)
    return id
  })
  const layers = source.layers as Record<string, unknown>[]
  layers.unshift({
    id: "arena",
    slug: "arena",
    no: 0,
    name: "闘技場",
    foes: ids,
    group: [ids.length, ids.length],
    boss: ids[0],
    start: "s",
    stations: [
      { id: "s", x: 0, y: 0, next: ["n1"] },
      boss
        ? { id: "n1", x: 1, y: 0, next: [], boss: true }
        : { id: "n1", x: 1, y: 0, next: ["n2"], event: "battle" },
      ...(boss ? [] : [{ id: "n2", x: 2, y: 0, next: [], boss: true }]),
    ],
    weights: { battle: 1, treasure: 0, trap: 0 },
    treasure: { gold: [0, 0], goods: [] },
    trap: [0, 0],
  })
  source.reached = 0
  return { source, content: toGameContent(source), slugs: slugIndex(source) }
}

export type Setup = {
  level?: number
  /** 店で買える一番強く振れる武器に持ち替えてから始める。防具は初期のまま。 */
  weapons?: boolean
  /** 到達した層の深さ。深い層でしか並ばない武器・防具を買えるようになる。 */
  reached?: number
  /** 回復薬をこの数だけ持って始める（深さごとの稼ぎを測るため）。 */
  potions?: number
}

/**
 * 店の品ぞろえから、その仲間がいちばん強く振れる武器を着ける。
 * 育ち方を測るためのお膳立てなので、代金は数えない（levelTo と同じ作り）。
 */
function equipShopWeapons(session: Session) {
  const gold = session.state.gold
  session.patch((state) => {
    state.gold = 1_000_000
  })
  buyGear(session, 0, "weapon")
  equipBestWeapon(session)
  session.patch((state) => {
    state.gold = gold
  })
}

/**
 * 回復薬を持たせてから測る。お膳立てなので代金は数えない（levelTo と同じ作り）。
 * 深く潜るほど消耗するので、薬がないと「進むほど得か」を測れない。
 */
function stockPotions(session: Session, want: number) {
  const potion = healItemFor(session)
  const shop = session.catalog.data.shops.find((entry) =>
    potion ? entry.goods.includes(potion.id) : false
  )
  if (!potion || !shop) return
  const gold = session.state.gold
  session.patch((state) => {
    state.gold = 1_000_000
  })
  for (let guard = 0; guard < want; guard++)
    session.send({ type: "buy", shop: shop.id, good: potion.id })
  session.patch((state) => {
    state.gold = gold
  })
}

function prepare(session: Session, setup: Setup) {
  // 出撃には3人と悪魔が要る。足りなければ募集で雇い、召喚して合体してから測る
  startParty(session)
  const reached = setup.reached
  if (reached !== undefined)
    session.patch((state) => {
      state.reached = reached
    })
  if (setup.level) session.levelTo(setup.level)
  if (setup.weapons) equipShopWeapons(session)
  if (setup.potions) stockPotions(session, setup.potions)
}

/** 平均・率・95%の幅。 */
export function rate(hits: number, runs: number) {
  const p = runs ? hits / runs : 0
  const margin = runs ? 1.96 * Math.sqrt((p * (1 - p)) / runs) : 0
  return { p, margin }
}

export function mean(values: readonly number[]) {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0
}

export function median(values: readonly number[]) {
  if (!values.length) return NaN
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2
}

/** 指定した敵との戦闘を runs 回。 */
export function battleTrials(options: {
  overrides: readonly string[]
  foes: readonly string[]
  boss: boolean
  runs: number
  seed: number
  style: BattleStyle
  setup: Setup
  /** 途中で打ち切るか（合否が決まったら true）。省くと runs 回すべて回す。 */
  until?: (trial: {
    wins: number
    runs: number
    hpLeft: readonly number[]
  }) => boolean
}) {
  const built = arenaContent(options.overrides, options.foes, options.boss)
  let wins = 0
  let runs = 0
  const rounds: number[] = []
  const hpLeft: number[] = []
  const downs: number[] = []
  const tally = newTally()
  let labels = new Map<string, string>()
  for (let run = 0; run < options.runs; run++) {
    const session = new Session(built, options.seed + run)
    prepare(session, options.setup)
    session.must({ type: "depart", layer: "arena" })
    session.must({ type: "advance", to: "n1" })
    const fight = fightToEnd(session, options.style, tally)
    labels = new Map(session.state.party.map((id) => [id, session.label(id)]))
    const party = session.queries.party(session.state)
    if (fight.won) wins++
    rounds.push(fight.rounds)
    hpLeft.push(
      party.reduce((sum, member) => sum + member.hp, 0) /
        party.reduce((sum, member) => sum + member.maxHp, 0)
    )
    downs.push(party.filter((member) => member.hp <= 0).length)
    runs = run + 1
    if (options.until && lookAt(run) && options.until({ wins, runs, hpLeft }))
      break
  }
  const per = (map: Map<string, number>) =>
    Object.fromEntries(
      [...map].map(([id, value]) => [labels.get(id) ?? id, value / runs])
    )
  return {
    runs,
    win: rate(wins, runs),
    rounds: mean(rounds),
    hpLeft: mean(hpLeft),
    downs: mean(downs),
    /** 一戦あたりの平均。 */
    damage: per(tally.damage),
    healing: per(tally.healing),
    taken: per(tally.taken),
    uses: Object.fromEntries(
      [...tally.uses]
        .sort((a, b) => b[1] - a[1])
        .map(([key, value]) => [key, value / runs])
    ),
  }
}

/** 層を一回ずつ潜る（街での準備なし）を runs 回。 */
export function dungeonTrials(options: {
  overrides: readonly string[]
  layer: string
  runs: number
  seed: number
  style: BattleStyle
  plan: ExpeditionPlan
  setup: Setup
  /** 途中で打ち切るか（合否が決まったら true）。clears は突破した回数。 */
  until?: (trial: { clears: number; runs: number }) => boolean
}) {
  const built = buildContent(options.overrides)
  const layerId = idOf(built.source, options.layer, "layers")
  if (!layerId) throw new Error(`層 ${options.layer} がない`)
  const index = (built.source.layers as { id: string }[]).findIndex(
    (layer) => layer.id === layerId
  )
  const results: ExpeditionResult[] = []
  for (let run = 0; run < options.runs; run++) {
    const session = new Session(built, options.seed + run)
    session.patch((state) => {
      state.reached = Math.max(state.reached, index)
    })
    prepare(session, options.setup)
    results.push(runExpedition(session, layerId, options.plan, options.style))
    if (
      options.until &&
      lookAt(run) &&
      options.until({
        clears: results.filter((entry) => entry.outcome === "cleared").length,
        runs: results.length,
      })
    )
      break
  }
  const runs = results.length
  const count = (outcome: ExpeditionResult["outcome"]) =>
    results.filter((entry) => entry.outcome === outcome).length
  return {
    runs,
    clear: rate(count("cleared"), runs),
    wipe: rate(count("wiped"), runs),
    retreat: rate(count("retreated"), runs),
    bossReached: rate(
      results.filter((entry) => entry.bossReached).length,
      runs
    ),
    bossWon: rate(results.filter((entry) => entry.bossWon).length, runs),
    stations: mean(results.map((entry) => entry.stations)),
    battles: mean(results.map((entry) => entry.battles)),
    gold: mean(results.map((entry) => entry.gold)),
    exp: mean(results.map((entry) => entry.exp)),
  }
}

/**
 * 「どこまで潜るか」ごとの稼ぎと危なさ。深さ（地点の x）で引き返す方針を変えて測る。
 * 進むほど得になっているか（押し引きの手ざわり）を見るための測定。
 */
export function depthTrials(options: {
  overrides: readonly string[]
  layer: string
  depths: readonly number[]
  runs: number
  seed: number
  style: BattleStyle
  setup: Setup
}) {
  const built = buildContent(options.overrides)
  const layerId = idOf(built.source, options.layer, "layers")
  if (!layerId) throw new Error(`層 ${options.layer} がない`)
  const index = (built.source.layers as { id: string }[]).findIndex(
    (layer) => layer.id === layerId
  )
  return options.depths.map((depth) => {
    const results: ExpeditionResult[] = []
    for (let run = 0; run < options.runs; run++) {
      const session = new Session(built, options.seed + run)
      session.patch((state) => {
        state.reached = Math.max(state.reached, index)
      })
      prepare(session, options.setup)
      results.push(
        runExpedition(
          session,
          layerId,
          { ...PUSH_PLAN, stopAt: depth },
          options.style
        )
      )
    }
    const wipes = results.filter((entry) => entry.outcome === "wiped").length
    const stations = mean(results.map((entry) => entry.stations))
    return {
      depth,
      stations,
      gold: mean(results.map((entry) => entry.gold)),
      exp: mean(results.map((entry) => entry.exp)),
      junk: mean(results.map((entry) => entry.junk)),
      rareJunk: mean(results.map((entry) => entry.rareJunk)),
      stones: mean(results.map((entry) => entry.stones)),
      wipe: rate(wipes, options.runs),
      /** 1地点あたりの稼ぎと経験値（深いほど大きいなら、進むほど得になっている）。 */
      goldPerStation: stations
        ? mean(results.map((entry) => entry.gold)) / stations
        : 0,
      expPerStation: stations
        ? mean(results.map((entry) => entry.exp)) / stations
        : 0,
    }
  })
}

export type CampaignRun = {
  /** 層ごとに、はじめて突破した出撃の回数。突破できなければ null。 */
  clearedAt: (number | null)[]
  /** 突破したときの出撃メンバーの平均レベル。 */
  levelAt: (number | null)[]
  expeditions: number
  wipes: number
  /** ボス戦での全滅。 */
  bossWipes: number
  finalLevel: number
  finalGold: number
  /** 鑑定した回数と、鑑定が1回以上あった出撃の回数。 */
  appraisals: number
  appraiseTrips: number
  /** はじめて R か SR を引いた出撃の回数。引けなければ null。 */
  firstRareAt: number | null
  /** 道中の戦闘の数とラウンドの合計、ボス戦の数とラウンドの合計。 */
  battles: number
  battleRounds: number
  bossBattles: number
  bossRounds: number
  /** 防具の修理に払った額と、探索で稼いだ額。 */
  repairGold: number
  earnedGold: number
}

export type CampaignOptions = {
  overrides: readonly string[]
  runs: number
  seed: number
  style: BattleStyle
  plan: ExpeditionPlan
  expeditions: number
  layers: number
  potions: number
  /** 街で装備を買い替える。 */
  shop?: boolean
}

/** 街と探索をくり返す一周を runs 回。 */
export function campaignTrials(options: CampaignOptions) {
  const built = buildContent(options.overrides)
  const runs = Array.from({ length: options.runs }, (_, run) =>
    campaignRun(built, options, run)
  )
  return summarizeCampaign(built, options, runs)
}

/** 一周の run 回目（種は seed + run）。回ごとに独立しているので、別のスレッドでも同じ結果になる。 */
export function campaignRun(
  built: ReturnType<typeof buildContent>,
  options: CampaignOptions,
  run: number
): CampaignRun {
  const layerCount = Math.min(options.layers, built.content.layers.length)
  {
    const session = new Session(built, options.seed + run)
    const record: CampaignRun = {
      clearedAt: Array(layerCount).fill(null),
      levelAt: Array(layerCount).fill(null),
      expeditions: 0,
      wipes: 0,
      bossWipes: 0,
      finalLevel: 0,
      finalGold: 0,
      appraisals: 0,
      appraiseTrips: 0,
      firstRareAt: null,
      battles: 0,
      battleRounds: 0,
      bossBattles: 0,
      bossRounds: 0,
      repairGold: 0,
      earnedGold: 0,
    }
    const averageLevel = () =>
      mean(session.queries.party(session.state).map((member) => member.lv))
    // ボスに負けたら、平均レベルが1上がるまでボスの手前で引き返す
    let lostAt = -Infinity
    for (let trip = 1; trip <= options.expeditions; trip++) {
      const day = townDay(session, {
        potions: options.potions,
        upgrade: true,
        summon: true,
        shop: options.shop,
      })
      record.appraisals += day.appraised.length
      if (day.appraised.length) record.appraiseTrips++
      if (
        record.firstRareAt === null &&
        day.appraised.some((rarity) => rarity === "R" || rarity === "SR")
      )
        record.firstRareAt = trip
      record.repairGold += day.repairGold
      const index = built.content.layers.findIndex(
        (entry) => entry.id === day.layer
      )
      if (index >= layerCount) break
      const ready = session.queries.readiness(session.state)
      if (!ready.ready) continue
      const plan = {
        ...options.plan,
        avoidBoss: options.plan.push ? false : averageLevel() < lostAt + 1,
      }
      const result = runExpedition(session, day.layer, plan, options.style)
      record.expeditions = trip
      record.earnedGold += Math.max(0, result.gold)
      record.battles += result.battles - (result.bossReached ? 1 : 0)
      record.battleRounds += result.battleRounds
      if (result.bossReached) record.bossBattles++
      record.bossRounds += result.bossRounds
      if (result.outcome === "wiped") record.wipes++
      if (result.outcome === "wiped" && result.bossReached) record.bossWipes++
      if (result.bossReached && !result.bossWon) lostAt = averageLevel()
      if (result.outcome === "cleared" && record.clearedAt[index] === null) {
        record.clearedAt[index] = trip
        record.levelAt[index] = averageLevel()
        if (index + 1 >= layerCount) break
      }
    }
    record.finalLevel = averageLevel()
    record.finalGold = session.state.gold
    return record
  }
}

/** 一周の回ごとの記録をまとめる。 */
export function summarizeCampaign(
  built: ReturnType<typeof buildContent>,
  options: Pick<CampaignOptions, "layers">,
  runs: readonly CampaignRun[]
) {
  const layerCount = Math.min(options.layers, built.content.layers.length)
  const layers = Array.from({ length: layerCount }, (_, index) => {
    const at = runs
      .map((entry) => entry.clearedAt[index])
      .filter((value): value is number => value !== null)
    const levels = runs
      .map((entry) => entry.levelAt[index])
      .filter((value): value is number => value !== null)
    return {
      layer: built.slugs.get(built.content.layers[index].id) ?? String(index),
      clear: rate(at.length, runs.length),
      medianTrip: median(at),
      level: mean(levels),
    }
  })
  const trips = runs.reduce((sum, entry) => sum + entry.expeditions, 0)
  const rareAt = runs
    .map((entry) => entry.firstRareAt)
    .filter((value): value is number => value !== null)
  return {
    layers,
    wipes: mean(runs.map((entry) => entry.wipes)),
    bossWipes: mean(runs.map((entry) => entry.bossWipes)),
    expeditions: mean(runs.map((entry) => entry.expeditions)),
    finalLevel: mean(runs.map((entry) => entry.finalLevel)),
    finalGold: mean(runs.map((entry) => entry.finalGold)),
    /** 1回の出撃あたりの鑑定の回数と、鑑定があった出撃の割合。 */
    appraisalsPerTrip: trips
      ? runs.reduce((sum, entry) => sum + entry.appraisals, 0) / trips
      : 0,
    appraiseTripRate: rate(
      runs.reduce((sum, entry) => sum + entry.appraiseTrips, 0),
      trips
    ),
    /** はじめて R 以上を引くまでの出撃回数（中央値）と、引けた割合。 */
    firstRareTrip: median(rareAt),
    firstRareRate: rate(rareAt.length, runs.length),
    /** 道中の戦闘とボス戦の、1戦あたりのラウンド（戦闘のテンポ）。 */
    battleRounds: perBattle(runs, "battleRounds", "battles"),
    bossRounds: perBattle(runs, "bossRounds", "bossBattles"),
    /** 1回の出撃あたりの修理代と稼ぎ。 */
    repairPerTrip: trips
      ? runs.reduce((sum, entry) => sum + entry.repairGold, 0) / trips
      : 0,
    earnedPerTrip: trips
      ? runs.reduce((sum, entry) => sum + entry.earnedGold, 0) / trips
      : 0,
  }
}

function perBattle(
  runs: readonly CampaignRun[],
  rounds: "battleRounds" | "bossRounds",
  battles: "battles" | "bossBattles"
) {
  const count = runs.reduce((sum, entry) => sum + entry[battles], 0)
  return count ? runs.reduce((sum, entry) => sum + entry[rounds], 0) / count : 0
}

/** ボスに勝てるようになるレベル：勝率が threshold を超える最小のレベル。 */
export function levelFor(options: {
  overrides: readonly string[]
  foes: readonly string[]
  boss: boolean
  runs: number
  seed: number
  style: BattleStyle
  threshold: number
  from: number
  to: number
  /** 店の武器に持ち替えた状態で測る。 */
  weapons?: boolean
  /** 到達した層の深さ（その層までに並ぶ武器で測る）。 */
  reached?: number
  /** レベルごとの戦闘を、勝率が threshold の上か下か決まったところで打ち切る。 */
  sequential?: boolean
}) {
  const curve: { level: number; win: number }[] = []
  let found: number | null = null
  for (let level = options.from; level <= options.to; level++) {
    const result = battleTrials({
      ...options,
      setup: {
        level,
        weapons: options.weapons,
        reached: options.reached,
      },
      until: options.sequential
        ? ({ wins, runs }) =>
            settled(rateInterval(wins, runs), { min: options.threshold })
        : undefined,
    })
    curve.push({ level, win: result.win.p })
    if (found === null && result.win.p >= options.threshold) found = level
    if (result.win.p >= 0.98) break
  }
  return { level: found, curve }
}
