import type { WizWorldEnvironment } from "@/lib/wiz/core/world/world"
import { gameEnvironment } from "@/lib/wiz/definition"
import { fixedClock } from "@/lib/wiz/testing/fixed-clock"
import { sequentialIds } from "@/lib/wiz/testing/sequential-ids"

/**
 * テスト用の環境。乱数は数値か関数で渡せ、時計は固定、IDは連番。
 * 既定は「乱数 0.5・時刻 0・id-1 から」。
 */
export function testEnvironment(
  options: {
    random?: number | (() => number)
    clock?: () => number
    ids?: () => string
  } = {}
): WizWorldEnvironment {
  const random = options.random ?? 0.5
  return gameEnvironment({
    random: typeof random === "number" ? () => random : random,
    clock: options.clock ?? fixedClock(0),
    ids: options.ids ?? sequentialIds(),
  })
}
