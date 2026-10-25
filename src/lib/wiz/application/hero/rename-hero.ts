import type { GameActionOf } from "@/lib/wiz/commands"
import { heroName } from "@/lib/wiz/rules"
import type { GameState } from "@/lib/wiz/state"
import { inTown } from "@/lib/wiz/application/in-town"
import {
  accept,
  reject,
  type Transition,
} from "@/lib/wiz/application/transition"

/** 街で主人公の名前を変える。外見は変えない。 */
export class RenameHero {
  static readonly featureId = "W030"

  execute(state: GameState, input: GameActionOf<"rename-hero">): Transition {
    if (!inTown(state)) return reject("WRONG_PHASE")
    if (state.hero.registrationPending) return reject("INVALID_ACTION")
    const name = heroName(input.name)
    if (!name) return reject("INVALID_ACTION")
    if (name === state.hero.name) return reject("ALREADY")
    return accept(
      { ...state, hero: { ...state.hero, name } },
      { type: "hero-renamed", name }
    )
  }
}
