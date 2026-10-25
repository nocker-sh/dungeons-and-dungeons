import type { GameState } from "@/lib/wiz/state"
import { BlessingRules } from "@/lib/wiz/rules/blessing-rules"
import type { GameDependencies } from "@/lib/wiz/application/game-dependencies"
import {
  accept,
  reject,
  type Transition,
} from "@/lib/wiz/application/transition"

/**
 * 撤退して街へ戻る。拾った物はそのまま持ち帰る。
 * 中ボスを倒してから戻ると、持ち帰る金貨に手当てが付く（`balance.depth.retreatBonus`）。
 */
export class Retreat {
  static readonly featureId = "W003"
  constructor(
    private readonly deps: Pick<GameDependencies, "catalog" | "expedition">
  ) {}

  execute(state: GameState): Transition {
    if (state.phase.type !== "expedition") return reject("WRONG_PHASE")
    const { expedition } = state.phase
    const { loot } = expedition
    const passed = expedition.visited.some(
      (id) =>
        this.deps.catalog.station(expedition.layer, id)?.event === "midboss"
    )
    const bonus = passed ? this.deps.expedition.retreatBonus(loot.gold) : 0
    return accept(
      {
        ...state,
        members: BlessingRules.clear(state),
        gold: state.gold + bonus,
        phase: { type: "town" },
      },
      { type: "returned", gold: loot.gold, goods: loot.goods, bonus }
    )
  }
}
