import type { WizWorld } from "@/lib/wiz/core/world/world"
import type { WizWorldSaveCodec } from "@/lib/wiz/core/save/world-save-codec"
import type { GameAction } from "@/lib/wiz/commands"
import type { GameQueries } from "@/lib/wiz/queries/game-queries"
import type { GameEvent } from "@/lib/wiz/state/game-event"
import type { GameReason } from "@/lib/wiz/state/game-reason"
import type { GameState } from "@/lib/wiz/state/state-schema"
import { GameCommandError } from "@/lib/wiz/game/game-command-error"
import type { GameSnapshot } from "@/lib/wiz/game/game-snapshot"

/** 一つのプレイを所有し、検証済みの遷移だけを購読者へ公開する。 */
export class Game {
  #snapshot: GameSnapshot
  #listeners = new Set<() => void>()
  #dispatching = false

  constructor(
    readonly queries: GameQueries,
    private readonly world: WizWorld<
      GameState,
      GameAction,
      GameEvent,
      GameReason
    >,
    private readonly codec: Pick<
      WizWorldSaveCodec<GameState>,
      "encode" | "decodeSnapshot"
    >
  ) {
    this.#snapshot = Object.freeze({ state: world.initialState, error: null })
  }

  getSnapshot = (): GameSnapshot => this.#snapshot

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener)
    return () => {
      this.#listeners.delete(listener)
    }
  }

  get state() {
    return this.#snapshot.state
  }

  send(action: GameAction): readonly GameEvent[] | GameCommandError {
    return this.sendUnknown(action)
  }

  sendUnknown(action: unknown): readonly GameEvent[] | GameCommandError {
    if (this.#dispatching) return new GameCommandError("ENGINE_FAILURE")
    this.#dispatching = true
    try {
      const result = this.world.dispatchUnknown(this.#snapshot.state, action)
      if (result.isRejected())
        return this.#fail(
          "reason" in result.error ? result.error.reason : "INVALID_ACTION"
        )
      this.#snapshot = Object.freeze({ state: result.state, error: null })
      return result.events
    } catch (cause) {
      return this.#fail("ENGINE_FAILURE", cause)
    } finally {
      this.#dispatching = false
      this.#publish()
    }
  }

  save() {
    return this.codec.encode(this.#snapshot.state)
  }

  restore(input: unknown): void | GameCommandError {
    if (this.#dispatching) return new GameCommandError("ENGINE_FAILURE")
    try {
      const state = this.world.stateOwnership.own(
        this.codec.decodeSnapshot(input)
      )
      this.#snapshot = Object.freeze({ state, error: null })
    } catch (cause) {
      const error = this.#fail("INVALID_SAVE", cause)
      this.#publish()
      return error
    }
    this.#publish()
  }

  #fail(code: GameReason, cause?: unknown) {
    this.#snapshot = Object.freeze({ state: this.#snapshot.state, error: code })
    return new GameCommandError(code, cause)
  }

  #publish() {
    for (const listener of Array.from(this.#listeners)) listener()
  }
}
