import { WizDice } from "@/lib/wiz/core/services/wiz-dice"
import { WizWorldEnvironment } from "@/lib/wiz/core/world/world"

export type WizStandardRuntimeEnvironmentDefinition = Readonly<{
  dice?: WizDice
  clock?: () => number
  nextId?: () => string
}>

/**
 * standard runtimeの全副作用依存を保持するimmutable composition value。
 *
 * Root配下の乱数・時計・生成IDは必ずこの値から派生させる。
 * `clock` と `nextId` は独立しており、時計値をIDへ流用しない。
 */
export class WizStandardRuntimeEnvironment {
  readonly dice: WizDice
  readonly clock: () => number
  readonly nextId: () => string

  private constructor(definition: WizStandardRuntimeEnvironmentDefinition) {
    const validatedEnvironment = WizWorldEnvironment.create({
      now: definition.clock,
      nextId: definition.nextId,
    })
    this.dice = definition.dice ?? new WizDice()
    this.clock = validatedEnvironment.now
    this.nextId = validatedEnvironment.nextId
    Object.freeze(this)
  }

  static create(
    definition: WizStandardRuntimeEnvironmentDefinition = {},
  ): WizStandardRuntimeEnvironment {
    return new WizStandardRuntimeEnvironment(definition)
  }

  static fromWorldEnvironment(environment: WizWorldEnvironment): WizStandardRuntimeEnvironment {
    return WizStandardRuntimeEnvironment.create({
      dice: new WizDice({ randomFn: environment.random }),
      clock: environment.now,
      nextId: environment.nextId,
    })
  }
}
