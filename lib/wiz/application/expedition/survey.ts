import type { WizWorldEnvironment } from "@/lib/wiz/core/world/world"
import type { GameDependencies } from "@/lib/wiz/application/game-dependencies"
import type { GameActionOf } from "@/lib/wiz/commands"
import type { GameState } from "@/lib/wiz/state/state-schema"
import { ExplorationRules } from "@/lib/wiz/rules/exploration-rules"
import { accept } from "@/lib/wiz/application/accept"
import { reject } from "@/lib/wiz/application/reject"
import type { Transition } from "@/lib/wiz/application/transition"

/** 次の道の正体を見抜き、この探索中の結果を確定する。 */
export class Survey {
  static readonly featureId = "W038"

  constructor(
    private readonly deps: Pick<GameDependencies, "catalog" | "expedition">
  ) {}

  execute(
    state: GameState,
    input: GameActionOf<"survey">,
    environment: WizWorldEnvironment
  ): Transition {
    if (state.phase.type !== "expedition") return reject("WRONG_PHASE")
    const expedition = state.phase.expedition
    if (expedition.pending) return reject("PENDING")
    const rules = new ExplorationRules(this.deps.catalog)
    if (!rules.has(state, "scout")) return reject("UNAVAILABLE")
    const surveyed = expedition.surveyed ?? []
    if (
      surveyed.length >= ExplorationRules.surveyLimit ||
      surveyed.some((entry) => entry.station === input.to)
    )
      return reject("UNAVAILABLE")
    const here = this.deps.catalog.station(expedition.layer, expedition.at)
    if (!here?.next.includes(input.to)) return reject("NOT_NEXT")
    const station = this.deps.catalog.station(expedition.layer, input.to)
    const layer = this.deps.catalog.layer(expedition.layer)
    if (!station?.mystery || station.event || !layer)
      return reject("UNAVAILABLE")
    const kind = this.deps.expedition.draw(layer, station, environment.random)
    return accept(
      {
        ...state,
        phase: {
          type: "expedition",
          expedition: {
            ...expedition,
            surveyed: [...surveyed, { station: station.id, kind }],
          },
        },
      },
      { type: "surveyed", station: station.id, kind }
    )
  }
}
