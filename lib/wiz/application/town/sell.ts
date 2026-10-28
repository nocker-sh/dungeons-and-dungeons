import type { GameActionOf } from "@/lib/wiz/commands"
import { Bag } from "@/lib/wiz/rules/bag"
import { baseSellPrice } from "@/lib/wiz/rules/base-sell-price"
import type { GameState } from "@/lib/wiz/state/state-schema"
import type { GameDependencies } from "@/lib/wiz/application/game-dependencies"
import { inTown } from "@/lib/wiz/application/in-town"
import { accept } from "@/lib/wiz/application/accept"
import { reject } from "@/lib/wiz/application/reject"
import type { Transition } from "@/lib/wiz/application/transition"

/**
 * 品物を一つ売る。袋の品物か、誰も装備していない武器・防具。
 * レア度の高い武器は高く売れ、強化した段は売値に乗り、減った防具は修理代のぶんだけ下がる。
 */
export class Sell {
  static readonly featureId = "W009"
  constructor(
    private readonly deps: Pick<GameDependencies, "catalog" | "party">
  ) {}

  execute(state: GameState, input: GameActionOf<"sell">): Transition {
    if (!inTown(state)) return reject("WRONG_PHASE")
    if (input.gear) {
      const gear = state.gear.find((entry) => entry.id === input.gear)
      const good = gear ? this.deps.catalog.good(gear.good) : undefined
      if (!gear || !good) return reject("NOT_OWNED")
      if (good.sellable === false) return reject("UNAVAILABLE")
      if (gear.unidentified) return reject("UNAVAILABLE")
      if (gear.owner) return reject("UNAVAILABLE")
      const price = this.deps.party.equipment.sellPriceOf(gear)
      return accept(
        {
          ...state,
          gear: state.gear.filter((entry) => entry.id !== gear.id),
          gold: state.gold + price,
        },
        { type: "sold", good: good.id, price }
      )
    }
    const good = input.good ? this.deps.catalog.good(input.good) : undefined
    if (!good) return reject("UNKNOWN")
    if (good.sellable === false) return reject("UNAVAILABLE")
    const bag = Bag.remove(state.bag, good.id)
    if (!bag) return reject("NOT_OWNED")
    const price = baseSellPrice(good)
    return accept(
      { ...state, bag, gold: state.gold + price },
      { type: "sold", good: good.id, price }
    )
  }
}
