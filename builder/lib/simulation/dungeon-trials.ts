import { lookAt } from "@/builder/lib/look-at"
import { buildContent } from "@/builder/lib/build-content"
import { idOf } from "@/builder/lib/id-of"
import type { ExpeditionPlan } from "@/builder/lib/policy/expedition"
import type { BattleStyle } from "@/builder/lib/policy/battle"
import { Session } from "@/builder/lib/session"
import type { Setup } from "@/builder/lib/simulation/prepare"
import { prepare } from "@/builder/lib/simulation/prepare"
import { rate } from "@/builder/lib/simulation/rate"
import { mean } from "@/builder/lib/simulation/mean"
import type { ExpeditionResult } from "@/builder/lib/simulation/expedition"
import { runExpedition } from "@/builder/lib/simulation/expedition"

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
