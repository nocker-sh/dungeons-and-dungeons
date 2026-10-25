import {
  WIZ_IMMUTABLE_VALUE,
  type WizDeepReadonly,
  WizImmutableValue,
} from "@/lib/wiz/core/immutable-value"
import { WizObjectService } from "@/lib/wiz/core/services/wiz-object-service"
import {
  assertArrayValue,
  assertTrimmedNonEmptyStringValue,
  WizValueValidationError,
} from "@/lib/wiz/core/value-validation"

const itemConstructionToken = Symbol("WizItem.constructor")
const itemCatalogConstructionToken = Symbol("WizItemCatalog.constructor")
const authenticItems = new WeakSet<object>()
const authenticItemCatalogs = new WeakSet<object>()
const itemOwnership = new WizObjectService()

export type WizItemDefinition<
  TId extends string = string,
  TEffect = unknown,
  TCustom = unknown,
> = Readonly<{
  id: TId
  name: string
  description?: string
  tags?: readonly string[]
  effect?: TEffect | WizDeepReadonly<TEffect>
  custom?: TCustom | WizDeepReadonly<TCustom>
}>

export type WizItemProperties<
  TId extends string = string,
  TEffect = unknown,
  TCustom = unknown,
> = Readonly<{
  id: TId
  name: string
  description: string
  tags: readonly string[]
  effect: WizDeepReadonly<TEffect> | undefined
  custom: WizDeepReadonly<TCustom> | undefined
}>

export type WizItemWithEffectProperties<
  TId extends string = string,
  TEffect = unknown,
  TCustom = unknown,
> = Omit<WizItemProperties<TId, TEffect, TCustom>, "effect"> &
  Readonly<{ effect: WizDeepReadonly<TEffect> }>

const assertUniqueTags = (tags: readonly unknown[]): void => {
  assertArrayValue("item", "tags", tags)
  const seen = new Set<string>()
  for (const [index, tag] of tags.entries()) {
    assertTrimmedNonEmptyStringValue("item", `tags[${index}]`, tag)
    if (seen.has(tag)) {
      throw new WizValueValidationError("item", `tags[${index}]`, tag, "a unique tag")
    }
    seen.add(tag)
  }
}

/** runtimeや所持状態に依存しない、汎用の不変Item定義。 */
export class WizItem<TId extends string = string, TEffect = unknown, TCustom = unknown> {
  declare readonly [WIZ_IMMUTABLE_VALUE]: true
  declare private readonly wizItemType: readonly [TId, TEffect, TCustom]
  readonly id: TId
  readonly name: string
  readonly description: string
  readonly tags: readonly string[]
  readonly effect: WizDeepReadonly<TEffect> | undefined
  readonly custom: WizDeepReadonly<TCustom> | undefined

  protected constructor(token: symbol, definition: WizItemDefinition<TId, TEffect, TCustom>) {
    if (token !== itemConstructionToken) {
      throw new TypeError("WizItem must be created with define()")
    }
    assertTrimmedNonEmptyStringValue("item", "id", definition.id)
    assertTrimmedNonEmptyStringValue("item", "name", definition.name)
    if (definition.description !== undefined && typeof definition.description !== "string") {
      throw new WizValueValidationError("item", "description", definition.description, "a string")
    }
    assertUniqueTags(definition.tags ?? [])
    this.id = definition.id
    this.name = definition.name
    this.description = definition.description ?? ""
    this.tags = itemOwnership.ownImmutable(definition.tags ?? [])
    this.effect =
      definition.effect === undefined
        ? undefined
        : itemOwnership.ownImmutable<TEffect>(definition.effect)
    this.custom =
      definition.custom === undefined
        ? undefined
        : itemOwnership.ownImmutable<TCustom>(definition.custom)
    authenticItems.add(this)
    WizImmutableValue.freeze(this)
  }

  static define<const TId extends string, TEffect, TCustom = unknown>(
    definition: WizItemDefinition<TId, TEffect, TCustom> &
      Readonly<{ effect: TEffect | WizDeepReadonly<TEffect> }>,
  ): WizItemWithEffect<TId, TEffect, TCustom>
  static define<const TId extends string, TCustom = unknown>(
    definition: WizItemDefinition<TId, never, TCustom> & Readonly<{ effect?: undefined }>,
  ): WizItem<TId, never, TCustom>
  static define(
    definition: WizItemDefinition<string, unknown, unknown>,
  ): WizItem | WizItemWithEffect {
    return definition.effect === undefined
      ? new WizItem(itemConstructionToken, definition)
      : new WizItemWithEffect(itemConstructionToken, {
          ...definition,
          effect: definition.effect,
        })
  }

  static require(value: unknown, label = "Item"): asserts value is WizItem {
    if (typeof value !== "object" || value === null || !authenticItems.has(value)) {
      throw new TypeError(`${label} must be created with WizItem.define()`)
    }
  }

  withEffect<TNewEffect>(effect: TNewEffect): WizItemWithEffect<TId, TNewEffect, TCustom> {
    WizItem.require(this)
    return WizItem.define({ ...this.toProperties(), effect })
  }

  withCustom<TNewCustom>(custom: TNewCustom): WizItem<TId, TEffect, TNewCustom> {
    WizItem.require(this)
    return new WizItem<TId, TEffect, TNewCustom>(itemConstructionToken, {
      id: this.id,
      name: this.name,
      description: this.description,
      tags: this.tags,
      custom,
    })
  }

  toProperties(): WizItemProperties<TId, TEffect, TCustom> {
    WizItem.require(this)
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      tags: this.tags,
      effect: this.effect,
      custom: this.custom,
    }
  }
}

/** effectを必ず持つItem。define()へeffectを渡したとき自動的に返る。 */
export class WizItemWithEffect<
  TId extends string = string,
  TEffect = unknown,
  TCustom = unknown,
> extends WizItem<TId, TEffect, TCustom> {
  declare readonly effect: WizDeepReadonly<TEffect>

  constructor(
    token: symbol,
    definition: WizItemDefinition<TId, TEffect, TCustom> &
      Readonly<{ effect: TEffect | WizDeepReadonly<TEffect> }>,
  ) {
    super(token, definition)
  }

  override withCustom<TNewCustom>(custom: TNewCustom): WizItemWithEffect<TId, TEffect, TNewCustom> {
    WizItem.require(this)
    return new WizItemWithEffect<TId, TEffect, TNewCustom>(itemConstructionToken, {
      id: this.id,
      name: this.name,
      description: this.description,
      tags: this.tags,
      effect: this.effect,
      custom,
    })
  }

  override toProperties(): WizItemWithEffectProperties<TId, TEffect, TCustom> {
    return {
      ...super.toProperties(),
      effect: this.effect,
    }
  }
}

type AnyWizItem = WizItem<string, unknown, unknown>

/** ItemをIDで解決する、不変catalog。 */
export class WizItemCatalog<TItem extends AnyWizItem = AnyWizItem> {
  declare readonly [WIZ_IMMUTABLE_VALUE]: true
  readonly items: readonly TItem[]

  private constructor(token: symbol, items: readonly TItem[]) {
    if (token !== itemCatalogConstructionToken) {
      throw new TypeError("WizItemCatalog must be created with create()")
    }
    const ids = new Set<string>()
    for (const [index, item] of items.entries()) {
      WizItem.require(item, `Item catalog entry at index ${index}`)
      if (ids.has(item.id)) {
        throw new RangeError(`Duplicate item id "${item.id}" at index ${index}`)
      }
      ids.add(item.id)
    }
    this.items = Object.freeze([...items])
    authenticItemCatalogs.add(this)
    WizImmutableValue.freeze(this)
  }

  static create<const TItems extends readonly AnyWizItem[]>(
    items: TItems,
  ): WizItemCatalog<TItems[number]> {
    return new WizItemCatalog(itemCatalogConstructionToken, items)
  }

  find(itemId: string): TItem | undefined {
    return this.items.find((item) => item.id === itemId)
  }

  require(itemId: string): TItem {
    const item = this.find(itemId)
    if (item === undefined) {
      throw new RangeError(`Unknown item id "${itemId}"`)
    }
    return item
  }
}

Object.freeze(WizItem.prototype)
Object.freeze(WizItem)
Object.freeze(WizItemWithEffect.prototype)
Object.freeze(WizItemWithEffect)
Object.freeze(WizItemCatalog.prototype)
Object.freeze(WizItemCatalog)
