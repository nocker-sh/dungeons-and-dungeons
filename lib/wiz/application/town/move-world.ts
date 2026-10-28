import type { GameActionOf } from "@/lib/wiz/commands"
import type { GameDependencies } from "@/lib/wiz/application/game-dependencies"
import type { GameState } from "@/lib/wiz/state/state-schema"
import { WorldMapRules } from "@/lib/wiz/rules/world-map"
import { accept } from "@/lib/wiz/application/accept"
import { reject } from "@/lib/wiz/application/reject"

export class MoveWorld {
  static readonly featureId = "W041"
  constructor(private readonly deps: Pick<GameDependencies, "catalog">) {}
  execute(state: GameState, input: GameActionOf<"move-world">) {
    const rules = new WorldMapRules(this.deps.catalog)
    const view = rules.view(state)
    if (!view?.ready) return reject("NOT_READY")
    const tile = view.tiles.find((entry) => entry.id === input.tile)
    if (!tile?.canMove) return reject("LOCKED")
    const journey = rules.journey(state)
    return accept({
      ...state,
      journey: {
        ...journey,
        at: tile.id,
        visited: [...new Set([...journey.visited, tile.id])],
      },
    })
  }
}
