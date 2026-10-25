export class WizEngineApService {
  constructor() {
    Object.freeze(this)
  }

  getEffectiveMaxAp(maxAp: number, actionPointReduction: number): number {
    return Math.max(1, maxAp - actionPointReduction)
  }

  canAct(ap: number): boolean {
    return ap >= 1
  }
}
