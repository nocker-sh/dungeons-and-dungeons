import type { GameCatalog } from "@/lib/wiz/content/game-catalog"
import type { GameState } from "@/lib/wiz/state/state-schema"

/** 主人公は名付けた名前、ほかの仲間は定義の名前。 */
export function memberName(
  catalog: GameCatalog,
  state: Pick<GameState, "hero">,
  id: string
) {
  const member = catalog.member(id)
  return member?.hero ? state.hero.name : (member?.name ?? id)
}
