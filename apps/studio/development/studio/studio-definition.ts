import { GameDefinition } from "@/lib/wiz/definition/game-definition"
import type { GameContent } from "@/lib/wiz/content/content-schema"

const definitions = new WeakMap<GameContent, GameDefinition>()

/**
 * 同じ作品データから場面を組み立てるたびに、定義（検証・凍結したカタログと規則）を作り直さない。
 * 作品データの検証は1回で数十msかかり、場面の一覧と開始のたびに繰り返すと切り替えが重くなる。
 * 定義はプレイ間で共有する前提なので、同じ作品データからは同じ定義を返す。作品データは渡した後に書き換えない。
 */
export function studioDefinition(content: GameContent): GameDefinition {
  const cached = definitions.get(content)
  if (cached) return cached
  const definition = new GameDefinition(content)
  definitions.set(content, definition)
  return definition
}
