import type {
  WizContentInnPlan,
  WizContentInnResourceRecovery,
} from "@/lib/wiz/core/definition/inn/inn-plan"
import { WizEngineInnPlanCatalog } from "@/lib/wiz/core/engine/inn/plan-catalog"
import { WizEngineTimeFactory } from "@/lib/wiz/core/engine/time/wiz-time-factory"
import type { WizVaultValue } from "@/lib/wiz/core/vault/value"

export type WizEngineInnStayRejection =
  | {
      readonly type: "unknown_plan"
      readonly planId: string
    }
  | {
      readonly type: "insufficient_gold"
      readonly planId: string
      readonly required: number
      readonly available: number
      readonly shortfall: number
    }

export type WizEngineInnStayEligibility =
  | {
      readonly status: "eligible"
    }
  | {
      readonly status: "rejected"
      readonly rejection: WizEngineInnStayRejection
    }

type StayResultSummary = {
  readonly vault: WizVaultValue
  readonly hpRecovered: number
  readonly mpRecovered: number
  readonly hungerRecovered: number
  readonly apRecovered: number
  readonly goldSpent: number
}

export type WizEngineInnStayResult =
  | (StayResultSummary & {
      readonly status: "completed"
      readonly success: true
    })
  | (StayResultSummary & {
      readonly status: "rejected"
      readonly success: false
      readonly rejection: WizEngineInnStayRejection
    })

type Dependencies = {
  readonly timeFactory?: WizEngineTimeFactory
}

export type WizEngineInnPort = Readonly<{
  evaluateStay: (vault: WizVaultValue, planId: string) => WizEngineInnStayEligibility
  stay: (vault: WizVaultValue, planId: string) => WizEngineInnStayResult
}>

export class WizEngineInn implements WizEngineInnPort {
  readonly plans: WizEngineInnPlanCatalog
  private readonly timeFactory: WizEngineTimeFactory

  constructor(plans: WizEngineInnPlanCatalog, dependencies: Dependencies = {}) {
    if (!(plans instanceof WizEngineInnPlanCatalog)) {
      throw new TypeError("WizEngineInn requires a WizEngineInnPlanCatalog")
    }
    this.plans = plans
    this.timeFactory = dependencies.timeFactory ?? new WizEngineTimeFactory()
    Object.freeze(this)
  }

  canAffordStay(vault: WizVaultValue, planId: string): boolean {
    return this.evaluateStay(vault, planId).status === "eligible"
  }

  evaluateStay(vault: WizVaultValue, planId: string): WizEngineInnStayEligibility {
    const plan = this.plans.get(planId)
    if (plan === undefined) {
      return Object.freeze({
        status: "rejected",
        rejection: Object.freeze({
          type: "unknown_plan",
          planId,
        }),
      })
    }

    const available = vault.player.gold
    if (available >= plan.price) {
      return Object.freeze({ status: "eligible" })
    }
    return Object.freeze({
      status: "rejected",
      rejection: Object.freeze({
        type: "insufficient_gold",
        planId: plan.id,
        required: plan.price,
        available,
        shortfall: plan.price - available,
      }),
    })
  }

  stay(vault: WizVaultValue, planId: string): WizEngineInnStayResult {
    const eligibility = this.evaluateStay(vault, planId)
    if (eligibility.status === "rejected") {
      const failedVault =
        eligibility.rejection.type === "insufficient_gold"
          ? vault.addLog({
              key: "INN_NOT_ENOUGH_GOLD",
              planId,
              required: eligibility.rejection.shortfall,
            })
          : vault

      return Object.freeze({
        vault: failedVault,
        status: "rejected",
        success: false,
        rejection: eligibility.rejection,
        hpRecovered: 0,
        mpRecovered: 0,
        hungerRecovered: 0,
        apRecovered: 0,
        goldSpent: 0,
      })
    }

    const plan = this.plans.get(planId)
    if (plan === undefined) {
      throw new TypeError("Eligible inn plan must exist in its catalog")
    }
    const player = vault.player
    const hpRecovered = this.calculateResourceRecovery(plan.hpRecovery, player.hp, player.maxHp)
    const mpRecovered = this.calculateResourceRecovery(plan.mpRecovery, player.mp, player.maxMp)
    const hungerRecovered = this.calculateHungerRecovery(plan, player.hunger, 100)
    const apRecovered =
      plan.apRecovery === "full"
        ? player.maxAp - player.ap
        : Math.min(plan.apRecovery ?? 0, player.maxAp - player.ap)

    const healedPartyMembers = vault.partyMembers.map((member) => {
      const memberHpRecovery = this.calculateResourceRecovery(
        plan.hpRecovery,
        member.hp,
        member.maxHp,
      )
      const memberMpRecovery = this.calculateResourceRecovery(
        plan.mpRecovery,
        member.mp,
        member.maxMp,
      )
      const newHp = Math.min(member.hp + memberHpRecovery, member.maxHp)
      const newMp = Math.min(member.mp + memberMpRecovery, member.maxMp)
      return { ...member, hp: newHp, mp: newMp }
    })

    const newVault = vault
      .updatePlayer((currentPlayer) => {
        const recoveredPlayer = currentPlayer
          .spendGold(plan.price)
          .heal(hpRecovered)
          .restoreMp(mpRecovered)
          .addHunger(hungerRecovered)
        return plan.apRecovery === "full"
          ? recoveredPlayer.resetAp()
          : recoveredPlayer.restoreAp(apRecovered)
      })
      .withPartyMembers(healedPartyMembers)
      .withTime({
        ...vault.time,
        day: vault.time.day + 1,
        timeOfDay: "morning",
        weather: this.timeFactory.rollWeather(vault.time.season),
      })
      .addLog({ key: "INN_RESTED", planId })

    return Object.freeze({
      vault: newVault,
      status: "completed",
      success: true,
      hpRecovered,
      mpRecovered,
      hungerRecovered,
      apRecovered,
      goldSpent: plan.price,
    })
  }

  private calculateResourceRecovery(
    recovery: WizContentInnResourceRecovery | undefined,
    current: number,
    maximum: number,
  ): number {
    if (recovery === undefined) return 0
    const fixed = recovery.fixed ?? 0
    const percent = Math.floor(((recovery.percent ?? 0) / 100) * maximum)
    return Math.min(fixed + percent, maximum - current)
  }

  private calculateHungerRecovery(
    plan: WizContentInnPlan,
    currentHunger: number,
    maxHunger: number,
  ): number {
    if (plan.hungerRecovery === undefined) return 0
    return Math.min(plan.hungerRecovery, maxHunger - currentHunger)
  }
}

Object.freeze(WizEngineInn.prototype)
Object.freeze(WizEngineInn)
