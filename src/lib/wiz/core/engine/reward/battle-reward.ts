import {
  WIZ_IMMUTABLE_VALUE,
  type WizDeepReadonly,
  WizImmutableValue,
} from "@/lib/wiz/core/immutable-value"
import { WizObjectService } from "@/lib/wiz/core/services/wiz-object-service"
import {
  assertArrayValue,
  assertFiniteNumberValue,
  assertTrimmedNonEmptyStringValue,
  assertRecordValue,
} from "@/lib/wiz/core/value-validation"

const objectService = new WizObjectService()
const authenticWizEngineBattleRewards = new WeakSet<object>()

const ownRewardCustom = <TCustom>(
  custom: TCustom | WizDeepReadonly<TCustom>,
): WizDeepReadonly<TCustom> => objectService.ownImmutable<TCustom>(custom)

export type WizEngineBattleDroppedItem = {
  readonly itemId: string
  readonly quantity: number
}

export type WizEngineBattleRewardDefinition<TCustom = unknown> = Readonly<{
  readonly experience: number
  readonly gold: number
  readonly droppedItems?: readonly WizEngineBattleDroppedItem[]
  readonly custom: TCustom | WizDeepReadonly<TCustom>
}>

export type WizEngineBattleRewardProperties<TCustom = unknown> = Readonly<{
  experience: number
  gold: number
  droppedItems: readonly WizEngineBattleDroppedItem[]
  custom: WizDeepReadonly<TCustom>
}>

export class WizEngineBattleReward<TCustom = unknown> {
  declare readonly [WIZ_IMMUTABLE_VALUE]: true
  readonly experience: number
  readonly gold: number
  readonly droppedItems: readonly WizEngineBattleDroppedItem[]
  readonly custom: WizDeepReadonly<TCustom>

  constructor(properties: WizEngineBattleRewardDefinition<TCustom>) {
    assertRecordValue("battle-reward", "$", properties)
    assertFiniteNumberValue("battle-reward", "experience", properties.experience, {
      minimum: 0,
    })
    assertFiniteNumberValue("battle-reward", "gold", properties.gold, {
      minimum: 0,
    })
    if (properties.droppedItems !== undefined) {
      assertArrayValue("battle-reward", "droppedItems", properties.droppedItems)
    }
    const droppedItems = properties.droppedItems ?? []
    for (const [index, droppedItem] of droppedItems.entries()) {
      const path = `droppedItems[${index}]`
      assertRecordValue("battle-reward", path, droppedItem)
      assertTrimmedNonEmptyStringValue("battle-reward", `${path}.itemId`, droppedItem.itemId)
      assertFiniteNumberValue("battle-reward", `${path}.quantity`, droppedItem.quantity, {
        minimum: 1,
        safeInteger: true,
      })
    }

    this.experience = properties.experience
    this.gold = properties.gold
    this.droppedItems = objectService.ownImmutable(droppedItems)
    this.custom = ownRewardCustom(properties.custom)
    authenticWizEngineBattleRewards.add(this)
    WizImmutableValue.freeze(this)
  }

  /** @internal reward calculator authority boundary only. */
  static assertAuthentic(reward: unknown): asserts reward is WizEngineBattleReward<unknown> {
    if (
      typeof reward !== "object" ||
      reward === null ||
      !authenticWizEngineBattleRewards.has(reward)
    ) {
      throw new TypeError("Battle reward calculator must return an authentic WizEngineBattleReward")
    }
  }

  withExperience(experience: number): WizEngineBattleReward<TCustom> {
    WizEngineBattleReward.assertAuthentic(this)

    return new WizEngineBattleReward({
      experience,
      gold: this.gold,
      droppedItems: this.droppedItems,
      custom: this.custom,
    })
  }

  withGold(gold: number): WizEngineBattleReward<TCustom> {
    WizEngineBattleReward.assertAuthentic(this)

    return new WizEngineBattleReward({
      experience: this.experience,
      gold,
      droppedItems: this.droppedItems,
      custom: this.custom,
    })
  }

  withDroppedItems(
    droppedItems: readonly WizEngineBattleDroppedItem[],
  ): WizEngineBattleReward<TCustom> {
    WizEngineBattleReward.assertAuthentic(this)

    return new WizEngineBattleReward({
      experience: this.experience,
      gold: this.gold,
      droppedItems,
      custom: this.custom,
    })
  }

  withCustom<TNewCustom>(custom: TNewCustom): WizEngineBattleReward<TNewCustom> {
    WizEngineBattleReward.assertAuthentic(this)

    return new WizEngineBattleReward({
      experience: this.experience,
      gold: this.gold,
      droppedItems: this.droppedItems,
      custom,
    })
  }

  toProperties(): WizEngineBattleRewardProperties<TCustom> {
    WizEngineBattleReward.assertAuthentic(this)

    return {
      experience: this.experience,
      gold: this.gold,
      droppedItems: this.droppedItems,
      custom: this.custom,
    }
  }
}

Object.freeze(WizEngineBattleReward.prototype)
Object.freeze(WizEngineBattleReward)
