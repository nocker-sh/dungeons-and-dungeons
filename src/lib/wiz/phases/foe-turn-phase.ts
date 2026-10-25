import type { Game } from "@/lib/wiz/game"
import type { GameState } from "@/lib/wiz/state"
import { PhaseBase, type PhaseResolver } from "@/lib/wiz/phases/phase-base"
import { AFTER_TURN, type AfterTurn } from "@/lib/wiz/phases/phase"

/** 敵の手番：進めるだけ。 */
export class FoeTurnPhase extends PhaseBase {
  readonly kind = "foe-turn"

  constructor(
    game: Game,
    state: GameState,
    resolve: PhaseResolver,
    /** 手番の敵。 */
    readonly actor: string
  ) {
    super(game, state, resolve)
  }

  resolve() {
    return this.send<AfterTurn>({ type: "foe-turn" }, AFTER_TURN)
  }
}
