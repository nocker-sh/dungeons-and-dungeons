import { rateInterval } from "@/builder/lib/rate-interval"
import { settled } from "@/builder/lib/settled"
import type { BattleStyle } from "@/builder/lib/policy/battle"
import { battleTrials } from "@/builder/lib/simulation/battle-trials"

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
