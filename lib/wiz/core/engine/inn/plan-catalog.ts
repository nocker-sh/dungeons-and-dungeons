import type { WizContentInnPlan } from "@/lib/wiz/core/definition/inn/inn-plan"
import {
  WIZ_IMMUTABLE_VALUE,
  WizImmutableValue,
} from "@/lib/wiz/core/immutable-value"
import type {
  WizDeepReadonly,
  WizImmutableValueContract,
} from "@/lib/wiz/core/immutable-value"
import { createWizImmutableRecord } from "@/lib/wiz/core/create-wiz-immutable-record"
import { getWizImmutableRecordValue } from "@/lib/wiz/core/get-wiz-immutable-record-value"
import { WizObjectService } from "@/lib/wiz/core/services/wiz-object-service"
import { assertArrayValue } from "@/lib/wiz/core/assert-array-value"
import { assertFiniteNumberValue } from "@/lib/wiz/core/assert-finite-number-value"
import { assertRecordValue } from "@/lib/wiz/core/assert-record-value"
import { assertTrimmedNonEmptyStringValue } from "@/lib/wiz/core/assert-trimmed-non-empty-string-value"
import { WizValueValidationError } from "@/lib/wiz/core/value-validation"

const planOwnership = new WizObjectService()

const validateRecovery = (recovery: unknown, path: string): void => {
  assertRecordValue("inn-plan", path, recovery)
  if (recovery.fixed === undefined && recovery.percent === undefined) {
    throw new WizValueValidationError(
      "inn-plan",
      path,
      recovery,
      "fixed or percent recovery"
    )
  }
  if (recovery.fixed !== undefined) {
    assertFiniteNumberValue("inn-plan", `${path}.fixed`, recovery.fixed, {
      minimum: 0,
    })
  }
  if (recovery.percent !== undefined) {
    assertFiniteNumberValue("inn-plan", `${path}.percent`, recovery.percent, {
      maximum: 100,
      minimum: 0,
    })
  }
}

const validatePlan: (
  plan: unknown,
  index: number
) => asserts plan is WizContentInnPlan = (plan, index) => {
  const path = `plans[${index}]`
  assertRecordValue("inn-plan", path, plan)
  assertTrimmedNonEmptyStringValue("inn-plan", `${path}.id`, plan.id)
  assertFiniteNumberValue("inn-plan", `${path}.price`, plan.price, {
    minimum: 0,
  })
  if (plan.hpRecovery !== undefined) {
    validateRecovery(plan.hpRecovery, `${path}.hpRecovery`)
  }
  if (plan.mpRecovery !== undefined) {
    validateRecovery(plan.mpRecovery, `${path}.mpRecovery`)
  }
  if (plan.hungerRecovery !== undefined) {
    assertFiniteNumberValue(
      "inn-plan",
      `${path}.hungerRecovery`,
      plan.hungerRecovery,
      {
        minimum: 0,
      }
    )
  }
  if (plan.apRecovery !== undefined && plan.apRecovery !== "full") {
    assertFiniteNumberValue("inn-plan", `${path}.apRecovery`, plan.apRecovery, {
      minimum: 0,
    })
  }
}

export class WizEngineInnPlanCatalog implements WizImmutableValueContract {
  declare readonly [WIZ_IMMUTABLE_VALUE]: true
  readonly plans: readonly WizDeepReadonly<WizContentInnPlan>[]
  readonly #plansById: Readonly<
    Record<string, WizDeepReadonly<WizContentInnPlan>>
  >

  constructor(plans: readonly WizDeepReadonly<WizContentInnPlan>[]) {
    assertArrayValue("inn-plan", "plans", plans)
    const seenIds = new Set<string>()
    for (const [index, plan] of plans.entries()) {
      validatePlan(plan, index)
      if (seenIds.has(plan.id)) {
        throw new WizValueValidationError(
          "inn-plan",
          `plans[${index}].id`,
          plan.id,
          "a unique inn plan ID"
        )
      }
      seenIds.add(plan.id)
    }

    this.plans = planOwnership.ownImmutable(plans)
    this.#plansById = createWizImmutableRecord(
      this.plans.map((plan) => [plan.id, plan] as const)
    )
    WizImmutableValue.freeze(this)
  }

  get(planId: string): WizDeepReadonly<WizContentInnPlan> | undefined {
    return getWizImmutableRecordValue(this.#plansById, planId)
  }
}

Object.freeze(WizEngineInnPlanCatalog.prototype)
Object.freeze(WizEngineInnPlanCatalog)
