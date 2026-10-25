import { Statuses } from "@/lib/wiz/rules"
import type { Battle, GameState } from "@/lib/wiz/state"

/** order の from 番目から数えて、最初に動ける者の番号。縛られている者も最初の手番は受け取る。 */
export function firstLiving(state: GameState, battle: Battle, from: number) {
  for (let step = 0; step < battle.order.length; step++) {
    const index = from + step
    const ref = battle.order[index % battle.order.length]
    const unit =
      ref.kind === "member"
        ? state.members.find((member) => member.id === ref.id)
        : battle.foes.find((foe) => foe.id === ref.id)
    if ((unit?.hp ?? 0) > 0 && !Statuses.has(unit?.status ?? [], "bind"))
      return index
  }
  return from
}
