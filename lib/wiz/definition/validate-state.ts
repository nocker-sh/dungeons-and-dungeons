import type { GameCatalog } from "@/lib/wiz/content/game-catalog"
import { StateIntegrityError } from "@/lib/wiz/integrity/state-integrity-error"
import { stateProblems } from "@/lib/wiz/integrity/state-problems"
import { stateSchema } from "@/lib/wiz/state/state-schema"
import type { GameState } from "@/lib/wiz/state/state-schema"

/**
 * 状態の境界での検証。形（zod）と今のコンテンツとの食い違いを確かめる。
 * 保存の読み込みと開始時の状態だけに使い、読めない保存は自動で上書きせずに例外にする。
 */
export function validateState(state: unknown, catalog: GameCatalog): GameState {
  const parsed: GameState = stateSchema.parse(state)
  const problems = stateProblems(parsed, catalog)
  if (problems.length) throw new StateIntegrityError(problems)
  return parsed
}
