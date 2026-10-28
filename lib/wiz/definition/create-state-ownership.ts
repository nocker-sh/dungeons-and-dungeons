import { WizWorldStateOwnership } from "@/lib/wiz/core/world/world"
import type { GameState } from "@/lib/wiz/state/state-schema"

/**
 * 操作ごとの状態の所有。規則が作った状態は検証し直さず、変わった部分だけを複製して凍らせる
 * （変わっていない部分は前の状態と共有する）。状態全体の検証は境界（`validateState`）で行う。
 */
export function createStateOwnership() {
  return WizWorldStateOwnership.deepImmutable<GameState>()
}
