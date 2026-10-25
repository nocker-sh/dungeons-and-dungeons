/**
 * 面白さを測る。街と探索をくり返す一周を自動で遊び、出撃ごとの手ざわりを記録する。
 * 「テンポ」「当たり」「成長」「緊張」「判断」を数え、目安（FUN_GOALS）と並べる。
 * 目安はハクスラの手ざわりの仮の基準で、ユーザーの確定仕様ではない。
 */
import { DEFAULT_PLAN, townDay, type BattleStyle } from "./policy"
import { Session } from "./session"
import { buildContent } from "./content"
import { mean, runExpedition, type ExpeditionResult } from "./simulate"

/** 出撃ひとつの記録。 */
export type Trip = {
  no: number
  layer: string
  /** 層の名前。 */
  layerName: string
  /** 街で鑑定した武器のレア度。 */
  appraised: (string | null)[]
  /** 出撃の3人の攻撃力の合計（街の準備の前と後）。 */
  attackBefore: number
  attackAfter: number
  /** 平均レベル（出撃の前と、次の宿の後）。 */
  levelBefore: number
  result: ExpeditionResult
  /** 最初の突破なら、その層の名前。 */
  firstClear: string | null
}

export type Playthrough = { trips: Trip[]; endingAt: number | null }

const attackOf = (session: Session) =>
  session.state.party.reduce((sum, id) => {
    const member = session.state.members.find((entry) => entry.id === id)
    return (
      sum +
      (member
        ? (session.queries.weapon(session.state, member)?.attack ?? 0)
        : 0)
    )
  }, 0)
const levelOf = (session: Session) =>
  mean(session.queries.party(session.state).map((member) => member.lv))

/** 一周を遊ぶ。踏破するか、出撃の上限まで。 */
export function playthrough(options: {
  overrides: readonly string[]
  seed: number
  trips: number
  style: BattleStyle
}): Playthrough {
  const built = buildContent(options.overrides)
  const session = new Session(built, options.seed)
  const layers = built.content.layers
  const cleared = new Set<string>()
  const trips: Trip[] = []
  let lostAt = -Infinity
  let endingAt: number | null = null
  for (let no = 1; no <= options.trips; no++) {
    const attackBefore = attackOf(session)
    const day = townDay(session, {
      potions: 2,
      upgrade: true,
      summon: true,
      shop: true,
    })
    if (!session.queries.readiness(session.state).ready) continue
    const attackAfter = attackOf(session)
    const levelBefore = levelOf(session)
    const result = runExpedition(
      session,
      day.layer,
      { ...DEFAULT_PLAN, avoidBoss: levelOf(session) < lostAt + 1 },
      options.style
    )
    if (result.bossReached && !result.bossWon) lostAt = levelOf(session)
    const firstClear =
      result.outcome === "cleared" && !cleared.has(day.layer) ? day.layer : null
    if (firstClear) cleared.add(firstClear)
    const layer = layers.find((entry) => entry.id === day.layer)
    trips.push({
      no,
      layer: built.slugs.get(day.layer) ?? day.layer,
      layerName: layer?.name ?? day.layer,
      appraised: day.appraised,
      attackBefore,
      attackAfter,
      levelBefore,
      result,
      firstClear: firstClear ? (layer?.name ?? firstClear) : null,
    })
    if (firstClear && layers[layers.length - 1].id === firstClear) {
      endingAt = no
      break
    }
  }
  return { trips, endingAt }
}

/** 面白さの目安。[少ない, 多い]（片側だけのものは null）。 */
export const FUN_GOALS = {
  actionsPerFight: {
    label: "道中1戦で自分が選ぶ手の数（少ないほどテンポがよい）",
    range: [null, 12],
  },
  bossRounds: { label: "ボス戦のラウンド", range: [6, 12] },
  strongerTrips: {
    label: "出撃の前に攻撃力が上がった割合（強くなった実感）",
    range: [0.4, null],
  },
  hitsPerTrip: {
    label:
      "1出撃あたりの当たり（鑑定の R・SR と敵が落とした武器。多すぎると当たりの価値が薄れる）",
    range: [0.5, 2],
  },
  pinchFights: {
    label: "ピンチを切り抜けた（HPの合計が半分を切ってから勝った）戦闘の割合",
    range: [0.1, 0.35],
  },
  easyFights: {
    label: "楽勝（HPがほとんど減らない）の戦闘の割合",
    range: [null, 0.5],
  },
  wipeTrips: { label: "全滅した出撃の割合", range: [0.05, 0.3] },
  levelGainPerTrip: {
    label: "1出撃あたりのレベルの伸び（3人の平均）",
    range: [0.4, null],
  },
  choicesPerTrip: {
    label: "1出撃あたり、分かれ目で行き先を選んだ回数",
    range: [2, null],
  },
  earlyWipes: {
    label: "最初の3出撃での全滅の回数（始めたてに何も持ち帰れない回数）",
    range: [null, 1],
  },
  endingTrips: { label: "踏破までの出撃回数", range: [28, 45] },
} as const satisfies Record<
  string,
  { label: string; range: readonly [number | null, number | null] }
>

export type FunMetrics = Record<keyof typeof FUN_GOALS, number>

/** 何周か遊んで、面白さの数字をまとめる。 */
export function funMetrics(playthroughs: readonly Playthrough[]): FunMetrics {
  const trips = playthroughs.flatMap((entry) => entry.trips)
  const fights = trips.flatMap((trip) => trip.result.fights)
  const roads = fights.filter((fight) => !fight.boss)
  const bosses = fights.filter((fight) => fight.boss)
  const rate = (hits: number, total: number) => (total ? hits / total : 0)
  const levelGains = playthroughs.flatMap((entry) =>
    entry.trips
      .slice(1)
      .map((trip, index) => trip.levelBefore - entry.trips[index].levelBefore)
  )
  const endings = playthroughs
    .map((entry) => entry.endingAt)
    .filter((value): value is number => value !== null)
  return {
    actionsPerFight: mean(roads.map((fight) => fight.actions)),
    bossRounds: mean(bosses.map((fight) => fight.rounds)),
    strongerTrips: rate(
      trips.filter((trip) => trip.attackAfter > trip.attackBefore).length,
      trips.length
    ),
    hitsPerTrip: rate(
      trips.reduce(
        (sum, trip) =>
          sum +
          trip.appraised.filter((rarity) => rarity === "R" || rarity === "SR")
            .length +
          trip.result.drops,
        0
      ),
      trips.length
    ),
    pinchFights: rate(
      fights.filter((fight) => fight.won && fight.lowest < 0.5).length,
      fights.length
    ),
    easyFights: rate(
      fights.filter((fight) => fight.start - fight.lowest < 0.1).length,
      fights.length
    ),
    wipeTrips: rate(
      trips.filter((trip) => trip.result.outcome === "wiped").length,
      trips.length
    ),
    levelGainPerTrip: mean(levelGains),
    choicesPerTrip: mean(trips.map((trip) => trip.result.choices)),
    earlyWipes: mean(
      playthroughs.map(
        (entry) =>
          entry.trips
            .slice(0, 3)
            .filter((trip) => trip.result.outcome === "wiped").length
      )
    ),
    endingTrips: endings.length
      ? [...endings].sort((a, b) => a - b)[Math.floor(endings.length / 2)]
      : Number.NaN,
  }
}

/** 目安に入っているか。 */
export function withinGoal(key: keyof typeof FUN_GOALS, value: number) {
  const [low, high] = FUN_GOALS[key].range
  if (Number.isNaN(value)) return false
  return (low === null || value >= low) && (high === null || value <= high)
}

/** 層ごとの道中戦。戦闘数で集計し、出撃ごとの平均を再平均しない。 */
export function roadMetricsByLayer(playthroughs: readonly Playthrough[]) {
  const layers = new Map<string, { name: string; trips: Trip[] }>()
  for (const run of playthroughs)
    for (const trip of run.trips) {
      const layer = layers.get(trip.layer) ?? {
        name: trip.layerName,
        trips: [],
      }
      layer.trips.push(trip)
      layers.set(trip.layer, layer)
    }
  return [...layers].map(([layer, { name, trips }]) => {
    const fights = trips.flatMap((trip) =>
      trip.result.fights.filter((fight) => !fight.boss)
    )
    const actions = fights
      .map((fight) => fight.actions)
      .sort((left, right) => left - right)
    const middle = Math.floor(actions.length / 2)
    return {
      layer,
      name,
      trips: trips.length,
      fights: fights.length,
      normalFights: fights.filter((fight) => !fight.midboss).length,
      normalActionsPerFight: fights.some((fight) => !fight.midboss)
        ? mean(
            fights
              .filter((fight) => !fight.midboss)
              .map((fight) => fight.actions)
          )
        : null,
      midbossFights: fights.filter((fight) => fight.midboss).length,
      midbossActionsPerFight: fights.some((fight) => fight.midboss)
        ? mean(
            fights
              .filter((fight) => fight.midboss)
              .map((fight) => fight.actions)
          )
        : null,
      actionsPerFight: fights.length ? mean(actions) : null,
      medianActions: fights.length
        ? actions.length % 2
          ? actions[middle]
          : (actions[middle - 1] + actions[middle]) / 2
        : null,
      maxActions: fights.length ? actions[actions.length - 1] : null,
      easyFights: fights.length
        ? fights.filter((fight) => fight.start - fight.lowest < 0.1).length /
          fights.length
        : null,
    }
  })
}
