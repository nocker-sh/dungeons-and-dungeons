import { Statuses } from "@/lib/wiz/rules/statuses"
import type { BattleRules } from "@/lib/wiz/rules/battle-rules"
import type { ActorRef, Status } from "@/lib/wiz/state/state-schema"
import type { GameEvent } from "@/lib/wiz/state/game-event"

type TurnContext = {
  unit(
    ref: ActorRef
  ): { hp: number; maxHp: number; status: readonly Status[] } | null
  setHp(ref: ActorRef, hp: number): void
  setStatus(ref: ActorRef, status: Status[]): void
  events: GameEvent[]
}

/** 手番末の再生・毒・状態の期限。勝敗と次の手番は決めない。 */
export function applyTurnEffects(
  context: TurnContext,
  rules: Pick<BattleRules, "regen" | "poison">,
  ref: ActorRef
) {
  const unit = context.unit(ref)
  if (!unit || unit.hp <= 0) return
  if (Statuses.has(unit.status, "regen")) {
    const amount = rules.regen(unit.maxHp)
    const hp = Math.min(unit.maxHp, unit.hp + amount)
    if (hp !== unit.hp) {
      context.setHp(ref, hp)
      context.events.push({
        type: "ticked",
        target: ref,
        status: "regen",
        heal: hp - unit.hp,
        down: false,
      })
    }
  }
  if (Statuses.has(context.unit(ref)!.status, "poison")) {
    const now = context.unit(ref)!
    const amount = rules.poison(now.maxHp)
    const hp = Math.max(0, now.hp - amount)
    context.setHp(ref, hp)
    context.events.push({
      type: "ticked",
      target: ref,
      status: "poison",
      damage: now.hp - hp,
      down: hp === 0,
    })
    if (hp === 0) {
      context.setStatus(ref, [])
      return
    }
  }
  context.setStatus(ref, Statuses.tick(context.unit(ref)!.status))
}
