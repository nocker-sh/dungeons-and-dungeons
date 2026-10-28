export type WizEngineBattleFleeResultDefinition = {
  readonly success: boolean
  readonly canRetry: boolean
}

export class WizEngineBattleFleeResult {
  readonly success: boolean
  readonly canRetry: boolean

  constructor(properties: WizEngineBattleFleeResultDefinition) {
    this.success = properties.success
    this.canRetry = properties.canRetry
    Object.freeze(this)
  }

  isSuccess(): boolean {
    return this.success
  }

  isFailed(): boolean {
    return !this.success
  }

  toProperties(): WizEngineBattleFleeResultDefinition {
    return {
      success: this.success,
      canRetry: this.canRetry,
    }
  }
}

Object.freeze(WizEngineBattleFleeResult.prototype)
Object.freeze(WizEngineBattleFleeResult)
