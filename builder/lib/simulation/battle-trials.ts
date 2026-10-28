import { lookAt } from "@/builder/lib/look-at"
import type { BattleStyle } from "@/builder/lib/policy/battle"
import { Session } from "@/builder/lib/session"
import type { Setup } from "@/builder/lib/simulation/prepare"
import { arenaContent } from "@/builder/lib/simulation/arena-content"
import { prepare } from "@/builder/lib/simulation/prepare"
import { newTally } from "@/builder/lib/simulation/new-tally"
import { fightToEnd } from "@/builder/lib/simulation/fight-to-end"
import { rate } from "@/builder/lib/simulation/rate"
import { mean } from "@/builder/lib/simulation/mean"

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
