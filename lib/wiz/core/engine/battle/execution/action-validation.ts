import type {
  WizBattleAbility,
  WizBattleAbilityTarget,
} from "@/lib/wiz/core/engine/battle/ability"
import type { WizBattleEnemyParty } from "@/lib/wiz/core/engine/battle/actors/enemy-party"
import type { WizBattleParty } from "@/lib/wiz/core/engine/battle/actors/party"
import type { WizBattleItem } from "@/lib/wiz/core/engine/battle/item"

export type WizEngineBattleActionAuthority = {
  readonly actorAbilityIds: readonly string[]
  readonly availableItemIds: readonly string[]
}

export type TargetSide = "party" | "enemies"

export type ResolvedActionBase = {
  readonly id: string
  readonly actorId: string
  readonly targetIds: readonly string[]
  readonly targetType: WizBattleAbilityTarget
}

export type WizEngineBattleResolvedAction =
  | (ResolvedActionBase & {
      readonly type: "attack"
    })
  | (ResolvedActionBase & {
      readonly type: "defend"
    })
  | (ResolvedActionBase & {
      readonly type: "flee"
    })
  | (ResolvedActionBase & {
      readonly type: "ability"
      readonly abilityId: string
      readonly ability: WizBattleAbility
    })
  | (ResolvedActionBase & {
      readonly type: "item"
      readonly itemId: string
      readonly item: WizBattleItem
    })

export type ValidationInput<TStatus = unknown, TCustom = unknown> = {
  readonly action: WizEngineBattleResolvedAction
  readonly party: WizBattleParty<TStatus>
  readonly enemies: WizBattleEnemyParty<TStatus, TCustom>
  readonly authority: WizEngineBattleActionAuthority
}
