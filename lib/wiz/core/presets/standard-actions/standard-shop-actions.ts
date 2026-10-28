import type { WorldContentArrays } from "@/lib/wiz/core/content/schema"
import { createWizStandardActionValue } from "@/lib/wiz/core/presets/standard-actions/create-wiz-standard-action-value"
import type { WizStandardActionValueFor } from "@/lib/wiz/core/presets/standard-actions/standard-action-value"
import type {
  WizStandardCheckedId,
  WizStandardCheckedIdInput,
  WizStandardShopArmorId,
  WizStandardShopId,
  WizStandardShopItemId,
  WizStandardShopTopicId,
  WizStandardShopWeaponId,
} from "@/lib/wiz/core/presets/standard-actions/content-types"

const standardShopActionsConstructionToken = Symbol(
  "WizStandardShopActions.constructor"
)

export class WizStandardShopActions<
  TArrays extends WorldContentArrays,
  TShopId extends WizStandardShopId<TArrays>,
> {
  readonly shopId: TShopId
  readonly #armorIds: readonly string[]
  readonly #itemIds: readonly string[]
  readonly #origin: symbol
  readonly #topicIds: readonly string[]
  readonly #weaponIds: readonly string[]

  private constructor(
    token: typeof standardShopActionsConstructionToken,
    origin: symbol,
    shopId: TShopId,
    itemIds: readonly string[],
    weaponIds: readonly string[],
    armorIds: readonly string[],
    topicIds: readonly string[]
  ) {
    if (token !== standardShopActionsConstructionToken) {
      throw new TypeError(
        "WizStandardShopActions must be created by WizStandardActions"
      )
    }
    this.#origin = origin
    this.shopId = shopId
    this.#itemIds = Object.freeze([...itemIds])
    this.#weaponIds = Object.freeze([...weaponIds])
    this.#armorIds = Object.freeze([...armorIds])
    this.#topicIds = Object.freeze([...topicIds])
    Object.freeze(this)
  }

  /** @internal */
  static create<
    TArrays extends WorldContentArrays,
    TShopId extends WizStandardShopId<TArrays>,
  >(
    token: typeof standardShopActionsConstructionToken,
    origin: symbol,
    shopId: TShopId,
    itemIds: readonly string[],
    weaponIds: readonly string[],
    armorIds: readonly string[],
    topicIds: readonly string[]
  ): WizStandardShopActions<TArrays, TShopId> {
    return new WizStandardShopActions<TArrays, TShopId>(
      token,
      origin,
      shopId,
      itemIds,
      weaponIds,
      armorIds,
      topicIds
    )
  }

  enter() {
    return createWizStandardActionValue(this.#origin, {
      type: "GO_TO_SHOP",
      shopId: this.shopId,
    })
  }

  selectItemToBuy<const TCandidate extends string>(
    itemId: WizStandardCheckedIdInput<
      TCandidate,
      WizStandardShopItemId<TArrays, TShopId>
    >
  ): WizStandardActionValueFor<{
    type: "SELECT_ITEM_TO_BUY"
    shopId: TShopId
    itemId: WizStandardCheckedId<
      TCandidate,
      WizStandardShopItemId<TArrays, TShopId>
    >
  }>
  selectItemToBuy(itemId: string) {
    if (!this.#itemIds.includes(itemId)) {
      throw new RangeError(
        `Item "${itemId}" is not sold by standard shop "${this.shopId}"`
      )
    }
    return createWizStandardActionValue(this.#origin, {
      type: "SELECT_ITEM_TO_BUY",
      shopId: this.shopId,
      itemId,
    })
  }

  selectWeaponToBuy<const TCandidate extends string>(
    weaponId: WizStandardCheckedIdInput<
      TCandidate,
      WizStandardShopWeaponId<TArrays, TShopId>
    >
  ): WizStandardActionValueFor<{
    type: "SELECT_WEAPON_TO_BUY"
    shopId: TShopId
    weaponId: WizStandardCheckedId<
      TCandidate,
      WizStandardShopWeaponId<TArrays, TShopId>
    >
  }>
  selectWeaponToBuy(weaponId: string) {
    if (!this.#weaponIds.includes(weaponId)) {
      throw new RangeError(
        `Weapon "${weaponId}" is not sold by standard shop "${this.shopId}"`
      )
    }
    return createWizStandardActionValue(this.#origin, {
      type: "SELECT_WEAPON_TO_BUY",
      shopId: this.shopId,
      weaponId,
    })
  }

  selectArmorToBuy<const TCandidate extends string>(
    armorId: WizStandardCheckedIdInput<
      TCandidate,
      WizStandardShopArmorId<TArrays, TShopId>
    >
  ): WizStandardActionValueFor<{
    type: "SELECT_ARMOR_TO_BUY"
    shopId: TShopId
    armorId: WizStandardCheckedId<
      TCandidate,
      WizStandardShopArmorId<TArrays, TShopId>
    >
  }>
  selectArmorToBuy(armorId: string) {
    if (!this.#armorIds.includes(armorId)) {
      throw new RangeError(
        `Armor "${armorId}" is not sold by standard shop "${this.shopId}"`
      )
    }
    return createWizStandardActionValue(this.#origin, {
      type: "SELECT_ARMOR_TO_BUY",
      shopId: this.shopId,
      armorId,
    })
  }

  startConversation<const TCandidate extends string>(
    topicId: WizStandardCheckedIdInput<
      TCandidate,
      WizStandardShopTopicId<TArrays, TShopId>
    >
  ): WizStandardActionValueFor<{
    type: "START_SHOP_CONVERSATION"
    shopId: TShopId
    topicId: WizStandardCheckedId<
      TCandidate,
      WizStandardShopTopicId<TArrays, TShopId>
    >
  }>
  startConversation(topicId: string) {
    if (!this.#topicIds.includes(topicId)) {
      throw new RangeError(
        `Unknown topic "${topicId}" for standard shop "${this.shopId}"`
      )
    }
    return createWizStandardActionValue(this.#origin, {
      type: "START_SHOP_CONVERSATION",
      shopId: this.shopId,
      topicId,
    })
  }
}

Object.freeze(WizStandardShopActions.prototype)
Object.freeze(WizStandardShopActions)

/** @internal */
export const createWizStandardShopActions = <
  TArrays extends WorldContentArrays,
  TShopId extends WizStandardShopId<TArrays>,
>(
  origin: symbol,
  shopId: TShopId,
  itemIds: readonly string[],
  weaponIds: readonly string[],
  armorIds: readonly string[],
  topicIds: readonly string[]
): WizStandardShopActions<TArrays, TShopId> =>
  WizStandardShopActions.create<TArrays, TShopId>(
    standardShopActionsConstructionToken,
    origin,
    shopId,
    itemIds,
    weaponIds,
    armorIds,
    topicIds
  )
