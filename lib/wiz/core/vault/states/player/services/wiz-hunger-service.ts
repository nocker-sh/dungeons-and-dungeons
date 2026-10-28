import type { WizHungerImpact } from "@/lib/wiz/core/domain/values/hunger-impact"
import {
  WIZ_IMMUTABLE_VALUE,
  WizImmutableValue,
} from "@/lib/wiz/core/immutable-value"
import type { WizImmutableValueContract } from "@/lib/wiz/core/immutable-value"
import { assertArrayValue } from "@/lib/wiz/core/assert-array-value"
import { assertFiniteNumberValue } from "@/lib/wiz/core/assert-finite-number-value"
import { assertRecordValue } from "@/lib/wiz/core/assert-record-value"
import { assertTrimmedNonEmptyStringValue } from "@/lib/wiz/core/assert-trimmed-non-empty-string-value"
import { WizValueValidationError } from "@/lib/wiz/core/value-validation"

export type WizHungerBand<TState extends string = string> = Readonly<{
  readonly state: TState
  readonly minimum: number
  readonly impact: WizHungerImpact
}>

export type WizHungerFallback<TState extends string = string> = Readonly<{
  readonly state: TState
  readonly impact: WizHungerImpact
}>

export type WizStandardHungerState =
  | "full"
  | "normal"
  | "hungry"
  | "starving"
  | "critical"

export type WizVaultHungerServiceDefinition<TState extends string = string> =
  Readonly<{
    readonly bands: readonly WizHungerBand<TState>[]
    readonly fallback: WizHungerFallback<TState>
  }>

export type WizHungerServicePort = Readonly<{
  getHungerState: (hunger: number) => string
  getHungerImpact: (hunger: number) => WizHungerImpact
}>

const ownImpact = (impact: WizHungerImpact): WizHungerImpact =>
  Object.freeze({
    actionPointReduction: impact.actionPointReduction,
    abilityPowerMultiplier: impact.abilityPowerMultiplier,
    hpLoss: impact.hpLoss,
  })

const validateImpact = (impact: unknown, path: string): void => {
  assertRecordValue("hunger", path, impact)
  assertFiniteNumberValue(
    "hunger",
    `${path}.actionPointReduction`,
    impact.actionPointReduction,
    {
      minimum: 0,
    }
  )
  assertFiniteNumberValue(
    "hunger",
    `${path}.abilityPowerMultiplier`,
    impact.abilityPowerMultiplier,
    { minimum: 0 }
  )
  assertFiniteNumberValue("hunger", `${path}.hpLoss`, impact.hpLoss, {
    minimum: 0,
  })
}

export class WizVaultHungerService<
  TState extends string = string,
> implements WizImmutableValueContract {
  declare readonly [WIZ_IMMUTABLE_VALUE]: true
  readonly #definition: WizVaultHungerServiceDefinition<TState>

  constructor(definition: WizVaultHungerServiceDefinition<TState>) {
    assertRecordValue("hunger", "definition", definition)
    assertArrayValue("hunger", "bands", definition.bands)
    assertRecordValue("hunger", "fallback", definition.fallback)

    const stateIds = new Set<string>()
    let previousMinimum = Number.POSITIVE_INFINITY
    definition.bands.forEach((band, index) => {
      const path = `bands[${index}]`
      assertRecordValue("hunger", path, band)
      assertTrimmedNonEmptyStringValue("hunger", `${path}.state`, band.state)
      assertFiniteNumberValue("hunger", `${path}.minimum`, band.minimum)
      if (band.minimum >= previousMinimum) {
        throw new WizValueValidationError(
          "hunger",
          `${path}.minimum`,
          band.minimum,
          `less than ${previousMinimum}`
        )
      }
      if (stateIds.has(band.state)) {
        throw new WizValueValidationError(
          "hunger",
          `${path}.state`,
          band.state,
          "a unique state ID"
        )
      }
      validateImpact(band.impact, `${path}.impact`)
      stateIds.add(band.state)
      previousMinimum = band.minimum
    })
    assertTrimmedNonEmptyStringValue(
      "hunger",
      "fallback.state",
      definition.fallback.state
    )
    if (stateIds.has(definition.fallback.state)) {
      throw new WizValueValidationError(
        "hunger",
        "fallback.state",
        definition.fallback.state,
        "a unique state ID"
      )
    }
    validateImpact(definition.fallback.impact, "fallback.impact")

    this.#definition = Object.freeze({
      bands: Object.freeze(
        definition.bands.map((band) =>
          Object.freeze({
            state: band.state,
            minimum: band.minimum,
            impact: ownImpact(band.impact),
          })
        )
      ),
      fallback: Object.freeze({
        state: definition.fallback.state,
        impact: ownImpact(definition.fallback.impact),
      }),
    })
    WizImmutableValue.freeze(this)
  }

  getHungerState(hunger: number): TState {
    assertFiniteNumberValue("hunger", "hunger", hunger)
    return (
      this.#definition.bands.find((band) => hunger >= band.minimum)?.state ??
      this.#definition.fallback.state
    )
  }

  getHungerImpact(hunger: number): WizHungerImpact {
    assertFiniteNumberValue("hunger", "hunger", hunger)
    return (
      this.#definition.bands.find((band) => hunger >= band.minimum)?.impact ??
      this.#definition.fallback.impact
    )
  }
}

export const createWizStandardHungerService =
  (): WizVaultHungerService<WizStandardHungerState> =>
    new WizVaultHungerService({
      bands: [
        {
          state: "full",
          minimum: 71,
          impact: {
            actionPointReduction: 0,
            abilityPowerMultiplier: 1,
            hpLoss: 0,
          },
        },
        {
          state: "normal",
          minimum: 31,
          impact: {
            actionPointReduction: 0,
            abilityPowerMultiplier: 1,
            hpLoss: 0,
          },
        },
        {
          state: "hungry",
          minimum: 11,
          impact: {
            actionPointReduction: 1,
            abilityPowerMultiplier: 0.9,
            hpLoss: 0,
          },
        },
        {
          state: "starving",
          minimum: 1,
          impact: {
            actionPointReduction: 2,
            abilityPowerMultiplier: 0.8,
            hpLoss: 5,
          },
        },
      ],
      fallback: {
        state: "critical",
        impact: {
          actionPointReduction: 5,
          abilityPowerMultiplier: 0.5,
          hpLoss: 10,
        },
      },
    })

Object.freeze(WizVaultHungerService.prototype)
Object.freeze(WizVaultHungerService)
