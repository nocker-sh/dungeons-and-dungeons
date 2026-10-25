import {
  WIZ_IMMUTABLE_VALUE,
  type WizDeepReadonly,
  WizImmutableValue,
} from "@/lib/wiz/core/immutable-value"
import { WizObjectService } from "@/lib/wiz/core/services/wiz-object-service"
import {
  assertFiniteNumberValue,
  assertRecordValue,
  assertTrimmedNonEmptyStringValue,
  WizValueValidationError,
} from "@/lib/wiz/core/value-validation"

export type WizResourceValue = Readonly<{
  current: number
  maximum: number
}>

export type WizResourceSetState<TResourceId extends string = string> = Readonly<
  Record<TResourceId, WizResourceValue>
>

export type WizResourceCosts<TResourceId extends string = string> = Readonly<
  Partial<Record<TResourceId, number>>
>

export type WizResourceOperationErrorCode = "RESOURCE_INSUFFICIENT" | "RESOURCE_NOT_FOUND"

const resourceSetConstructionToken = Symbol("WizResourceSet.constructor")
const authenticResourceSets = new WeakSet<object>()
const resourceSetOwnership = new WizObjectService()

const assertResourceAmount = (path: string, value: unknown): void => {
  assertFiniteNumberValue("resource-set", path, value, { minimum: 0 })
}

const parseResourceSet = <TResourceId extends string>(
  input: WizResourceSetState<TResourceId>,
): WizResourceSetState<TResourceId> => {
  assertRecordValue("resource-set", "$", input)
  for (const [resourceId, resource] of Object.entries(input)) {
    assertTrimmedNonEmptyStringValue("resource-set", "resourceId", resourceId)
    assertRecordValue("resource-set", resourceId, resource)
    const maximum = resource.maximum
    assertResourceAmount(`${resourceId}.maximum`, maximum)
    assertFiniteNumberValue("resource-set", `${resourceId}.current`, resource.current, {
      maximum: maximum as number,
      minimum: 0,
    })
  }
  return input
}

const parseCosts = <TResourceId extends string>(
  costs: WizResourceCosts<TResourceId>,
): WizResourceCosts<TResourceId> => {
  assertRecordValue("resource-set", "costs", costs)
  for (const [resourceId, amount] of Object.entries(costs)) {
    assertTrimmedNonEmptyStringValue("resource-set", "costs.resourceId", resourceId)
    assertResourceAmount(`costs.${resourceId}`, amount)
  }
  return costs
}

export class WizResourceOperationError extends Error {
  override readonly name = "WizResourceOperationError"
  readonly code: WizResourceOperationErrorCode
  readonly resourceId: string
  readonly available: number
  readonly required: number

  constructor(
    code: WizResourceOperationErrorCode,
    resourceId: string,
    available: number,
    required: number,
  ) {
    if (code !== "RESOURCE_INSUFFICIENT" && code !== "RESOURCE_NOT_FOUND") {
      throw new WizValueValidationError(
        "resource-set",
        "operation.code",
        code,
        "a known resource operation error code",
      )
    }
    assertTrimmedNonEmptyStringValue("resource-set", "operation.resourceId", resourceId)
    assertResourceAmount("operation.available", available)
    assertResourceAmount("operation.required", required)
    super(`${code}: "${resourceId}" requires ${required}, available ${available}`)
    this.code = code
    this.resourceId = resourceId
    this.available = available
    this.required = required
    Object.freeze(this)
  }
}

/**
 * HP、mana、staminaなど任意resourceを原子的に更新する不変value。
 */
export class WizResourceSet<TResourceId extends string = string> {
  declare readonly [WIZ_IMMUTABLE_VALUE]: true
  readonly #state: WizResourceSetState<TResourceId>

  private constructor(
    token: typeof resourceSetConstructionToken,
    state: WizResourceSetState<TResourceId>,
  ) {
    if (token !== resourceSetConstructionToken) {
      throw new TypeError("WizResourceSet must be created with create() or fromUnknown()")
    }
    this.#state = resourceSetOwnership.ownImmutable(parseResourceSet(state))
    authenticResourceSets.add(this)
    WizImmutableValue.freeze(this)
  }

  static create<const TResourceId extends string>(
    state: WizResourceSetState<TResourceId>,
  ): WizResourceSet<TResourceId> {
    return new WizResourceSet<TResourceId>(resourceSetConstructionToken, state)
  }

  static fromUnknown<const TResourceIds extends readonly string[]>(
    resourceIds: TResourceIds,
    input: unknown,
  ): WizResourceSet<TResourceIds[number]> {
    if (!Array.isArray(resourceIds)) {
      throw new TypeError("Resource IDs must be an array")
    }
    const expectedIds = new Set<string>()
    for (const [index, resourceId] of resourceIds.entries()) {
      assertTrimmedNonEmptyStringValue("resource-set", `resourceIds[${index}]`, resourceId)
      if (expectedIds.has(resourceId)) {
        throw new RangeError(`Duplicate resource id "${resourceId}"`)
      }
      expectedIds.add(resourceId)
    }
    assertRecordValue("resource-set", "$", input)
    const actualIds = Reflect.ownKeys(input)
    if (
      actualIds.length !== expectedIds.size ||
      actualIds.some((resourceId) => typeof resourceId !== "string" || !expectedIds.has(resourceId))
    ) {
      throw new RangeError("Resource state must contain exactly the declared resource IDs")
    }
    return new WizResourceSet(
      resourceSetConstructionToken,
      input as WizResourceSetState<TResourceIds[number]>,
    )
  }

  static require(value: unknown, label = "Resource set"): asserts value is WizResourceSet {
    if (typeof value !== "object" || value === null || !authenticResourceSets.has(value)) {
      throw new TypeError(`${label} must be created with WizResourceSet.create() or fromUnknown()`)
    }
  }

  has(resourceId: string): resourceId is TResourceId {
    return Object.hasOwn(this.#state, resourceId)
  }

  current(resourceId: TResourceId): number {
    return this.#requireResource(resourceId).current
  }

  maximum(resourceId: TResourceId): number {
    return this.#requireResource(resourceId).maximum
  }

  hasCosts(costs: WizResourceCosts<TResourceId>): boolean {
    parseCosts(costs)
    return (Object.entries(costs) as [TResourceId, number][]).every(
      ([resourceId, amount]) => this.has(resourceId) && this.current(resourceId) >= (amount ?? 0),
    )
  }

  spend(costs: WizResourceCosts<TResourceId>): WizResourceSet<TResourceId> {
    parseCosts(costs)
    for (const [resourceId, amount] of Object.entries(costs) as [TResourceId, number][]) {
      const required = amount ?? 0
      if (!this.has(resourceId)) {
        throw new WizResourceOperationError("RESOURCE_NOT_FOUND", resourceId, 0, required)
      }
      const available = this.current(resourceId)
      if (available < required) {
        throw new WizResourceOperationError(
          "RESOURCE_INSUFFICIENT",
          resourceId,
          available,
          required,
        )
      }
    }
    const next = Object.fromEntries(
      (Object.entries(this.#state) as [TResourceId, WizResourceValue][]).map(
        ([resourceId, resource]) => [
          resourceId,
          {
            current: resource.current - (costs[resourceId] ?? 0),
            maximum: resource.maximum,
          },
        ],
      ),
    ) as WizResourceSetState<TResourceId>
    return new WizResourceSet(resourceSetConstructionToken, next)
  }

  restore(resourceId: TResourceId, amount: number): WizResourceSet<TResourceId> {
    assertResourceAmount("restore.amount", amount)
    const resource = this.#requireResource(resourceId)
    return this.withCurrent(resourceId, Math.min(resource.maximum, resource.current + amount))
  }

  withCurrent(resourceId: TResourceId, current: number): WizResourceSet<TResourceId> {
    const resource = this.#requireResource(resourceId)
    assertFiniteNumberValue("resource-set", `${resourceId}.current`, current, {
      maximum: resource.maximum,
      minimum: 0,
    })
    return new WizResourceSet<TResourceId>(resourceSetConstructionToken, {
      ...this.#state,
      [resourceId]: {
        current,
        maximum: resource.maximum,
      },
    })
  }

  withMaximum(
    resourceId: TResourceId,
    maximum: number,
    current = Math.min(this.current(resourceId), maximum),
  ): WizResourceSet<TResourceId> {
    this.#requireResource(resourceId)
    assertResourceAmount(`${resourceId}.maximum`, maximum)
    assertFiniteNumberValue("resource-set", `${resourceId}.current`, current, {
      maximum,
      minimum: 0,
    })
    return new WizResourceSet<TResourceId>(resourceSetConstructionToken, {
      ...this.#state,
      [resourceId]: {
        current,
        maximum,
      },
    })
  }

  toPlain(): WizDeepReadonly<WizResourceSetState<TResourceId>> {
    return this.#state as WizDeepReadonly<WizResourceSetState<TResourceId>>
  }

  #requireResource(resourceId: string): WizResourceValue {
    if (!this.has(resourceId)) {
      throw new WizResourceOperationError("RESOURCE_NOT_FOUND", resourceId, 0, 0)
    }
    return this.#state[resourceId]
  }
}

Object.freeze(WizResourceOperationError.prototype)
Object.freeze(WizResourceOperationError)
Object.freeze(WizResourceSet.prototype)
Object.freeze(WizResourceSet)
