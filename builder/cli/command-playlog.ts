import { playthrough } from "@/builder/lib/playthrough"
import type { Trip } from "@/builder/lib/fun"
import type { CliOptions } from "@/builder/cli/options"
import { formatNumber } from "@/builder/cli/format-number"
import { printResult } from "@/builder/cli/print-result"

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
      `#${String(trip.no).padStart(2)} ${trip.layerName} 仲間Lv${formatNumber(trip.companionLevelBefore)}（全員平均${formatNumber(trip.levelBefore)}）`,
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
