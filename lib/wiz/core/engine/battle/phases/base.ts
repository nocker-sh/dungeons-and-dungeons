import type { WizEngineBattleContext } from "@/lib/wiz/core/engine/battle/context"

export abstract class WizEngineBattlePhaseBattle<TStatus = unknown, TCustom = unknown> {
  abstract readonly phase: string
  abstract readonly context: WizEngineBattleContext<TStatus, TCustom>
}
