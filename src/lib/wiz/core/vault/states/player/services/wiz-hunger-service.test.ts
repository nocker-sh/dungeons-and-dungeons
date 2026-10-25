import { expect, test } from "vite-plus/test"
import type { WizHungerImpact } from "@/lib/wiz/core/domain/values/hunger-impact"
import { WizValueValidationError } from "@/lib/wiz/core/value-validation"
import {
  createWizStandardHungerService,
  WizVaultHungerService,
} from "@/lib/wiz/core/vault/states/player/services/wiz-hunger-service"

const service = createWizStandardHungerService()

test("getHungerState は hunger 71 以上で full を返す", () => {
  expect(service.getHungerState(71)).toBe("full")
  expect(service.getHungerState(100)).toBe("full")
})

test("getHungerState は hunger 31-70 で normal を返す", () => {
  expect(service.getHungerState(31)).toBe("normal")
  expect(service.getHungerState(70)).toBe("normal")
})

test("getHungerState は hunger 11-30 で hungry を返す", () => {
  expect(service.getHungerState(11)).toBe("hungry")
  expect(service.getHungerState(30)).toBe("hungry")
})

test("getHungerState は hunger 1-10 で starving を返す", () => {
  expect(service.getHungerState(1)).toBe("starving")
  expect(service.getHungerState(10)).toBe("starving")
})

test("getHungerState は hunger 0 以下で critical を返す", () => {
  expect(service.getHungerState(0)).toBe("critical")
  expect(service.getHungerState(-5)).toBe("critical")
})

test("getHungerImpact は full/normal で影響なし", () => {
  const fullImpact = service.getHungerImpact(80)
  const normalImpact = service.getHungerImpact(50)

  expect(fullImpact.actionPointReduction).toBe(0)
  expect(fullImpact.abilityPowerMultiplier).toBe(1)
  expect(fullImpact.hpLoss).toBe(0)

  expect(normalImpact.actionPointReduction).toBe(0)
  expect(normalImpact.abilityPowerMultiplier).toBe(1)
  expect(normalImpact.hpLoss).toBe(0)
})

test("getHungerImpact は hungry で軽度の影響", () => {
  const impact = service.getHungerImpact(20)

  expect(impact.actionPointReduction).toBe(1)
  expect(impact.abilityPowerMultiplier).toBe(0.9)
  expect(impact.hpLoss).toBe(0)
})

test("getHungerImpact は starving で中度の影響", () => {
  const impact = service.getHungerImpact(5)

  expect(impact.actionPointReduction).toBe(2)
  expect(impact.abilityPowerMultiplier).toBe(0.8)
  expect(impact.hpLoss).toBe(5)
})

test("getHungerImpact は critical で重度の影響", () => {
  const impact = service.getHungerImpact(0)

  expect(impact.actionPointReduction).toBe(5)
  expect(impact.abilityPowerMultiplier).toBe(0.5)
  expect(impact.hpLoss).toBe(10)
})

test("getHungerImpact はruntimeと型の両方でreadonlyな値を返す", () => {
  const impact = service.getHungerImpact(20)
  const verifyReadonlyImpact = (readonlyImpact: WizHungerImpact): void => {
    // @ts-expect-error hunger impact output is readonly.
    readonlyImpact.actionPointReduction = 999
  }

  expect(Object.isFrozen(impact)).toBe(true)
  expect(verifyReadonlyImpact).toBeTypeOf("function")
})

test("任意のstate IDとimpact tableをcaller-owned値から隔離する", () => {
  const definition = {
    bands: [
      {
        state: "energized",
        minimum: 50,
        impact: { actionPointReduction: 0, abilityPowerMultiplier: 1, hpLoss: 0 },
      },
    ],
    fallback: {
      state: "exhausted",
      impact: { actionPointReduction: 3, abilityPowerMultiplier: 0.4, hpLoss: 5 },
    },
  } as const
  const custom = new WizVaultHungerService(definition)
  Reflect.set(definition.fallback.impact, "hpLoss", 99)

  expect(custom.getHungerState(50)).toBe("energized")
  expect(custom.getHungerState(49)).toBe("exhausted")
  expect(custom.getHungerImpact(49).hpLoss).toBe(5)
  expect(Object.isFrozen(custom)).toBe(true)
  expect(Object.isFrozen(custom.getHungerImpact(49))).toBe(true)
})

test("重複state、昇順threshold、非finite入力を拒否する", () => {
  expect(
    () =>
      new WizVaultHungerService({
        bands: [
          {
            state: "high",
            minimum: 10,
            impact: { actionPointReduction: 0, abilityPowerMultiplier: 1, hpLoss: 0 },
          },
          {
            state: "high",
            minimum: 20,
            impact: { actionPointReduction: 0, abilityPowerMultiplier: 1, hpLoss: 0 },
          },
        ],
        fallback: {
          state: "low",
          impact: { actionPointReduction: 1, abilityPowerMultiplier: 0.9, hpLoss: 1 },
        },
      }),
  ).toThrow(WizValueValidationError)
  expect(() => service.getHungerState(Number.NaN)).toThrow(WizValueValidationError)
})
