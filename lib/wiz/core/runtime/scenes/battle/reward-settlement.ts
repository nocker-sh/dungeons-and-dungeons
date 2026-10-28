import type { WizBattleEnemyParty } from "@/lib/wiz/core/engine/battle/actors/enemy-party"
import { WizEngineBattleReward } from "@/lib/wiz/core/engine/reward/battle-reward"
import {
  WIZ_IMMUTABLE_VALUE,
  WizImmutableValue,
} from "@/lib/wiz/core/immutable-value"
import {
  getWizRuntimeContentEntry,
  type WizRuntimeContentView,
} from "@/lib/wiz/core/runtime/content-view"
import { WizVaultValue } from "@/lib/wiz/core/vault/value"
import type { WizStandardInventoryService } from "@/lib/wiz/core/rpg/standard-inventory"

const rewardSettlementResultConstructionToken = Symbol(
  "WizSceneBattleRewardSettlementResult.constructor"
)
const authenticRewardSettlementResults = new WeakSet<object>()

export type WizSceneBattleRewardSettlementRejectionReason =
  "BATTLE_REWARD_ITEM_NOT_FOUND"

export class WizSceneBattleRewardSettlementResult<
  TReason extends string = WizSceneBattleRewardSettlementRejectionReason,
> {
  declare readonly [WIZ_IMMUTABLE_VALUE]: true
  readonly accepted: boolean
  readonly vault: WizVaultValue
  readonly reason: TReason | undefined

  private constructor(
    token: typeof rewardSettlementResultConstructionToken,
    properties:
      | Readonly<{
          accepted: true
          vault: WizVaultValue
        }>
      | Readonly<{
          accepted: false
          vault: WizVaultValue
          reason: TReason
        }>
  ) {
    if (token !== rewardSettlementResultConstructionToken) {
      throw new TypeError(
        "WizSceneBattleRewardSettlementResult must be created with accept() or reject()"
      )
    }
    this.accepted = properties.accepted
    WizVaultValue.assertAuthentic(properties.vault)
    this.vault = properties.vault
    if (properties.accepted) {
      this.reason = undefined
    } else {
      if (
        properties.reason.trim().length === 0 ||
        properties.reason !== properties.reason.trim()
      ) {
        throw new RangeError(
          "Battle reward settlement rejection reason must not be blank or have surrounding whitespace"
        )
      }
      this.reason = properties.reason
    }
    authenticRewardSettlementResults.add(this)
    WizImmutableValue.freeze(this)
  }

  static accept(
    vault: WizVaultValue
  ): WizSceneBattleRewardSettlementResult<never> {
    return new WizSceneBattleRewardSettlementResult(
      rewardSettlementResultConstructionToken,
      {
        accepted: true,
        vault,
      }
    )
  }

  static reject<const TReason extends string>(
    vault: WizVaultValue,
    reason: TReason
  ): WizSceneBattleRewardSettlementResult<TReason> {
    return new WizSceneBattleRewardSettlementResult(
      rewardSettlementResultConstructionToken,
      {
        accepted: false,
        vault,
        reason,
      }
    )
  }

  /** @internal reward settlement authority boundary only. */
  static assertAuthentic(
    result: unknown
  ): asserts result is WizSceneBattleRewardSettlementResult<string> {
    if (
      typeof result !== "object" ||
      result === null ||
      !authenticRewardSettlementResults.has(result)
    ) {
      throw new TypeError(
        "Battle reward settlement must return an authentic WizSceneBattleRewardSettlementResult"
      )
    }
  }

  isAccepted(): this is this &
    Readonly<{
      accepted: true
      reason: undefined
    }> {
    WizSceneBattleRewardSettlementResult.assertAuthentic(this)
    return this.accepted
  }

  isRejected(): this is this &
    Readonly<{
      accepted: false
      reason: TReason
    }> {
    WizSceneBattleRewardSettlementResult.assertAuthentic(this)
    return !this.accepted
  }

  mapVault(
    transform: (vault: WizVaultValue) => WizVaultValue
  ): WizSceneBattleRewardSettlementResult<TReason> {
    WizSceneBattleRewardSettlementResult.assertAuthentic(this)
    if (this.isRejected()) return this
    return WizSceneBattleRewardSettlementResult.accept(transform(this.vault))
  }
}

export type WizSceneBattleRewardSettlementParameters<
  TStatus = unknown,
  TBattleCustom = unknown,
  TRewardCustom = unknown,
> = Readonly<{
  readonly vault: WizVaultValue
  readonly reward: WizEngineBattleReward<TRewardCustom>
  readonly returnAreaId: string
  readonly enemies: WizBattleEnemyParty<TStatus, TBattleCustom>
}>

/**
 * 勝利報酬をvaultへ反映する純粋port。
 *
 * custom実装は標準settlementを呼ばず、報酬反映を完全に置き換える。
 */
export type WizSceneBattleRewardSettlement<
  TStatus = unknown,
  TBattleCustom = unknown,
  TRewardCustom = unknown,
  TReason extends string = WizSceneBattleRewardSettlementRejectionReason,
> = Readonly<{
  readonly settle: (
    parameters: WizSceneBattleRewardSettlementParameters<
      TStatus,
      TBattleCustom,
      TRewardCustom
    >
  ) => WizSceneBattleRewardSettlementResult<TReason>
}>

export type WizSceneBattleDefaultRewardSettlementDefinition = Readonly<{
  content: Pick<WizRuntimeContentView, "items">
  inventoryService: WizStandardInventoryService
}>

/**
 * standard battleの標準報酬反映。
 *
 * experience、gold、item drop、area進捗、victory log、
 * defeat quest進捗を各reward確定時に一度だけ反映する。
 */
export class WizSceneBattleDefaultRewardSettlement<
  TStatus = unknown,
  TBattleCustom = unknown,
  TRewardCustom = unknown,
> implements WizSceneBattleRewardSettlement<
  TStatus,
  TBattleCustom,
  TRewardCustom
> {
  private readonly itemIds: readonly string[]
  private readonly inventoryService: WizStandardInventoryService

  constructor(properties: WizSceneBattleDefaultRewardSettlementDefinition) {
    this.inventoryService = properties.inventoryService
    this.itemIds = Object.freeze(
      Object.keys(properties.content.items).map((itemId) => {
        const item = getWizRuntimeContentEntry(properties.content.items, itemId)
        if (!item || item.id !== itemId) {
          throw new TypeError(
            `Battle reward content key "${itemId}" must resolve to the same canonical item ID`
          )
        }
        return itemId
      })
    )
    Object.freeze(this)
  }

  readonly settle = (
    parameters: WizSceneBattleRewardSettlementParameters<
      TStatus,
      TBattleCustom,
      TRewardCustom
    >
  ): WizSceneBattleRewardSettlementResult => {
    WizVaultValue.assertAuthentic(parameters.vault)
    WizEngineBattleReward.assertAuthentic(parameters.reward)
    const itemIds = parameters.reward.droppedItems.map((drop) => drop.itemId)
    if (itemIds.some((itemId) => !this.itemIds.includes(itemId))) {
      return WizSceneBattleRewardSettlementResult.reject(
        parameters.vault,
        "BATTLE_REWARD_ITEM_NOT_FOUND"
      )
    }

    const rewardedVault = parameters.vault
      .updatePlayer((player) =>
        player
          .addExp(parameters.reward.experience)
          .addGold(parameters.reward.gold)
      )
      .incrementAreaProgress(parameters.returnAreaId, 10)
      .addLog({
        key: "BATTLE_VICTORY",
        exp: parameters.reward.experience,
        gold: parameters.reward.gold,
      })

    const vaultWithDrops = parameters.reward.droppedItems.reduce(
      (vault, drop) =>
        vault.updateInventory((inventory) =>
          this.inventoryService.add(
            inventory,
            "item",
            drop.itemId,
            drop.quantity
          )
        ),
      rewardedVault
    )
    const settledVault = parameters.enemies
      .getAllMonsters()
      .reduce(
        (vault, monster) => vault.updateQuestProgressDefeat(monster.groupId),
        vaultWithDrops
      )

    return WizSceneBattleRewardSettlementResult.accept(settledVault)
  }
}

Object.freeze(WizSceneBattleRewardSettlementResult.prototype)
Object.freeze(WizSceneBattleRewardSettlementResult)
Object.freeze(WizSceneBattleDefaultRewardSettlement.prototype)
Object.freeze(WizSceneBattleDefaultRewardSettlement)
