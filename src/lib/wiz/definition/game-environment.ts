import { WizWorldEnvironment } from "@/lib/wiz/core/world/world"

/** 差し替えられる外部依存。省略すると環境の既定（本番の乱数・時計・ID）になる。 */
export type GameEnvironmentOptions = Readonly<{
  /** 乱数（0以上1未満）。 */
  random?: () => number
  /** 時計（ミリ秒）。 */
  clock?: () => number
  /** 装備などの個体 ID。 */
  ids?: () => string
}>

/** 乱数・時計・ID を一つの環境にまとめる。 */
export function gameEnvironment(
  options: GameEnvironmentOptions = {}
): WizWorldEnvironment {
  return WizWorldEnvironment.create({
    random: options.random,
    now: options.clock,
    nextId: options.ids,
  })
}
