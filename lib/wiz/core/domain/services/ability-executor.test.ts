import { describe, expect, it } from "vite-plus/test"
import {
  WizAbilityActivation,
  WizAbilityExecutionAccepted,
  WizAbilityExecutionRejected,
  WizAbilityExecutor,
} from "@/lib/wiz/core/domain/services/ability-executor"
import {
  WizAbility,
  WizAbilityBook,
  WizAbilityReadiness,
} from "@/lib/wiz/core/domain/values/ability"
import { WizResourceSet } from "@/lib/wiz/core/domain/values/resource-set"

const strike = WizAbility.define({
  id: "strike",
  name: "Strike",
  costs: { stamina: 4 },
  cooldownGroups: { actions: 250 },
  cooldownMs: 1_000,
  castTimeMs: 100,
  recoveryTimeMs: 300,
  effect: { kind: "damage", power: 8 } as const,
})

const createInput = () => ({
  ability: strike,
  atMs: 2_000,
  book: WizAbilityBook.create(["strike"]),
  readiness: WizAbilityReadiness.create(),
  resources: WizResourceSet.create({
    stamina: { current: 10, maximum: 10 },
  }),
  target: { actorId: "slime" },
})

describe("WizAbilityExecutor", () => {
  it("resourceとreadinessを原子的に更新して発動時刻を返す", () => {
    const input = createInput()
    const result = new WizAbilityExecutor().execute(input)

    expect(result).toBeInstanceOf(WizAbilityExecutionAccepted)
    expect(result.accepted).toBe(true)
    if (!result.accepted) throw new Error("Expected an accepted result")
    expect(result.resources.current("stamina")).toBe(6)
    expect(result.readiness.readyInMs(strike, 2_000)).toBe(1_000)
    expect(result.activation).toBeInstanceOf(WizAbilityActivation)
    expect(result.activation).toMatchObject({
      abilityId: "strike",
      effect: { kind: "damage", power: 8 },
      recoversAtMs: 2_400,
      resolvesAtMs: 2_100,
      startedAtMs: 2_000,
      target: { actorId: "slime" },
    })
    expect(result.activation.canResolve(2_099)).toBe(false)
    expect(result.activation.canResolve(2_100)).toBe(true)
    expect(input.resources.current("stamina")).toBe(10)
    expect(input.readiness.toPlain()).toEqual({ abilities: {}, groups: {} })
  })

  it("未習得、policy、cooldown、resource不足を構造化して拒否する", () => {
    const executor = new WizAbilityExecutor()
    const base = createInput()
    const notLearned = executor.execute({
      ...base,
      book: WizAbilityBook.create([]),
    })
    const denied = executor.execute({
      ...base,
      policy: {
        authorize: () => ({
          allowed: false,
          reason: { code: "TARGET_OUT_OF_RANGE" } as const,
        }),
      },
    })
    const coolingDown = executor.execute({
      ...base,
      atMs: 2_100,
      readiness: base.readiness.use(strike, 2_000),
    })
    const insufficientResources = WizResourceSet.create({
      stamina: { current: 3, maximum: 10 },
    })
    const insufficient = executor.execute({
      ...base,
      resources: insufficientResources,
    })

    expect(notLearned).toBeInstanceOf(WizAbilityExecutionRejected)
    expect(notLearned).toMatchObject({
      accepted: false,
      rejection: { abilityId: "strike", code: "ABILITY_NOT_LEARNED" },
    })
    expect(denied).toMatchObject({
      accepted: false,
      rejection: { code: "POLICY_REJECTED", reason: { code: "TARGET_OUT_OF_RANGE" } },
    })
    expect(coolingDown).toMatchObject({
      accepted: false,
      rejection: { abilityId: "strike", code: "ABILITY_NOT_READY", readyInMs: 900 },
    })
    expect(insufficient).toMatchObject({
      accepted: false,
      rejection: {
        available: 3,
        code: "RESOURCE_INSUFFICIENT",
        required: 4,
        resourceId: "stamina",
      },
    })
    expect(insufficient.resources).toBe(insufficientResources)
    expect(insufficient.readiness).toBe(base.readiness)
  })

  it("外部値の変更とfactoryを通らない入力を拒絶する", () => {
    const target = { actorId: "slime" }
    const result = new WizAbilityExecutor().execute({
      ...createInput(),
      target,
    })
    target.actorId = "forged"

    expect(result.accepted).toBe(true)
    if (!result.accepted) throw new Error("Expected an accepted result")
    expect(result.activation.target).toEqual({ actorId: "slime" })

    const forgedReadiness = Object.create(
      WizAbilityReadiness.prototype,
    ) as WizAbilityReadiness<string>
    expect(() =>
      new WizAbilityExecutor().execute({
        ...createInput(),
        readiness: forgedReadiness,
      }),
    ).toThrow(TypeError)
  })
})
