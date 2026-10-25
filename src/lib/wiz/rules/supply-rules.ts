import type { GameCatalog } from "@/lib/wiz/content"
import type { GameState, Stack } from "@/lib/wiz/state"
import { Bag } from "@/lib/wiz/rules/bag"

/** 倉庫の在庫から持ち出す消耗品。装備と戦利品は枠を使わない。 */
export class SupplyRules {
  static readonly capacity = 8

  static packed(state: GameState, catalog: GameCatalog): Stack[] {
    let space = SupplyRules.capacity
    const selected = state.provisions ?? state.bag
    const packed: Stack[] = []
    for (const entry of selected) {
      if (catalog.good(entry.good)?.kind !== "item") continue
      const count = Math.min(
        entry.count,
        Bag.count(state.bag, entry.good) - Bag.count(packed, entry.good),
        space
      )
      if (count <= 0) continue
      packed.push({ good: entry.good, count })
      space -= count
    }
    return packed
  }

  static available(state: GameState, catalog: GameCatalog) {
    return state.phase.type === "town" || state.phase.type === "creating"
      ? state.bag
      : SupplyRules.packed(state, catalog)
  }
}
