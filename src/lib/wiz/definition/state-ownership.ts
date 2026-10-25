import { WizWorldStateOwnership } from "@/lib/wiz/core/world/world"
import type { GameCatalog } from "@/lib/wiz/content"
import { StateIntegrityError, stateProblems } from "@/lib/wiz/integrity"
import { stateSchema, type GameState } from "@/lib/wiz/state"

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

/**
 * 操作ごとの状態の所有。規則が作った状態は検証し直さず、変わった部分だけを複製して凍らせる
 * （変わっていない部分は前の状態と共有する）。状態全体の検証は境界（`validateState`）で行う。
 */
export function createStateOwnership() {
  return WizWorldStateOwnership.deepImmutable<GameState>()
}
