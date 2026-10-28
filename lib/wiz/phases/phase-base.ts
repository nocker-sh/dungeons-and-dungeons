import { GameCommandError } from "@/lib/wiz/game/game-command-error"
import type { Game } from "@/lib/wiz/game/game"
import type { GameAction } from "@/lib/wiz/commands"
import type { GameState } from "@/lib/wiz/state/state-schema"
import type { Phase, Step } from "@/lib/wiz/phases/phase"

/** 今のフェーズを求める関数。`phaseOf` を渡す（循環importを作らないため注入する）。 */
export type PhaseResolver = (game: Game) => Phase

/** フェーズの共通部分。作ったときの状態を覚え、進んでいれば STALE で断る。 */
export abstract class PhaseBase {
  abstract readonly kind: Phase["kind"]
  readonly #resolve: PhaseResolver

  constructor(
    protected readonly game: Game,
    /** このフェーズを作ったときの状態。 */
    readonly state: GameState,
    resolve: PhaseResolver
  ) {
    this.#resolve = resolve
  }

  /** 状態がこのフェーズのままか。 */
  get current() {
    return this.game.state === this.state
  }

  protected send<Next extends Phase>(
    action: GameAction,
    expected: readonly Next["kind"][]
  ): Step<Next> {
    if (!this.current) return new GameCommandError("STALE")
    const events = this.game.send(action)
    if (events instanceof GameCommandError) return events
    const next = this.#resolve(this.game)
    if (!expected.includes(next.kind as Next["kind"]))
      return new GameCommandError(
        "ENGINE_FAILURE",
        new Error(`${this.kind} の ${action.type} の後に ${next.kind} になった`)
      )
    return { events, next: next as Next }
  }
}
