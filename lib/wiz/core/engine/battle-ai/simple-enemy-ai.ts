import type { WizBattleMonster } from "@/lib/wiz/core/engine/battle/actors/monster"
import type { WizBattleActorState } from "@/lib/wiz/core/engine/battle/actor-state"
import type { WizEngineBattleContext } from "@/lib/wiz/core/engine/battle/context"
import type { WizEngineBattleTurnAction } from "@/lib/wiz/core/engine/battle/turn-action"
import { WizEngineBattleActionBuilder } from "@/lib/wiz/core/engine/battle/turn-action-builder"
import { WizDice } from "@/lib/wiz/core/services/wiz-dice"

/**
 * 敵 AI を差し替えるstructural port。
 *
 * カスタム AI を実装するには:
 * 1. 本portを実装したクラスを作る
 * 2. WizSceneBattleService の `enemyAI` に渡す
 *
 * 既定実装は WizEngineBattleSimpleEnemyAI (random / weakest / strongest 戦略)。
 */
export type WizEngineBattleEnemyAI<TStatus = unknown, TCustom = unknown> = Readonly<{
  readonly selectAction: (
    monster: WizBattleMonster<TStatus, TCustom>,
    context: WizEngineBattleContext<TStatus, TCustom>,
  ) => WizEngineBattleTurnAction | null
}>

export type WizEngineBattleEnemyAIStrategy = "random" | "weakest" | "strongest"

export type WizEngineBattleSimpleEnemyAIDefinition = {
  readonly strategy?: WizEngineBattleEnemyAIStrategy
  readonly dice?: WizDice
  readonly actionBuilder?: WizEngineBattleActionBuilder
}

export class WizEngineBattleSimpleEnemyAI<
  TStatus = unknown,
  TCustom = unknown,
> implements WizEngineBattleEnemyAI<TStatus, TCustom> {
  readonly strategy: WizEngineBattleEnemyAIStrategy
  private readonly dice: WizDice
  private readonly actionBuilder: WizEngineBattleActionBuilder

  constructor(properties: WizEngineBattleSimpleEnemyAIDefinition = {}) {
    this.strategy = properties.strategy ?? "random"
    this.dice = properties.dice ?? new WizDice()
    this.actionBuilder = properties.actionBuilder ?? new WizEngineBattleActionBuilder()
    Object.freeze(this)
  }

  readonly selectAction = (
    monster: WizBattleMonster<TStatus, TCustom>,
    context: WizEngineBattleContext<TStatus, TCustom>,
  ): WizEngineBattleTurnAction | null => {
    if (!monster.canAct()) {
      return null
    }

    // 戦闘中のメンバーのみを対象 (逃走済みを除外)
    const inBattleMembers = context.party.getInBattleMembers()
    if (inBattleMembers.length === 0) {
      return null
    }

    const target = this.selectTarget(inBattleMembers, this.strategy)
    if (!target) {
      return null
    }

    // 基本攻撃のみ
    return this.actionBuilder.attack(monster.id, target.id)
  }

  private selectTarget<T extends { id: string; status: WizBattleActorState }>(
    candidates: readonly T[],
    strategy: WizEngineBattleEnemyAIStrategy,
  ): T | null {
    if (candidates.length === 0) {
      return null
    }

    if (strategy === "weakest") {
      return candidates.toSorted(
        (a, b) => a.status.resources.current("health") - b.status.resources.current("health"),
      )[0]
    }

    if (strategy === "strongest") {
      return candidates.toSorted(
        (a, b) => b.status.resources.current("health") - a.status.resources.current("health"),
      )[0]
    }

    return this.dice.pick(candidates)
  }
}

Object.freeze(WizEngineBattleSimpleEnemyAI.prototype)
Object.freeze(WizEngineBattleSimpleEnemyAI)
