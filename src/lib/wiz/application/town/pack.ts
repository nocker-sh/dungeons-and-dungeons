import type { GameActionOf } from "@/lib/wiz/commands"
import type { GameDependencies } from "@/lib/wiz/application/game-dependencies"
import {
  accept,
  reject,
  type Transition,
} from "@/lib/wiz/application/transition"
import { Bag } from "@/lib/wiz/rules/bag"
import { SupplyRules } from "@/lib/wiz/rules/supply-rules"
import type { GameState } from "@/lib/wiz/state"

export class Pack {
  constructor(private readonly deps: Pick<GameDependencies, "catalog">) {}
  execute(state: GameState, input: GameActionOf<"pack">): Transition {
    if (state.phase.type !== "town") return reject("WRONG_PHASE")
    if (this.deps.catalog.good(input.good)?.kind !== "item")
      return reject("UNAVAILABLE")
    if (Bag.count(state.bag, input.good) < input.count) return reject("NO_ITEM")
    const provisions = SupplyRules.packed(state, this.deps.catalog).filter(
      (entry) => entry.good !== input.good
    )
    if (input.count) provisions.push({ good: input.good, count: input.count })
    if (
      provisions.reduce((sum, entry) => sum + entry.count, 0) >
      SupplyRules.capacity
    )
      return reject("SHORT")
    return accept(
      { ...state, provisions },
      { type: "packed", good: input.good, count: input.count }
    )
  }
}
