import type { Battle } from "@/lib/wiz/state/state-schema"

/** いま手番が回っている者。 */
export function currentActor(battle: Battle) {
  return battle.order[battle.turn % battle.order.length]
}
