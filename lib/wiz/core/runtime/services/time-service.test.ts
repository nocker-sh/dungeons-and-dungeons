import { describe, expect, it } from "vite-plus/test"
import { MOCK_VAULT } from "@/lib/wiz/core/mocks/mock-vault"
import type { WizEngineTimeFactory } from "@/lib/wiz/core/engine/time/wiz-time-factory"
import { toVillageScene } from "@/lib/wiz/core/runtime/to-village-scene"
import {
  type WizRuntimeTimeAdvanceResult,
  WizRuntimeTimeService,
} from "@/lib/wiz/core/runtime/services/time-service"
import type { WizRuntimeVaultState } from "@/lib/wiz/core/runtime/services/defeat-service"
import type { WizHungerServicePort } from "@/lib/wiz/core/vault/states/player/services/wiz-hunger-service"

const service = new WizRuntimeTimeService()

const verifyReadonlyTimeAdvanceResult = (
  result: WizRuntimeTimeAdvanceResult<object>
): void => {
  // @ts-expect-error advance result properties are readonly.
  result.isNewDay = false
}

void verifyReadonlyTimeAdvanceResult

describe("advance", () => {
  it("morning → noon", () => {
    const vault = MOCK_VAULT.withTime({
      ...MOCK_VAULT.time,
      timeOfDay: "morning",
    })
    const scene = toVillageScene(vault)

    const result = service.advance(scene)

    expect(Object.isFrozen(result)).toBe(true)
    expect(result.state.vault.time.timeOfDay).toBe("noon")
    expect(result.isNewDay).toBe(false)
  })

  it("noon → evening", () => {
    const vault = MOCK_VAULT.withTime({
      ...MOCK_VAULT.time,
      timeOfDay: "noon",
    })
    const scene = toVillageScene(vault)

    const result = service.advance(scene)

    expect(result.state.vault.time.timeOfDay).toBe("evening")
  })

  it("evening → night", () => {
    const vault = MOCK_VAULT.withTime({
      ...MOCK_VAULT.time,
      timeOfDay: "evening",
    })
    const scene = toVillageScene(vault)

    const result = service.advance(scene)

    expect(result.state.vault.time.timeOfDay).toBe("night")
  })

  it("night → morning (新しい日)", () => {
    const vault = MOCK_VAULT.withTime({
      ...MOCK_VAULT.time,
      timeOfDay: "night",
      day: 1,
    })
    const scene = toVillageScene(vault)

    const result = service.advance(scene)

    expect(result.state.vault.time.timeOfDay).toBe("morning")
    expect(result.state.vault.time.day).toBe(2)
    expect(result.isNewDay).toBe(true)
  })

  it("空腹度を減らす", () => {
    const vault = MOCK_VAULT.updatePlayer((p) => p.withHunger(100))
    const scene = toVillageScene(vault)
    const initialHunger = scene.vault.player.hunger

    const result = service.advance(scene)

    expect(result.state.vault.player.hunger).toBeLessThan(initialHunger)
  })

  it("季節変化を検出する (spring → summer)", () => {
    const vault = MOCK_VAULT.withTime({
      ...MOCK_VAULT.time,
      timeOfDay: "night",
      day: 90,
      season: "spring",
    })
    const scene = toVillageScene(vault)

    const result = service.advance(scene)

    expect(result.seasonChanged).toBe(true)
    expect(result.newSeason).toBe("summer")
  })

  it("季節が変わらない場合 seasonChanged が false", () => {
    const vault = MOCK_VAULT.withTime({
      ...MOCK_VAULT.time,
      timeOfDay: "morning",
      day: 1,
      season: "spring",
    })
    const scene = toVillageScene(vault)

    const result = service.advance(scene)

    expect(result.seasonChanged).toBe(false)
    expect(result.newSeason).toBeNull()
  })
})

describe("advanceWithLog", () => {
  it("季節変化時にログを追加する", () => {
    const vault = MOCK_VAULT.withTime({
      ...MOCK_VAULT.time,
      timeOfDay: "night",
      day: 90,
      season: "spring",
    })
    const scene = toVillageScene(vault)
    const initialLogLength = scene.vault.log.length

    const result = service.advanceWithLog(scene)

    expect(result.vault.log.length).toBeGreaterThan(initialLogLength)
    const seasonLog = result.vault.log.find((l) => l.key === "SEASON_CHANGED")
    expect(seasonLog).toBeDefined()
  })
})

describe("DI", () => {
  it("カスタム hungerService で空腹ペナルティを制御できる", () => {
    const mockHungerService = {
      getHungerImpact: () => ({
        actionPointReduction: 0,
        abilityPowerMultiplier: 1,
        hpLoss: 25,
      }),
      getHungerState: () => "critical" as const,
    } satisfies WizHungerServicePort

    const diService = new WizRuntimeTimeService({
      hungerService: mockHungerService,
    })

    const vault = MOCK_VAULT.updatePlayer((p) => p.withHunger(100))
    const scene = toVillageScene(vault)
    const hpBefore = scene.vault.player.hp

    const result = diService.advance(scene)

    expect(result.hungerImpact).toEqual({
      actionPointReduction: 0,
      abilityPowerMultiplier: 1,
      hpLoss: 25,
    })
    expect(result.state.vault.player.hp).toBe(hpBefore - 25)
  })

  it("カスタム timeFactory で天候・季節を固定できる", () => {
    const mockTimeFactory = {
      getWeatherEffect: () => ({
        gatheringBonus: 0,
        explorationBonus: 0,
        combatBonus: 0,
        hungerModifier: 2.0,
      }),
      getSeasonEffect: () => ({
        gatheringBonus: 0,
        hungerModifier: 3.0,
      }),
      getSeason: () => "winter" as const,
      rollWeather: () => "stormy" as const,
    } as unknown as WizEngineTimeFactory

    const diService = new WizRuntimeTimeService({
      timeFactory: mockTimeFactory,
    })

    // hungerModifier = 2.0 * 3.0 = 6.0, hungerLoss = floor(10 * 6.0) = 60
    const vault = MOCK_VAULT.updatePlayer((p) => p.withHunger(100)).withTime({
      ...MOCK_VAULT.time,
      timeOfDay: "morning",
    })
    const scene = toVillageScene(vault)

    const result = diService.advance(scene)

    expect(result.state.vault.player.hunger).toBe(100 - 60)
  })

  it("カスタム timeFactory で新しい日の天候が決定論的になる", () => {
    const mockTimeFactory = {
      getWeatherEffect: () => ({
        gatheringBonus: 0,
        explorationBonus: 0,
        combatBonus: 0,
        hungerModifier: 1.0,
      }),
      getSeasonEffect: () => ({
        gatheringBonus: 0,
        hungerModifier: 1.0,
      }),
      getSeason: () => "spring" as const,
      rollWeather: () => "snowy" as const,
    } as unknown as WizEngineTimeFactory

    const diService = new WizRuntimeTimeService({
      timeFactory: mockTimeFactory,
    })

    const vault = MOCK_VAULT.withTime({
      ...MOCK_VAULT.time,
      timeOfDay: "night",
      day: 1,
      weather: "sunny",
    })
    const scene = toVillageScene(vault)

    const result = diService.advance(scene)

    expect(result.isNewDay).toBe(true)
    expect(result.state.vault.time.weather).toBe("snowy")
  })

  it("カスタム defeatService で敗北判定を制御できる", () => {
    let checked = false
    const defeatService = {
      check: <TState extends WizRuntimeVaultState<TState>>(
        worldState: TState
      ) => {
        checked = true
        return { state: worldState }
      },
    }

    const diService = new WizRuntimeTimeService({
      defeatService,
    })

    const vault = MOCK_VAULT.withTime({
      ...MOCK_VAULT.time,
      timeOfDay: "night",
      day: 90,
      season: "spring",
    })
    const scene = toVillageScene(vault)

    const result = diService.advanceWithLog(scene)

    expect(result).toBeDefined()
    expect(checked).toBe(true)
  })
})
