import type { WizBattleCharacter } from "@/lib/wiz/core/engine/battle/actors/character"
import type { WizBattleEnemyParty } from "@/lib/wiz/core/engine/battle/actors/enemy-party"
import type { WizBattleMonster } from "@/lib/wiz/core/engine/battle/actors/monster"
import type { WizBattleParty } from "@/lib/wiz/core/engine/battle/actors/party"
import type { WizEngineBattleContext } from "@/lib/wiz/core/engine/battle/context"
import type { WizEngineBattleExecutionOptions } from "@/lib/wiz/core/engine/battle/execution/action-executor"
import {
  WizEngineBattleExecutionResult,
  type WizEngineBattleExecutionRejectionReason,
} from "@/lib/wiz/core/engine/battle/execution/execution-result"
import { WizEngineBattlePhaseBattle } from "@/lib/wiz/core/engine/battle/phases/base"
import { WizEngineBattlePhaseDefeat } from "@/lib/wiz/core/engine/battle/phases/defeat"
import { WizEngineBattlePhaseVictory } from "@/lib/wiz/core/engine/battle/phases/victory"
import { WizEngineBattleTurnAction } from "@/lib/wiz/core/engine/battle/turn-action"
import {
  WIZ_IMMUTABLE_VALUE,
  WizImmutableValue,
} from "@/lib/wiz/core/immutable-value"
import { WizObjectService } from "@/lib/wiz/core/services/wiz-object-service"
import type { WizLogMessage } from "@/lib/wiz/core/types/wiz-log-message"

const objectService = new WizObjectService()

/**
 * Turn phaseが利用するaction executorのstructural contract。
 *
 * 実装クラスへの継承やinstance判定を要求しないため、純粋な独自executorを注入できる。
 */
export type WizEngineBattleExecutor<
  TStatus = unknown,
  TCustom = unknown,
  TReason extends string = WizEngineBattleExecutionRejectionReason,
> = Readonly<{
  readonly execute: (
    action: WizEngineBattleTurnAction,
    party: WizBattleParty<TStatus>,
    enemies: WizBattleEnemyParty<TStatus, TCustom>,
    options?: WizEngineBattleExecutionOptions
  ) => WizEngineBattleExecutionResult<TStatus, TCustom, TReason>
}>

type WizEngineBattleExecutorCall<
  TStatus,
  TCustom,
  TReason extends string,
> = Readonly<{
  execute(
    action: WizEngineBattleTurnAction,
    party: WizBattleParty<TStatus>,
    enemies: WizBattleEnemyParty<TStatus, TCustom>,
    options?: WizEngineBattleExecutionOptions
  ): WizEngineBattleExecutionResult<TStatus, TCustom, TReason>
}>

export type WizEngineBattleActor = Readonly<{
  readonly id: string
  readonly name: string
  readonly speed: number
  readonly isEnemy: boolean
}>

/**
 * 各turnのactor IDを並べる純粋policy。
 *
 * 返り値はphase生成時にcanonical actor集合の完全な順列として再検証される。
 */
export type WizEngineBattleTurnOrderPolicy<
  TStatus = unknown,
  TCustom = unknown,
> = Readonly<{
  readonly order: (
    context: WizEngineBattleContext<TStatus, TCustom>
  ) => readonly string[]
}>

type Properties<TStatus = unknown, TCustom = unknown> = {
  readonly context: WizEngineBattleContext<TStatus, TCustom>
  readonly turnOrder: readonly WizEngineBattleActor[]
  readonly currentActorIndex: number
}

const getCanonicalActors = <TStatus, TCustom>(
  context: WizEngineBattleContext<TStatus, TCustom>
): readonly WizEngineBattleActor[] => {
  const partyActors = context.party.getActableMembers().map((character) => ({
    id: character.id,
    name: character.name,
    speed: context.getActorSpeed(character.id),
    isEnemy: false,
  }))
  const enemyActors = context.enemies.getAllAliveMonsters().map((monster) => ({
    id: monster.id,
    name: monster.name,
    speed: context.getActorSpeed(monster.id),
    isEnemy: true,
  }))
  return Object.freeze([...partyActors, ...enemyActors])
}

const resolveTurnOrder = <TStatus, TCustom>(
  context: WizEngineBattleContext<TStatus, TCustom>,
  orderedActorIds: readonly string[]
): readonly WizEngineBattleActor[] => {
  const actors = getCanonicalActors(context)
  const actorsById = new Map(actors.map((actor) => [actor.id, actor]))
  const uniqueIds = new Set(orderedActorIds)
  if (
    actorsById.size !== actors.length ||
    orderedActorIds.length !== actors.length ||
    uniqueIds.size !== actors.length ||
    orderedActorIds.some((actorId) => !actorsById.has(actorId))
  ) {
    throw new TypeError(
      "Battle turn-order policy must return every canonical actor ID once"
    )
  }
  return orderedActorIds.map((actorId) => {
    const actor = actorsById.get(actorId)
    if (!actor) {
      throw new TypeError(
        "Battle turn-order policy returned an unknown actor ID"
      )
    }
    return actor
  })
}

export type WizEngineBattleTurnOrderResultPhase<
  TStatus = unknown,
  TCustom = unknown,
  TRewardCustom = undefined,
> =
  | WizEngineBattlePhaseTurnOrder<TStatus, TCustom>
  | WizEngineBattlePhaseVictory<TStatus, TCustom, TRewardCustom>
  | WizEngineBattlePhaseDefeat<TStatus, TCustom>

export type WizEngineBattleTurnOrderResult<
  TStatus = unknown,
  TCustom = unknown,
  TRewardCustom = undefined,
  TReason extends string = WizEngineBattleExecutionRejectionReason,
> =
  | Readonly<{
      scene: WizEngineBattleTurnOrderResultPhase<
        TStatus,
        TCustom,
        TRewardCustom
      >
      logs: readonly WizLogMessage[]
      accepted: true
      reason: undefined
      action: WizEngineBattleTurnAction
    }>
  | Readonly<{
      scene: WizEngineBattlePhaseTurnOrder<TStatus, TCustom>
      logs: readonly []
      accepted: false
      reason: WizEngineBattleExecutionRejectionReason | TReason
      action: null
    }>

export class WizEngineBattlePhaseTurnOrder<
  TStatus = unknown,
  TCustom = unknown,
> extends WizEngineBattlePhaseBattle<TStatus, TCustom> {
  declare readonly [WIZ_IMMUTABLE_VALUE]: true
  readonly phase = "turnOrder" as const
  readonly context: WizEngineBattleContext<TStatus, TCustom>
  readonly turnOrder: readonly WizEngineBattleActor[]
  readonly currentActorIndex: number

  constructor(properties: Properties<TStatus, TCustom>) {
    super()
    this.context = properties.context
    this.turnOrder = objectService.ownImmutable(properties.turnOrder)
    this.currentActorIndex = properties.currentActorIndex
    WizImmutableValue.freeze(this)
  }

  static create<TStatus = unknown, TCustom = unknown>(
    context: WizEngineBattleContext<TStatus, TCustom>,
    orderedActorIds: readonly string[]
  ): WizEngineBattlePhaseTurnOrder<TStatus, TCustom> {
    return new WizEngineBattlePhaseTurnOrder({
      context,
      turnOrder: resolveTurnOrder(context, orderedActorIds),
      currentActorIndex: 0,
    })
  }

  getCurrentActor(): WizEngineBattleActor | null {
    if (this.currentActorIndex >= this.turnOrder.length) {
      return null
    }
    return this.turnOrder[this.currentActorIndex]
  }

  getCurrentActorEntity():
    | WizBattleCharacter<TStatus>
    | WizBattleMonster<TStatus, TCustom>
    | null {
    const actor = this.getCurrentActor()
    if (!actor) return null
    return this.context.getActorById(actor.id) ?? null
  }

  isCurrentActorEnemy(): boolean {
    const actor = this.getCurrentActor()
    return actor?.isEnemy ?? false
  }

  canCurrentActorAct(): boolean {
    const actor = this.getCurrentActor()
    if (!actor) return false
    return this.context.canActorAct(actor.id)
  }

  isTurnComplete(): boolean {
    return this.currentActorIndex >= this.turnOrder.length
  }

  getRemainingActorCount(): number {
    return Math.max(0, this.turnOrder.length - this.currentActorIndex)
  }

  getRemainingTurnOrder(): readonly WizEngineBattleActor[] {
    return Object.freeze(this.turnOrder.slice(this.currentActorIndex))
  }

  skipCurrentActor(): WizEngineBattlePhaseTurnOrder<TStatus, TCustom> {
    return new WizEngineBattlePhaseTurnOrder({
      context: this.context,
      turnOrder: this.turnOrder,
      currentActorIndex: this.currentActorIndex + 1,
    })
  }

  skipToNextActableActor(): WizEngineBattlePhaseTurnOrder<TStatus, TCustom> {
    if (this.isTurnComplete() || this.canCurrentActorAct()) return this
    return this.skipCurrentActor().skipToNextActableActor()
  }

  executeAction<
    TRewardCustom = undefined,
    TReason extends string = WizEngineBattleExecutionRejectionReason,
  >(
    action: WizEngineBattleTurnAction,
    executor: WizEngineBattleExecutorCall<TStatus, TCustom, TReason>,
    options?: WizEngineBattleExecutionOptions
  ): WizEngineBattleTurnOrderResult<TStatus, TCustom, TRewardCustom, TReason> {
    WizEngineBattleTurnAction.assertAuthentic(action)
    const currentActor = this.getCurrentActor()
    if (
      !currentActor ||
      currentActor.id !== action.actorId ||
      !this.context.canActorAct(action.actorId)
    ) {
      return {
        scene: this,
        logs: [],
        accepted: false,
        reason: "BATTLE_ACTION_REJECTED",
        action: null,
      }
    }

    // アクション実行
    const result = executor.execute(
      action,
      this.context.party,
      this.context.enemies,
      options
    )
    WizEngineBattleExecutionResult.assertAuthentic(result)
    if (result.isRejected()) {
      return {
        scene: this,
        logs: [],
        accepted: false,
        reason: result.reason,
        action: null,
      }
    }
    const executedAction = result.action ?? action

    // コンテキスト更新 (logs は含まない)
    const ctx = this.context
      .withParty(result.party)
      .withEnemies(result.enemies)
      .withExecutedAction(executedAction)

    // 勝敗チェック
    if (ctx.isEnemiesDefeated()) {
      return {
        scene: new WizEngineBattlePhaseVictory<TStatus, TCustom, TRewardCustom>(
          {
            context: ctx,
          }
        ),
        logs: result.logs,
        accepted: true,
        reason: undefined,
        action: executedAction,
      }
    }

    if (ctx.isPartyDefeated() && !ctx.party.hasAllLivingMembersFled()) {
      return {
        scene: new WizEngineBattlePhaseDefeat({ context: ctx }),
        logs: result.logs,
        accepted: true,
        reason: undefined,
        action: executedAction,
      }
    }

    // 次のアクターへ
    const nextScene = new WizEngineBattlePhaseTurnOrder({
      context: ctx,
      turnOrder: this.turnOrder,
      currentActorIndex: this.currentActorIndex + 1,
    })

    // 行動不能なアクターをスキップ
    return {
      scene: nextScene.skipToNextActableActor(),
      logs: result.logs,
      accepted: true,
      reason: undefined,
      action: executedAction,
    }
  }

  checkBattleEnd<
    TRewardCustom = undefined,
  >(): WizEngineBattleTurnOrderResultPhase<TStatus, TCustom, TRewardCustom> {
    if (this.context.isEnemiesDefeated()) {
      return new WizEngineBattlePhaseVictory<TStatus, TCustom, TRewardCustom>({
        context: this.context,
      })
    }

    if (
      this.context.isPartyDefeated() &&
      !this.context.party.hasAllLivingMembersFled()
    ) {
      return new WizEngineBattlePhaseDefeat({ context: this.context })
    }

    return this
  }
}
