import { rateInterval } from "@/builder/lib/rate-interval"
import { settled } from "@/builder/lib/settled"
import type { BattleStyle } from "@/builder/lib/policy/battle"
import { battleTrials } from "@/builder/lib/simulation/battle-trials"
import { arenaContent } from "@/builder/lib/simulation/arena-content"

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
  /** threshold に届いたレベルで測り終える（曲線の続きが要らない目標の測定）。 */
  stopAtThreshold?: boolean
}) {
  const curve: { level: number; win: number }[] = []
  let found: number | null = null
  // 闘技場はレベルによらず同じなので、データの複製と検証を1回で済ませる
  const built = arenaContent(options.overrides, options.foes, options.boss)
  for (let level = options.from; level <= options.to; level++) {
    const result = battleTrials({
      ...options,
      built,
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
    if (options.stopAtThreshold && found !== null) break
    if (result.win.p >= 0.98) break
  }
  return { level: found, curve }
}
