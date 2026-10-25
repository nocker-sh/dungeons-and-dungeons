import type { WizWorldEnvironment } from "@/lib/wiz/core/world/world"
import type { Game } from "@/lib/wiz/game"
import type { GameState } from "@/lib/wiz/state"
import { GameDefinition } from "@/lib/wiz/definition/game-definition"
import type { GameRules } from "@/lib/wiz/definition/game-rules"
import {
  gameEnvironment,
  type GameEnvironmentOptions,
} from "@/lib/wiz/definition/game-environment"

export type CreateGameOptions = GameEnvironmentOptions &
  Readonly<{
    /** 作品のデータ（検証済みの `GameCatalog` も渡せる）。 */
    content: unknown
    /** 差し替える計算規則。渡すときは `rulesRevision` も必ず付ける。 */
    rules?: GameRules
    rulesRevision?: string
    /** 組み立て済みの環境。渡すと random・clock・ids より優先する。 */
    environment?: WizWorldEnvironment
    /** 始める状態。省略ではじめから。 */
    initialState?: GameState
  }>

/**
 * 一回の呼び出しでプレイを組み立てる入口。
 * 外部依存（乱数・時計・ID）はここだけで差し替える。同じデータで何度も作るなら `GameDefinition` を使い回す。
 */
export function createGame(options: CreateGameOptions): Game {
  const definition = new GameDefinition(options.content, {
    rules: options.rules,
    rulesRevision: options.rulesRevision,
  })
  const environment =
    options.environment ??
    gameEnvironment({
      random: options.random,
      clock: options.clock,
      ids: options.ids,
    })
  return definition.create(environment, options.initialState)
}
