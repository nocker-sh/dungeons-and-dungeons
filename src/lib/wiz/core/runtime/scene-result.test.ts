import { describe, expect, it } from "vite-plus/test"
import {
  WIZ_IMMUTABLE_VALUE,
  type WizDeepReadonly,
  WizImmutableValue,
} from "@/lib/wiz/core/immutable-value"
import { MOCK_VAULT } from "@/lib/wiz/core/mocks/mock-vault"
import type { WizPluginSceneState } from "@/lib/wiz/core/runtime/plugin/plugin-scene"
import {
  WizSceneAcceptedResultValue,
  WizSceneRejectedResultValue,
  WizSceneResultFactory,
  type WizSceneResult,
} from "@/lib/wiz/core/runtime/scene-result"
import { toVillageScene } from "@/lib/wiz/core/runtime/scene-transitions"
import { WizObjectService } from "@/lib/wiz/core/services/wiz-object-service"
import type { WizVaultValue } from "@/lib/wiz/core/vault/value"

class TestPluginSceneState implements WizPluginSceneState {
  declare readonly [WIZ_IMMUTABLE_VALUE]: true
  readonly type = "test_plugin"
  readonly metadata: WizDeepReadonly<{ scores: number[] }>

  constructor(
    readonly vault: WizVaultValue,
    scores: readonly number[],
  ) {
    this.metadata = Object.freeze({ scores: Object.freeze([...scores]) })
    WizImmutableValue.freeze(this)
  }

  withVault(vault: WizVaultValue): TestPluginSceneState {
    return new TestPluginSceneState(vault, this.metadata.scores)
  }

  updateVault(update: (vault: WizVaultValue) => WizVaultValue): TestPluginSceneState {
    return this.withVault(update(this.vault))
  }
}

class ShallowPluginSceneState implements WizPluginSceneState {
  declare readonly [WIZ_IMMUTABLE_VALUE]: true
  readonly type = "shallow_plugin"
  readonly metadata: { score: number }

  constructor(
    readonly vault: WizVaultValue,
    metadata: { score: number },
  ) {
    this.metadata = metadata
    WizImmutableValue.freeze(this)
  }

  withVault(vault: WizVaultValue): ShallowPluginSceneState {
    return new ShallowPluginSceneState(vault, this.metadata)
  }

  updateVault(update: (vault: WizVaultValue) => WizVaultValue): ShallowPluginSceneState {
    return this.withVault(update(this.vault))
  }
}

describe("WizSceneResultFactory", () => {
  const state = toVillageScene(MOCK_VAULT)

  it("accepted/rejectedを同じ不変値契約で生成する", () => {
    const accepted = WizSceneResultFactory.accept(state)
    const rejected = WizSceneResultFactory.reject(state, "ACTION_REJECTED")

    expect(Object.isFrozen(WizSceneResultFactory)).toBe(true)
    expect(Object.isFrozen(accepted)).toBe(true)
    expect(Object.isFrozen(rejected)).toBe(true)
    expect(accepted).toBeInstanceOf(WizSceneAcceptedResultValue)
    expect(rejected).toBeInstanceOf(WizSceneRejectedResultValue)
    expect(WizImmutableValue.is(accepted)).toBe(true)
    expect(WizImmutableValue.is(rejected)).toBe(true)
    expect(accepted.state).toBe(state)
    expect(rejected.state).toBe(state)
    expect(rejected).toMatchObject({
      accepted: false,
      reason: "ACTION_REJECTED",
    })
  })

  it("transitionをsourceからdeep-copyしてfreezeする", () => {
    const monsterIds = ["slime"]
    const transition = {
      type: "START_BATTLE" as const,
      areaId: "field",
      monsterIds,
    }

    const result = WizSceneResultFactory.accept(state, transition)
    monsterIds.push("second")

    expect(result.accepted).toBe(true)
    if (!result.accepted || result.transition?.type !== "START_BATTLE") {
      throw new Error("START_BATTLE transition is required")
    }
    expect(result.transition).not.toBe(transition)
    expect(result.transition.monsterIds).not.toBe(monsterIds)
    expect(result.transition.monsterIds).toEqual(["slime"])
    expect(Object.isFrozen(result.transition)).toBe(true)
    expect(Object.isFrozen(result.transition.monsterIds)).toBe(true)
  })

  it("semantic eventsを型保持してsourceからdeep-copyする", () => {
    const sourceEvents = [{ type: "SCORE_CHANGED" as const, amount: 2 }]
    const result = WizSceneResultFactory.accept(state, undefined, sourceEvents)
    const eventType: "SCORE_CHANGED" = result.events[0].type
    sourceEvents[0].amount = 99

    expect(eventType).toBe("SCORE_CHANGED")
    expect(result.events).toEqual([{ type: "SCORE_CHANGED", amount: 2 }])
    expect(result.events).not.toBe(sourceEvents)
    expect(Object.isFrozen(result.events)).toBe(true)
    expect(Object.isFrozen(result.events[0])).toBe(true)
  })

  it("semantic rejection reasonのliteral型を保持する", () => {
    const result = WizSceneResultFactory.reject(state, "ACTION_REJECTED")
    const reason: "ACTION_REJECTED" = result.reason

    expect(reason).toBe("ACTION_REJECTED")
  })

  it("空のrejection reasonを拒否する", () => {
    expect(() => WizSceneResultFactory.reject(state, "  ")).toThrow(RangeError)
    expect(() => WizSceneResultFactory.reject(state, " PADDED ")).toThrow(RangeError)
  })

  it("result value classに検証迂回factoryを公開しない", () => {
    expect(Object.hasOwn(WizSceneAcceptedResultValue, "create")).toBe(false)
    expect(Object.hasOwn(WizSceneRejectedResultValue, "create")).toBe(false)
  })

  it("TypeScript private constructorのruntime迂回を拒否する", () => {
    expect(() => Reflect.construct(WizSceneAcceptedResultValue, [state])).toThrow(TypeError)
    expect(() =>
      Reflect.construct(WizSceneRejectedResultValue, [state, "ACTION_REJECTED"]),
    ).toThrow(TypeError)
    expect(() => Reflect.construct(WizSceneResultFactory, [])).toThrow(TypeError)
  })

  it("plugin stateのimmutable contractをaccept/reject双方で検証する", () => {
    const pluginState = new TestPluginSceneState(MOCK_VAULT, [1])
    const accepted = WizSceneResultFactory.accept(pluginState)
    const rejected = WizSceneResultFactory.reject(pluginState, "ACTION_REJECTED")
    const ownership = new WizObjectService()

    expect(accepted.state).toBe(pluginState)
    expect(rejected.state).toBe(pluginState)
    expect(() => ownership.ownImmutable(accepted)).not.toThrow()
    expect(() => ownership.ownImmutable(rejected)).not.toThrow()

    const shallowState = new ShallowPluginSceneState(MOCK_VAULT, { score: 1 })
    expect(() => WizSceneResultFactory.accept(shallowState)).toThrow(
      /Cannot own shallow-frozen nested value/,
    )
    expect(() => WizSceneResultFactory.reject(shallowState, "ACTION_REJECTED")).toThrow(
      /Cannot own shallow-frozen nested value/,
    )
  })

  it("plugin state型がimmutable value contractを必須にする", () => {
    const verifyPluginStateContract = () => {
      // @ts-expect-error raw objectはimmutable value contractを宣言していない。
      const rawState: WizPluginSceneState = {
        type: "raw_plugin",
        vault: MOCK_VAULT,
        withVault: () => rawState,
        updateVault: () => rawState,
      }
      return rawState
    }
    expect(typeof verifyPluginStateContract).toBe("function")
  })

  it("raw object literalをscene resultとして受理しない", () => {
    const verifyNominalResult = () => {
      // @ts-expect-error scene resultはfactoryだけが生成するnominal value。
      const raw: WizSceneResult<typeof state> = { accepted: true, state }
      return raw
    }
    expect(typeof verifyNominalResult).toBe("function")
  })

  it("factory外のraw objectとprototype偽装をauthority境界で拒否する", () => {
    const accepted = WizSceneResultFactory.accept(state)
    const raw = { accepted: true, events: [], state }
    const forged = Object.create(Object.getPrototypeOf(accepted))

    expect(() => WizSceneResultFactory.assertAuthentic(raw)).toThrow(TypeError)
    expect(() => WizSceneResultFactory.assertAuthentic(forged)).toThrow(TypeError)
    expect(() => WizSceneResultFactory.assertAuthentic(accepted)).not.toThrow()
  })
})
