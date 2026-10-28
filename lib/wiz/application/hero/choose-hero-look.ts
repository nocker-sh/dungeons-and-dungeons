import type { GameActionOf } from "@/lib/wiz/commands"
import type { GameState } from "@/lib/wiz/state/state-schema"
import type { GameDependencies } from "@/lib/wiz/application/game-dependencies"
import { inTown } from "@/lib/wiz/application/in-town"
import { accept } from "@/lib/wiz/application/accept"
import { reject } from "@/lib/wiz/application/reject"
import type { Transition } from "@/lib/wiz/application/transition"

/** 街で能力・装備・名前を保って容姿を変える。最初の容姿はギルドの登録用紙で選ぶ（W037）。 */
export class ChooseHeroLook {
  static readonly featureId = "W036"
  constructor(private readonly deps: Pick<GameDependencies, "catalog">) {}

  execute(
    state: GameState,
    input: GameActionOf<"choose-hero-look">
  ): Transition {
    if (!inTown(state)) return reject("WRONG_PHASE")
    if (!this.deps.catalog.data.hero.looks.includes(input.look))
      return reject("UNKNOWN")
    if (
      input.outfit &&
      !this.deps.catalog.data.hero.outfits?.includes(input.outfit)
    )
      return reject("UNKNOWN")
    if (
      input.look === state.hero.look &&
      (input.outfit === undefined ||
        input.outfit === (state.hero.outfit ?? null))
    )
      return reject("ALREADY")
    return accept(
      {
        ...state,
        hero: {
          ...state.hero,
          look: input.look,
          ...(input.outfit !== undefined &&
          (input.outfit !== null || state.hero.outfit !== undefined)
            ? { outfit: input.outfit }
            : {}),
        },
      },
      { type: "hero-look-chosen", look: input.look }
    )
  }
}
