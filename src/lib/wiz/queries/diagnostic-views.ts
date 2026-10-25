import type { GameCatalog } from "@/lib/wiz/content"
import { stateProblems } from "@/lib/wiz/integrity"
import type { GameState } from "@/lib/wiz/state"

/** 診断用：状態と今のコンテンツの食い違い。 */
export class DiagnosticViews {
  constructor(private readonly catalog: GameCatalog) {}

  problems(state: GameState) {
    return stateProblems(state, this.catalog)
  }
}
