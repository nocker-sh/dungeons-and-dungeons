import { createGame } from "@/lib/wiz/definition/create-game"
import type { GameRules } from "@/lib/wiz/definition/game-rules"
import type { Game } from "@/lib/wiz/game/game"
import type { GameState } from "@/lib/wiz/state/state-schema"
import { realContent } from "@/lib/wiz/testing/real-content"
import { GameStateBuilder } from "@/lib/wiz/testing/state-builder"
import { fixedClock } from "@/lib/wiz/testing/fixed-clock"
import { sequentialIds } from "@/lib/wiz/testing/sequential-ids"

export type TestGameOptions = Readonly<{
  /** 既定は本物の作品データ（`realContent()`）。 */
  content?: unknown
  /** 始める状態。省略で「遊べる街」（`aState()` と同じ）。 */
  state?: GameState
  /** 本物の「はじめから」（主人公を作る場面・悪魔なし）から始める。 */
  fresh?: boolean
  /** 数値なら毎回その値。既定は 0.5。 */
  random?: number | (() => number)
  clock?: () => number
  ids?: () => string
  rules?: GameRules
  rulesRevision?: string
}>

/**
 * 乱数・時計・IDを固定したテスト用のプレイ。既定は「乱数 0.5・時刻 0・id-1 から」。
 * 状態は既定で「遊べる街」（`aState()`）。`fresh: true` で本物のはじめからになる。
 */
export function createTestGame(options: TestGameOptions = {}): Game {
  const random = options.random ?? 0.5
  return createGame({
    content: options.content ?? realContent(),
    initialState:
      options.state ??
      (options.fresh
        ? undefined
        : GameStateBuilder.of(options.content ?? realContent()).build()),
    random: typeof random === "number" ? () => random : random,
    clock: options.clock ?? fixedClock(0),
    ids: options.ids ?? sequentialIds(),
    rules: options.rules,
    rulesRevision: options.rulesRevision,
  })
}
