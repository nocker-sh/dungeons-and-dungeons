import {
  FUN_GOALS,
  funMetrics,
  roadMetricsByLayer,
  playthrough,
  withinGoal,
  type Trip,
} from "../lib/fun"
import type { CliOptions } from "./options"
import { formatPercent, formatNumber, printResult } from "./output"

/** 面白さの数字を、目安と並べて出す。 */
export function commandFun(options: CliOptions) {
  const playthroughs = Array.from({ length: options.runs }, (_, run) =>
    playthrough({
      overrides: options.overrides,
      seed: options.seed + run,
      trips: options.expeditions,
      style: options.style,
    })
  )
  const completed = playthroughs.filter((run) => run.endingAt !== null).length
  const unfinishedSeeds = playthroughs.flatMap((run, index) =>
    run.endingAt === null ? [options.seed + index] : []
  )
  const longestRoadFights = playthroughs
    .flatMap((run, index) =>
      run.trips.flatMap((trip) =>
        trip.result.fights
          .filter((fight) => !fight.boss)
          .map((fight) => ({
            seed: options.seed + index,
            trip: trip.no,
            layer: trip.layer,
            ...fight,
          }))
      )
    )
    .sort((left, right) => right.actions - left.actions)
    .slice(0, 10)
  const roads = roadMetricsByLayer(playthroughs)
  const metrics = funMetrics(playthroughs)
  const keys = Object.keys(FUN_GOALS) as (keyof typeof FUN_GOALS)[]
  const rangeOf = (key: keyof typeof FUN_GOALS) => {
    const [low, high] = FUN_GOALS[key].range
    return `${low ?? ""}〜${high ?? ""}`
  }
  const percent = new Set<keyof typeof FUN_GOALS>([
    "strongerTrips",
    "pinchFights",
    "easyFights",
    "wipeTrips",
  ])
  const show = (key: keyof typeof FUN_GOALS) =>
    percent.has(key)
      ? formatPercent(metrics[key])
      : formatNumber(metrics[key], 2)
  printResult(
    options,
    {
      metrics,
      roads,
      longestRoadFights,
      completion: {
        completed,
        total: playthroughs.length,
        expeditionLimit: options.expeditions,
        unfinishedSeeds,
      },
      runs: playthroughs.map((run, index) => {
        const layers = new Map<
          string,
          {
            layer: string
            name: string
            trips: number
            firstClearAt: number | null
          }
        >()
        for (const trip of run.trips) {
          const layer = layers.get(trip.layer) ?? {
            layer: trip.layer,
            name: trip.layerName,
            trips: 0,
            firstClearAt: null,
          }
          layer.trips++
          if (trip.firstClear) layer.firstClearAt = trip.no
          layers.set(trip.layer, layer)
        }
        return {
          seed: options.seed + index,
          trips: run.trips.length,
          endingAt: run.endingAt,
          layers: [...layers.values()],
          progression: run.trips.map((trip) => ({
            trip: trip.no,
            layer: trip.layer,
            levelBefore: trip.levelBefore,
            attackBefore: trip.attackBefore,
            attackAfter: trip.attackAfter,
            appraised: trip.appraised,
            outcome: trip.result.outcome,
            stations: trip.result.stations,
            experience: trip.result.exp,
            firstClear: trip.firstClear,
          })),
        }
      }),
      goals: Object.fromEntries(
        keys.map((key) => [
          key,
          { ...FUN_GOALS[key], ok: withinGoal(key, metrics[key]) },
        ])
      ),
    },
    () =>
      [
        `面白さ ${options.runs}周（出撃${options.expeditions}回まで・種${options.seed}〜）`,
        `踏破 ${completed}/${playthroughs.length}周。踏破までの出撃回数は踏破した周だけの集計。`,
        ...(unfinishedSeeds.length
          ? [
              `未踏破の種：${unfinishedSeeds.join("、")}（出撃${options.expeditions}回の上限）`,
            ]
          : []),
        ...roads.map(
          (road) =>
            `  ${road.name}：道中${road.fights}戦・手数平均${road.actionsPerFight === null ? "未測定" : formatNumber(road.actionsPerFight, 2)}・中央値${road.medianActions ?? "未測定"}・最大${road.maxActions ?? "未測定"}・楽勝${road.easyFights === null ? "未測定" : formatPercent(road.easyFights)}`
        ),
        ...keys.map(
          (key) =>
            `  ${withinGoal(key, metrics[key]) ? "○" : "×"} ${show(key).padStart(7)}  目安 ${rangeOf(key)}  ${FUN_GOALS[key].label}`
        ),
      ].join("\n")
  )
}

/** 一周を自動で遊び、出撃ごとの出来事を読める形で出す（遊んだ手ざわりを読む）。 */
export function commandPlaylog(options: CliOptions) {
  const run = playthrough({
    overrides: options.overrides,
    seed: options.seed,
    trips: options.expeditions,
    style: options.style,
  })
  const line = (trip: Trip) => {
    const { result } = trip
    const rare = trip.appraised.filter(
      (rarity) => rarity === "R" || rarity === "SR"
    )
    const fights = result.fights
    const pinch = fights.filter(
      (fight) => fight.won && fight.lowest < 0.5
    ).length
    const outcome = {
      cleared: "ボス撃破",
      retreated: "撤退",
      wiped: "全滅",
    }[result.outcome]
    const parts = [
      `#${String(trip.no).padStart(2)} ${trip.layerName} Lv${formatNumber(trip.levelBefore)}`,
      trip.attackAfter > trip.attackBefore
        ? `攻撃力 ${trip.attackBefore}→${trip.attackAfter}`
        : `攻撃力 ${trip.attackAfter}`,
      trip.appraised.length
        ? `鑑定${trip.appraised.length}${rare.length ? `（${rare.join("・")}）` : ""}`
        : "",
      `${result.stations}地点・戦闘${fights.length}${pinch ? `（ピンチ${pinch}）` : ""}・分岐${result.choices}`,
      result.drops ? `武器を拾った${result.drops}` : "",
      result.rareJunk ? `光るガラクタ${result.rareJunk}` : "",
      `→ ${outcome}`,
      trip.firstClear ? `★はじめての突破` : "",
    ]
    return parts.filter(Boolean).join("  ")
  }
  printResult(options, run, () =>
    [
      `一周の記録（種${options.seed}・出撃${options.expeditions}回まで）`,
      ...run.trips.map(line),
      run.endingAt ? `踏破：${run.endingAt}回目の出撃` : "踏破できなかった",
    ].join("\n")
  )
}
