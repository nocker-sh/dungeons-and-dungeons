import type { WizWorldEnvironment } from "@/lib/wiz/core/world/world"
import type { GameActionOf } from "@/lib/wiz/commands"
import { Bag } from "@/lib/wiz/rules/bag"
import type { GameState } from "@/lib/wiz/state/state-schema"
import type { GameDependencies } from "@/lib/wiz/application/game-dependencies"
import { inTown } from "@/lib/wiz/application/in-town"
import { accept } from "@/lib/wiz/application/accept"
import { reject } from "@/lib/wiz/application/reject"
import type { Transition } from "@/lib/wiz/application/transition"

/**
 * 店で買う。武器と防具は一つずつの個体、それ以外は袋へ。武器は N・上振れなしで2枠を抽選する。
 * 召喚石の品物（`stones`）は袋に入らず、持っている召喚石が増える。
 */
export class Buy {
  static readonly featureId = "W008"
  constructor(
    private readonly deps: Pick<GameDependencies, "catalog" | "weapons">
  ) {}

  execute(
    state: GameState,
    input: GameActionOf<"buy">,
    environment: WizWorldEnvironment
  ): Transition {
    if (!inTown(state)) return reject("WRONG_PHASE")
    const shop = this.deps.catalog.shop(input.shop)
    const good = this.deps.catalog.good(input.good)
    if (!shop || !good || !shop.goods.includes(good.id) || !good.price)
      return reject("UNKNOWN")
    // 深い層で並ぶ品物は、その層まで届くまで買えない
    if ((good.unlock ?? 0) > state.reached) return reject("LOCKED")
    if (state.gold < good.price) return reject("NO_GOLD")
    if (good.stones)
      return accept(
        {
          ...state,
          gold: state.gold - good.price,
          stones: state.stones + good.stones,
        },
        { type: "bought", good: good.id, price: good.price }
      )
    const next: GameState =
      good.kind === "weapon" || good.kind === "armor"
        ? {
            ...state,
            gear: [
              ...state.gear,
              {
                id: environment.nextId(),
                good: good.id,
                owner: null,
                plus: 0,
                progress: 0,
                wear: 0,
                weapon: this.deps.weapons.forGood(good, environment.random),
              },
            ],
          }
        : { ...state, bag: Bag.add(state.bag, [{ good: good.id, count: 1 }]) }
    return accept(
      { ...next, gold: state.gold - good.price },
      { type: "bought", good: good.id, price: good.price }
    )
  }
}
