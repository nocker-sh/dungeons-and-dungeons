import type { GameCatalog } from "@/lib/wiz/content/game-catalog"
import type { GameState, Stack } from "@/lib/wiz/state/state-schema"
import { Bag } from "@/lib/wiz/rules/bag"

/** 倉庫の在庫から持ち出す消耗品。装備と戦利品は枠を使わない。 */
export class SupplyRules {
  static readonly capacity = 8

  static packed(state: GameState, catalog: GameCatalog): Stack[] {
    let space = SupplyRules.capacity
    const selected = state.provisions ?? state.bag
    const packed: Stack[] = []
    for (const entry of selected) {
      if (space === 0) break
      if (catalog.good(entry.good)?.kind !== "item") continue
      const count = Math.min(
        entry.count,
        Bag.count(state.bag, entry.good) - Bag.count(packed, entry.good),
        space
      )
      if (count <= 0) continue
      // 旧保存では同じ道具が複数の束に分かれる。先頭から選ぶ順序は保ち、
      // 保存する設定だけを一品一行へまとめる（重複した設定は保存境界で拒否する）。
      const found = packed.find((packed) => packed.good === entry.good)
      if (found) found.count += count
      else packed.push({ good: entry.good, count })
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
