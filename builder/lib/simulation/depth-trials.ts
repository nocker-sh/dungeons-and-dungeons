import { buildContent } from "@/builder/lib/build-content"
import { idOf } from "@/builder/lib/id-of"
import { PUSH_PLAN } from "@/builder/lib/policy/expedition"
import type { BattleStyle } from "@/builder/lib/policy/battle"
import { Session } from "@/builder/lib/session"
import type { Setup } from "@/builder/lib/simulation/prepare"
import { prepare } from "@/builder/lib/simulation/prepare"
import { rate } from "@/builder/lib/simulation/rate"
import { mean } from "@/builder/lib/simulation/mean"
import type { ExpeditionResult } from "@/builder/lib/simulation/expedition"
import { runExpedition } from "@/builder/lib/simulation/expedition"

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
