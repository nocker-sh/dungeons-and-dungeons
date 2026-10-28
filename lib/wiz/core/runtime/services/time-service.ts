import { WizEngineTimeFactory } from "@/lib/wiz/core/engine/time/wiz-time-factory"
import type { WizHungerImpact } from "@/lib/wiz/core/domain/values/hunger-impact"
import {
  type WizRuntimeDefeatPolicy,
  WizRuntimeDefeatService,
  type WizRuntimeVaultState,
} from "@/lib/wiz/core/runtime/services/defeat-service"
import {
  createWizStandardHungerService,
  type WizHungerServicePort,
} from "@/lib/wiz/core/vault/states/player/services/wiz-hunger-service"

export type WizRuntimeTimeAdvanceResult<TState> = {
  readonly state: TState
  readonly isNewDay: boolean
  readonly seasonChanged: boolean
  readonly newSeason: string | null
  readonly hungerImpact: WizHungerImpact
}

const WIZ_RUNTIME_TIME_ORDER = Object.freeze(["morning", "noon", "evening", "night"] as const)

type Dependencies = {
  readonly hungerService?: WizHungerServicePort
  readonly timeFactory?: WizEngineTimeFactory
  readonly defeatService?: WizRuntimeDefeatPolicy
}

export class WizRuntimeTimeService {
  private readonly hungerService: WizHungerServicePort
  private readonly timeFactory: WizEngineTimeFactory
  private readonly defeatService: WizRuntimeDefeatPolicy

  constructor(dependencies: Dependencies = {}) {
    this.hungerService = dependencies.hungerService ?? createWizStandardHungerService()
    this.timeFactory = dependencies.timeFactory ?? new WizEngineTimeFactory()
    this.defeatService = dependencies.defeatService ?? new WizRuntimeDefeatService()
    Object.freeze(this)
  }

  advance<TState extends WizRuntimeVaultState<TState>>(
    state: TState,
    hungerCostBase?: number,
  ): WizRuntimeTimeAdvanceResult<TState> {
    const currentIndex = WIZ_RUNTIME_TIME_ORDER.indexOf(state.vault.time.timeOfDay)
    const nextIndex = (currentIndex + 1) % 4
    const isNewDay = nextIndex === 0

    const weatherEffect = this.timeFactory.getWeatherEffect(state.vault.time.weather)
    const seasonEffect = this.timeFactory.getSeasonEffect(state.vault.time.season)
    const totalHungerModifier = weatherEffect.hungerModifier * seasonEffect.hungerModifier
    const baseHungerCost = hungerCostBase ?? 10
    const hungerLoss = Math.floor(baseHungerCost * totalHungerModifier)

    const newDay = isNewDay ? state.vault.time.day + 1 : state.vault.time.day
    const newSeason = isNewDay ? this.timeFactory.getSeason(newDay) : state.vault.time.season
    const seasonChanged = isNewDay && newSeason !== state.vault.time.season

    const newVault = state.vault
      .withTime({
        ...state.vault.time,
        timeOfDay: WIZ_RUNTIME_TIME_ORDER[nextIndex],
        day: newDay,
        season: newSeason,
        weather: isNewDay ? this.timeFactory.rollWeather(newSeason) : state.vault.time.weather,
      })
      .updatePlayer((p) => p.addHunger(-hungerLoss))

    const hungerImpact = this.hungerService.getHungerImpact(newVault.player.hunger)

    let finalVault = newVault
    if (hungerImpact.hpLoss > 0) {
      finalVault = finalVault.updatePlayer((p) => p.damage(hungerImpact.hpLoss))
    }

    if (hungerImpact.actionPointReduction > 0) {
      const effectiveMaxAp = Math.max(
        1,
        finalVault.player.maxAp - hungerImpact.actionPointReduction,
      )
      if (finalVault.player.ap > effectiveMaxAp) {
        finalVault = finalVault.updatePlayer((p) => p.withAp(effectiveMaxAp))
      }
    }

    return Object.freeze({
      state: state.withVault(finalVault),
      isNewDay,
      seasonChanged,
      newSeason: seasonChanged ? newSeason : null,
      hungerImpact,
    })
  }

  advanceWithLog<TState extends WizRuntimeVaultState<TState>>(
    state: TState,
    hungerCostBase?: number,
  ): TState {
    const result = this.advance(state, hungerCostBase)
    let newState = result.state

    if (result.seasonChanged && result.newSeason) {
      const season = result.newSeason
      newState = newState.updateVault((v) => v.addLog({ key: "SEASON_CHANGED", season }))
    }

    if (result.hungerImpact.hpLoss > 0) {
      newState = newState.updateVault((v) => v.addLog({ key: "HUNGER_DAMAGE" }))
    }

    return this.defeatService.check(newState).state
  }
}
