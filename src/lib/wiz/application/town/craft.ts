import type { WizWorldEnvironment } from "@/lib/wiz/core/world/world"
import type { GameActionOf } from "@/lib/wiz/commands"
import { Bag } from "@/lib/wiz/rules"
import type { GameState } from "@/lib/wiz/state"
import type { GameDependencies } from "@/lib/wiz/application/game-dependencies"
import { inTown } from "@/lib/wiz/application/in-town"
import {
  accept,
  reject,
  type Transition,
} from "@/lib/wiz/application/transition"

/** 鍛冶屋でレシピの品物を作る。武器・防具は個体、それ以外は袋へ。武器は N で2枠を抽選する。 */
export class Craft {
  static readonly featureId = "W024"
  constructor(
    private readonly deps: Pick<GameDependencies, "catalog" | "weapons">
  ) {}

  execute(
    state: GameState,
    input: GameActionOf<"craft">,
    environment: WizWorldEnvironment
  ): Transition {
    if (!inTown(state)) return reject("WRONG_PHASE")
    const recipe = this.deps.catalog.recipe(input.recipe)
    const good = recipe && this.deps.catalog.good(recipe.good)
    if (!recipe || !good) return reject("UNKNOWN")
    if (state.gold < recipe.gold) return reject("NO_GOLD")
    const bag = Bag.pay(state.bag, recipe.materials)
    if (!bag) return reject("NO_MATERIALS")
    const gold = state.gold - recipe.gold
    if (good.kind === "weapon" || good.kind === "armor") {
      const gear = environment.nextId()
      return accept(
        {
          ...state,
          gold,
          bag,
          gear: [
            ...state.gear,
            {
              id: gear,
              good: good.id,
              owner: null,
              plus: 0,
              progress: 0,
              wear: 0,
              weapon: this.deps.weapons.forGood(good, environment.random),
            },
          ],
        },
        { type: "crafted", recipe: recipe.id, good: good.id, gear }
      )
    }
    return accept(
      { ...state, gold, bag: Bag.add(bag, [{ good: good.id, count: 1 }]) },
      { type: "crafted", recipe: recipe.id, good: good.id, gear: null }
    )
  }
}
