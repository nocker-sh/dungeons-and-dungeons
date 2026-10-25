import type { WizBattleEnemyParty } from "@/lib/wiz/core/engine/battle/actors/enemy-party"
import type { WizBattleParty } from "@/lib/wiz/core/engine/battle/actors/party"
import {
  WizEngineBattleContent,
  type WizEngineBattleContentResolver,
} from "@/lib/wiz/core/engine/battle/content"
import { WizEngineBattleTurnActionExecutor } from "@/lib/wiz/core/engine/battle/execution/action-executor"
import type { WizEngineBattleExecutionRejectionReason } from "@/lib/wiz/core/engine/battle/execution/execution-result"
import { WizEngineBattleEncounter } from "@/lib/wiz/core/engine/battle/phases/encounter"
import { WizEngineBattleDefaultTurnOrderPolicy } from "@/lib/wiz/core/engine/battle/phases/turn-order-policy"
import {
  type WizEngineBattleActor,
  type WizEngineBattleExecutor,
  WizEngineBattlePhaseTurnOrder,
  type WizEngineBattleTurnOrderPolicy,
  type WizEngineBattleTurnOrderResult,
} from "@/lib/wiz/core/engine/battle/phases/turn-order"
import type { WizEngineBattleTurnAction } from "@/lib/wiz/core/engine/battle/turn-action"
import type { WizEngineBattleExecutionOptions } from "@/lib/wiz/core/engine/battle/execution/action-executor"
import type { WizEngineBattleEnemyAI } from "@/lib/wiz/core/engine/battle-ai/simple-enemy-ai"
import { WizEngineBattleSimpleEnemyAI } from "@/lib/wiz/core/engine/battle-ai/simple-enemy-ai"
import type { WizEngineBattleRewardCalculator } from "@/lib/wiz/core/engine/reward/default-reward-calculator"
import { WizIdGenerator, type WizIdSource } from "@/lib/wiz/core/services/wiz-id-generator"
import type { WizStateBattlePhase } from "@/lib/wiz/core/runtime/scenes/battle/state"

type StartBattleResult<TStatus = unknown, TCustom = unknown> = {
  readonly encounterScene: WizEngineBattleEncounter<TStatus, TCustom>
}

type Properties<
  TStatus = unknown,
  TCustom = unknown,
  TRewardCustom = undefined,
  TReason extends string = WizEngineBattleExecutionRejectionReason,
> = {
  readonly executor?: WizEngineBattleExecutor<TStatus, TCustom, TReason>
  readonly enemyAI?: WizEngineBattleEnemyAI<TStatus, TCustom>
  readonly rewardCalculator: WizEngineBattleRewardCalculator<TStatus, TCustom, TRewardCustom>
  readonly turnOrderPolicy?: WizEngineBattleTurnOrderPolicy<TStatus, TCustom>
  readonly idGenerator?: WizIdSource
  readonly content?: WizEngineBattleContentResolver
}

export class WizSceneBattleService<
  TStatus = unknown,
  TCustom = unknown,
  TRewardCustom = undefined,
  TReason extends string = WizEngineBattleExecutionRejectionReason,
> {
  readonly executor: WizEngineBattleExecutor<
    TStatus,
    TCustom,
    TReason | WizEngineBattleExecutionRejectionReason
  >
  readonly enemyAI: WizEngineBattleEnemyAI<TStatus, TCustom>
  readonly rewardCalculator: WizEngineBattleRewardCalculator<TStatus, TCustom, TRewardCustom>
  readonly turnOrderPolicy: WizEngineBattleTurnOrderPolicy<TStatus, TCustom>
  private readonly idGenerator: WizIdSource
  private readonly content: WizEngineBattleContentResolver

  constructor(properties: Properties<TStatus, TCustom, TRewardCustom, TReason>) {
    const executor =
      properties.executor ?? new WizEngineBattleTurnActionExecutor<TStatus, TCustom>()
    const enemyAI =
      properties.enemyAI ??
      new WizEngineBattleSimpleEnemyAI<TStatus, TCustom>({ strategy: "random" })
    const rewardCalculator = properties.rewardCalculator
    const turnOrderPolicy =
      properties.turnOrderPolicy ?? new WizEngineBattleDefaultTurnOrderPolicy<TStatus, TCustom>()
    this.executor = Object.freeze({
      execute: Object.freeze(executor.execute.bind(executor)),
    })
    this.enemyAI = Object.freeze({
      selectAction: Object.freeze(enemyAI.selectAction.bind(enemyAI)),
    })
    this.rewardCalculator = Object.freeze({
      calculate: Object.freeze(rewardCalculator.calculate.bind(rewardCalculator)),
    })
    this.turnOrderPolicy = Object.freeze({
      order: Object.freeze(turnOrderPolicy.order.bind(turnOrderPolicy)),
    })
    this.idGenerator = properties.idGenerator ?? new WizIdGenerator()
    const content = properties.content ?? new WizEngineBattleContent()
    this.content = Object.freeze({
      resolveAbility: Object.freeze(content.resolveAbility.bind(content)),
      resolveItem: Object.freeze(content.resolveItem.bind(content)),
    })
    Object.freeze(this)
  }

  startBattle(
    party: WizBattleParty<TStatus>,
    enemies: WizBattleEnemyParty<TStatus, TCustom>,
  ): StartBattleResult<TStatus, TCustom> {
    const encounterScene = WizEngineBattleEncounter.create({
      id: `battle_${this.idGenerator.next()}`,
      party,
      enemies,
    })

    return {
      encounterScene,
    }
  }

  createTurnOrderScene(
    wizScene: WizStateBattlePhase<TStatus, TCustom, TRewardCustom>,
  ): WizStateBattlePhase<TStatus, TCustom, TRewardCustom> {
    return WizEngineBattlePhaseTurnOrder.create(
      wizScene.context,
      this.turnOrderPolicy.order(wizScene.context),
    )
  }

  /**
   * 指定したターンオーダーフェーズでアクションを実行する。
   *
   * 呼び出し側で `wizScene.phase === "turnOrder"` を確認して narrow すること
   * (型レベルで保証される。実行時 throw は行わない)。
   */
  executeAction(
    wizScene: WizEngineBattlePhaseTurnOrder<TStatus, TCustom>,
    action: WizEngineBattleTurnAction,
    options?: WizEngineBattleExecutionOptions,
  ): WizEngineBattleTurnOrderResult<TStatus, TCustom, TRewardCustom, TReason> {
    return wizScene.executeAction<TRewardCustom, TReason | WizEngineBattleExecutionRejectionReason>(
      action,
      this.executor,
      {
        ...options,
        content: this.content,
      },
    )
  }

  isTurnComplete(wizScene: WizStateBattlePhase<TStatus, TCustom, TRewardCustom>): boolean {
    if (wizScene.phase !== "turnOrder") return false
    return wizScene.isTurnComplete()
  }

  toNextTurn(
    wizScene: WizStateBattlePhase<TStatus, TCustom, TRewardCustom>,
  ): WizStateBattlePhase<TStatus, TCustom, TRewardCustom> {
    if (wizScene.phase !== "turnOrder") return wizScene
    const nextTurnContext = wizScene.context.withNextTurn()
    return WizEngineBattlePhaseTurnOrder.create(
      nextTurnContext,
      this.turnOrderPolicy.order(nextTurnContext),
    )
  }

  skipCurrentActor(
    wizScene: WizStateBattlePhase<TStatus, TCustom, TRewardCustom>,
  ): WizStateBattlePhase<TStatus, TCustom, TRewardCustom> {
    if (wizScene.phase !== "turnOrder") return wizScene
    return wizScene.skipCurrentActor()
  }

  getCurrentActor(
    wizScene: WizStateBattlePhase<TStatus, TCustom, TRewardCustom>,
  ): WizEngineBattleActor | null {
    if (wizScene.phase !== "turnOrder") return null
    return wizScene.getCurrentActor()
  }

  selectEnemyAction(
    monsterId: string,
    wizScene: WizStateBattlePhase<TStatus, TCustom, TRewardCustom>,
  ): WizEngineBattleTurnAction | null {
    if (wizScene.phase !== "turnOrder") return null
    const monster = wizScene.context.enemies.getMonsterById(monsterId)
    if (!monster) return null
    return this.enemyAI.selectAction(monster, wizScene.context)
  }
}
