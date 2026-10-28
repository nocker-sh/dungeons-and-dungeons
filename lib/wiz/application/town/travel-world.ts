import type { GameActionOf } from "@/lib/wiz/commands"
import type { GameDependencies } from "@/lib/wiz/application/game-dependencies"
import type { GameState } from "@/lib/wiz/state/state-schema"
import { WorldMapRules } from "@/lib/wiz/rules/world-map"
import { accept } from "@/lib/wiz/application/accept"
import { reject } from "@/lib/wiz/application/reject"

export class TravelWorld {
  static readonly featureId = "W042"
  constructor(private readonly deps: Pick<GameDependencies, "catalog">) {}
  execute(state: GameState, input: GameActionOf<"travel-world">) {
    const rules = new WorldMapRules(this.deps.catalog)
    const view = rules.view(state)
    if (!view?.tiles.find((tile) => tile.id === input.tile)?.canTravel)
      return reject("LOCKED")
    return accept({
      ...state,
      journey: { ...rules.journey(state), at: input.tile },
    })
  }
}
