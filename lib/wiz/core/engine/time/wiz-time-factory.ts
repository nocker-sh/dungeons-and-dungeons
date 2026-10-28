import {
  DEFAULT_TIME_CONFIG,
  parseWizTimeConfig,
  type WizTimeConfig,
} from "@/lib/wiz/core/config/time/wiz-time-config"
import { WizDice } from "@/lib/wiz/core/services/wiz-dice"
import type {
  WizSeason,
  WizSeasonEffect,
  WizTimeEffect,
  WizTimeOfDay,
  WizWeather,
  WizWeatherEffect,
} from "@/lib/wiz/core/types/time"

export type WizEngineTimeFactoryDefinition = Readonly<{
  readonly config?: WizTimeConfig
  readonly random?: () => number
}>

export class WizEngineTimeFactory {
  private readonly dice: WizDice
  private readonly config: WizTimeConfig

  constructor(definition: WizEngineTimeFactoryDefinition = {}) {
    this.dice = new WizDice({ randomFn: definition.random })
    this.config = parseWizTimeConfig(definition.config ?? DEFAULT_TIME_CONFIG)
    Object.freeze(this)
  }

  readonly getSeason = (day: number): WizSeason => {
    if (!Number.isSafeInteger(day) || day < 1) {
      throw new RangeError("Time day must be a positive safe integer")
    }
    const month = ((day - 1) % 360) / 30 + 1 // 30 days per month
    if (month <= 3) return "spring"
    if (month <= 6) return "summer"
    if (month <= 9) return "autumn"
    return "winter"
  }

  readonly getSeasonEffect = (season: WizSeason): WizSeasonEffect => {
    return this.config.seasonEffects[season]
  }

  readonly getTimeOfDay = (hour: number): WizTimeOfDay => {
    if (!Number.isFinite(hour) || hour < 0 || hour >= 24) {
      throw new RangeError("Time hour must be a finite number in 0 <= hour < 24")
    }
    if (hour >= 6 && hour < 12) return "morning"
    if (hour >= 12 && hour < 18) return "noon"
    if (hour >= 18 && hour < 22) return "evening"
    return "night"
  }

  readonly getTimeEffect = (timeOfDay: WizTimeOfDay): WizTimeEffect => {
    return this.config.timeEffects[timeOfDay]
  }

  readonly rollWeather = (season: WizSeason): WizWeather => {
    const weights = this.config.weatherWeights[season].map((w) => ({
      item: w.weather,
      weight: w.weight,
    }))
    return this.dice.weightedPick(weights) ?? "cloudy"
  }

  readonly getWeatherEffect = (weather: WizWeather): WizWeatherEffect => {
    return this.config.weatherEffects[weather]
  }
}

Object.freeze(WizEngineTimeFactory.prototype)
Object.freeze(WizEngineTimeFactory)
