import { describe, expect, expectTypeOf, it } from "vite-plus/test"
import {
  type WizItemEffectEvent,
  WizItemEffectService,
  WizItemEffectTargetSnapshot,
  type WizItemEffectTargetAdapter,
  type WizItemEffectTargetSnapshotDefinition,
} from "@/lib/wiz/core/domain/services/item-effect-service"
import type { WizDeepReadonly } from "@/lib/wiz/core/immutable-value"
import { WizValueValidationError } from "@/lib/wiz/core/value-validation"

type TestTarget = Readonly<{
  hp: number
  maxHp: number
  mp: number
  maxMp: number
  hunger: number
  strength: number
}>

const adapter: WizItemEffectTargetAdapter<TestTarget> = {
  inspect: (target) => ({
    hp: target.hp,
    maxHp: target.maxHp,
    mp: target.mp,
    maxMp: target.maxMp,
    hunger: target.hunger,
    maxHunger: 100,
    defeated: target.hp <= 0,
  }),
  applyEvent: (target, event) => applyEvent(target, event),
}

const service = new WizItemEffectService(adapter)

function createTarget(overrides: Partial<TestTarget> = {}): TestTarget {
  return Object.freeze({
    hp: 50,
    maxHp: 100,
    mp: 5,
    maxMp: 20,
    hunger: 40,
    strength: 10,
    ...overrides,
  })
}

function applyEvent(target: TestTarget, event: WizItemEffectEvent): TestTarget {
  switch (event.type) {
    case "hp_restored":
      return Object.freeze({ ...target, hp: target.hp + event.amount })
    case "mp_restored":
      return Object.freeze({ ...target, mp: target.mp + event.amount })
    case "hunger_restored":
      return Object.freeze({ ...target, hunger: target.hunger + event.amount })
    case "temporary_stat_increased":
      return event.stat === "strength"
        ? Object.freeze({ ...target, strength: target.strength + event.amount })
        : target
    case "revived":
      return Object.freeze({ ...target, hp: event.hp })
    case "status_cured":
    case "teleport_requested":
    case "light_activated":
    case "poison_requested":
    case "trap_requested":
    case "fuel_requested":
    case "unlock_requested":
      return target
  }
}

describe("WizItemEffectService", () => {
  it("applyをbindせず呼べ、実装を差し替えられない", () => {
    const { apply } = service

    const result = apply(createTarget(), { type: "heal", value: 5 })

    expect(result.applied).toBe(true)
    expect(Object.isFrozen(service)).toBe(true)
    expect(Object.isFrozen(WizItemEffectService.prototype)).toBe(true)
    expect(Object.isFrozen(WizItemEffectService)).toBe(true)

    const verifyReadonly = () => {
      const replacementApply = service.apply
      // @ts-expect-error applyはreadonly function property。
      service.apply = replacementApply
    }
    void verifyReadonly
  })

  it("inspect出力を検証済みの不変snapshot classへ正規化する", () => {
    const definition = {
      hp: 5,
      maxHp: 10,
      mp: 2,
      maxMp: 4,
      hunger: 3,
      maxHunger: 8,
      defeated: false,
    }
    const snapshot = WizItemEffectTargetSnapshot.create(definition)
    definition.hp = 0

    expect(snapshot).toBeInstanceOf(WizItemEffectTargetSnapshot)
    expect(snapshot.hp).toBe(5)
    expect(Object.isFrozen(snapshot)).toBe(true)
    expect(WizItemEffectTargetSnapshot.fromUnknown(snapshot)).toBe(snapshot)

    const verifyReadonlySnapshot = (
      value: WizItemEffectTargetSnapshot
    ): void => {
      // @ts-expect-error canonical snapshot fieldはreadonly。
      value.hp = 0
    }
    void verifyReadonlySnapshot
  })

  it.each([
    ["hpがNaN", { hp: Number.NaN }, "targetSnapshot.hp"],
    ["maxHpが負数", { maxHp: -1 }, "targetSnapshot.maxHp"],
    ["hpがmaxHpを超過", { hp: 11 }, "targetSnapshot.hp"],
    ["mpがmaxMpを超過", { mp: 21 }, "targetSnapshot.mp"],
    ["hungerがmaxHungerを超過", { hunger: 101 }, "targetSnapshot.hunger"],
    [
      "defeatedがbooleanでない",
      { defeated: "false" },
      "targetSnapshot.defeated",
    ],
  ])("不正な%s inspect出力を計算前に拒否する", (_label, overrides, path) => {
    const invalidSnapshot = {
      hp: 5,
      maxHp: 10,
      mp: 2,
      maxMp: 20,
      hunger: 40,
      maxHunger: 100,
      defeated: false,
      ...overrides,
    }
    const invalidService = new WizItemEffectService<TestTarget>({
      inspect: () =>
        invalidSnapshot as unknown as WizItemEffectTargetSnapshotDefinition,
      applyEvent: (target) => target,
    })

    expect(() =>
      invalidService.apply(createTarget(), { type: "heal", value: 1 })
    ).toThrow(WizValueValidationError)
    expect(() =>
      invalidService.apply(createTarget(), { type: "heal", value: 1 })
    ).toThrow(path)
  })

  it("NaNを含むeffectからeventを生成しない", () => {
    let appliedEventCount = 0
    const guardedService = new WizItemEffectService<TestTarget>({
      inspect: adapter.inspect,
      applyEvent: (target) => {
        appliedEventCount++
        return target
      },
    })
    const buff = guardedService.apply(createTarget(), {
      type: "buff",
      stat: "focus",
      value: 1,
      duration: Number.NaN,
    })
    const poison = guardedService.apply(createTarget(), {
      type: "poison",
      value: Number.NaN,
    })

    expect(buff).toMatchObject({
      applied: false,
      rejection: { type: "invalid_value", field: "duration" },
    })
    expect(poison).toMatchObject({
      applied: false,
      rejection: { type: "invalid_value", field: "value", value: "NaN" },
    })
    expect(JSON.parse(JSON.stringify(poison))).toMatchObject({
      rejection: { value: "NaN" },
    })
    expect(appliedEventCount).toBe(0)
  })

  it("adapterが返した次targetもcanonical snapshotとして再検証する", () => {
    const invalidOutputService = new WizItemEffectService<TestTarget>({
      inspect: adapter.inspect,
      applyEvent: (target) => Object.freeze({ ...target, hp: -1 }),
    })

    expect(() =>
      invalidOutputService.apply(createTarget(), {
        type: "heal",
        value: 1,
      })
    ).toThrow(WizValueValidationError)
    expect(() =>
      invalidOutputService.apply(createTarget(), {
        type: "heal",
        value: 1,
      })
    ).toThrow("targetSnapshot.hp")
  })

  it("表示文言ではなく実回復量を持つ意味イベントを返す", () => {
    const target = createTarget({ hp: 90 })

    const result = service.apply(target, { type: "heal", value: 30 })

    expect(result.applied).toBe(true)
    if (!result.applied) return
    expect(result.target.hp).toBe(100)
    expect(result.events).toEqual([{ type: "hp_restored", amount: 10 }])
    expect("message" in result).toBe(false)
  })

  it("restore_mp を immutable target に適用する", () => {
    const target = createTarget({ mp: 16, maxMp: 20 })

    const result = service.apply(target, { type: "restore_mp", value: 10 })

    expect(result.applied).toBe(true)
    if (!result.applied) return
    expect(target.mp).toBe(16)
    expect(result.target.mp).toBe(20)
    expect(result.events).toEqual([{ type: "mp_restored", amount: 4 }])
  })

  it("food は空腹度と任意の HP 回復を一つの原子的な結果にまとめる", () => {
    const target = createTarget({ hp: 80, hunger: 90 })

    const result = service.apply(target, {
      type: "food",
      hungerRestore: 20,
      healValue: 5,
    })

    expect(result.applied).toBe(true)
    if (!result.applied) return
    expect(result.target.hunger).toBe(100)
    expect(result.target.hp).toBe(85)
    expect(result.events).toEqual([
      { type: "hunger_restored", amount: 10 },
      { type: "hp_restored", amount: 5 },
    ])
  })

  it("戦闘専用 effect は表示文言でなく型付き rejection を返す", () => {
    const target = createTarget()

    const result = service.apply(target, { type: "damage", value: 10 })

    expect(result).toEqual({
      applied: false,
      target,
      rejection: {
        type: "context_required",
        effectType: "damage",
        context: "battle",
      },
    })
  })

  it("effect がない場合は元 target と理由を返す", () => {
    const target = createTarget()

    const result = service.apply(target, undefined)

    expect(result).toEqual({
      applied: false,
      target,
      rejection: { type: "missing_effect" },
    })
  })

  it("回復先が満タンならappliedにせず理由を返す", () => {
    const target = createTarget({ hp: 100 })

    const result = service.apply(target, { type: "heal", value: 20 })

    expect(result).toEqual({
      applied: false,
      target,
      rejection: {
        type: "no_change",
        effectType: "heal",
      },
    })
  })

  it("foodはHPと空腹度の両方が満タンならappliedにしない", () => {
    const target = createTarget({ hp: 100, hunger: 100 })

    const result = service.apply(target, {
      type: "food",
      hungerRestore: 20,
      healValue: 10,
    })

    expect(result).toMatchObject({
      applied: false,
      target,
      rejection: {
        type: "no_change",
        effectType: "food",
      },
    })
  })

  it("最大HPが0のtargetはreviveを適用済みにしない", () => {
    const target = createTarget({ hp: 0, maxHp: 0 })
    const result = service.apply(target, { type: "revive" })

    expect(result).toEqual({
      applied: false,
      target,
      rejection: {
        type: "no_change",
        effectType: "revive",
      },
    })
  })

  it("reviveの省略値だけを50%既定値として扱い、明示0は拒否する", () => {
    const target = createTarget({ hp: 0, maxHp: 80 })
    const defaultResult = service.apply(target, { type: "revive" })
    const zeroResult = service.apply(target, { type: "revive", value: 0 })

    expect(defaultResult).toMatchObject({
      applied: true,
      target: { hp: 40 },
      events: [{ type: "revived", hp: 40 }],
    })
    expect(zeroResult).toMatchObject({
      applied: false,
      rejection: {
        type: "invalid_value",
        effectType: "revive",
        field: "value",
        value: "0",
      },
    })
  })

  it.each([
    [{ type: "buff" as const, stat: "focus", value: 0, duration: 1 }, "value"],
    [
      { type: "buff" as const, stat: "attack", value: 1, duration: 0 },
      "duration",
    ],
    [
      { type: "buff" as const, stat: "defense", value: 1, duration: 1.5 },
      "duration",
    ],
  ])("効果のないbuff値をeventにしない", (effect, field) => {
    const result = service.apply(createTarget(), effect)

    expect(result).toMatchObject({
      applied: false,
      rejection: {
        type: "invalid_value",
        field,
      },
    })
  })

  it("公開 service・result・events を freeze する", () => {
    let observedEvent: WizItemEffectEvent | undefined
    const observingService = new WizItemEffectService<TestTarget>({
      inspect: adapter.inspect,
      applyEvent: (target, event) => {
        observedEvent = event
        return applyEvent(target, event)
      },
    })
    const result = observingService.apply(createTarget(), {
      type: "heal",
      value: 5,
    })

    expect(Object.isFrozen(observingService)).toBe(true)
    expect(Object.isFrozen(WizItemEffectService)).toBe(true)
    expect(Object.isFrozen(WizItemEffectService.prototype)).toBe(true)
    expect(Object.isFrozen(result)).toBe(true)
    if (!result.applied) return
    expect(Object.isFrozen(result.events)).toBe(true)
    expect(Object.isFrozen(result.events[0])).toBe(true)
    expect(observedEvent).toBe(result.events[0])
    expect(Object.isFrozen(observedEvent)).toBe(true)
  })

  it("入力targetとadapter出力を所有してdeep readonly resultだけを公開する", () => {
    type MutableTarget = {
      hp: number
      maxHp: number
      mp: number
      maxMp: number
      hunger: number
      metadata: { tags: string[] }
    }

    const source: MutableTarget = {
      hp: 1,
      maxHp: 10,
      mp: 0,
      maxMp: 0,
      hunger: 0,
      metadata: { tags: ["source"] },
    }
    let observedTarget: WizDeepReadonly<MutableTarget> | undefined
    let adapterOutput: MutableTarget | undefined
    const boundaryService = new WizItemEffectService<MutableTarget>({
      inspect: (target) => {
        observedTarget = target
        return {
          hp: target.hp,
          maxHp: target.maxHp,
          mp: target.mp,
          maxMp: target.maxMp,
          hunger: target.hunger,
          maxHunger: 100,
          defeated: false,
        }
      },
      applyEvent: (target, event) => {
        adapterOutput = {
          hp:
            event.type === "hp_restored" ? target.hp + event.amount : target.hp,
          maxHp: target.maxHp,
          mp: target.mp,
          maxMp: target.maxMp,
          hunger: target.hunger,
          metadata: { tags: [...target.metadata.tags, "adapter"] },
        }
        return adapterOutput
      },
    })

    const result = boundaryService.apply(source, { type: "heal", value: 2 })
    source.metadata.tags[0] = "source-mutated"
    if (adapterOutput) {
      adapterOutput.metadata.tags[0] = "adapter-mutated"
    }

    expect(observedTarget).not.toBe(source)
    expect(Object.isFrozen(observedTarget)).toBe(true)
    expect(Object.isFrozen(observedTarget?.metadata)).toBe(true)
    expect(Object.isFrozen(observedTarget?.metadata.tags)).toBe(true)
    expect(result.target.metadata.tags).toEqual(["source", "adapter"])
    expect(Object.isFrozen(result.target)).toBe(true)
    expect(Object.isFrozen(result.target.metadata)).toBe(true)
    expect(Object.isFrozen(result.target.metadata.tags)).toBe(true)
    expectTypeOf(result.target).toEqualTypeOf<WizDeepReadonly<MutableTarget>>()

    const verifyTargetType = () => {
      // @ts-expect-error result targetのnested fieldはdeep readonly。
      result.target.metadata.tags[0] = "mutated"
      // @ts-expect-error result targetの配列はdeep readonly。
      result.target.metadata.tags.push("mutated")
    }
    void verifyTargetType
  })

  it("rejectionでもcaller-owned targetをそのまま公開しない", () => {
    const target = {
      hp: 1,
      maxHp: 10,
      mp: 0,
      maxMp: 0,
      hunger: 0,
      metadata: { value: 1 },
    }
    const rejectionService = new WizItemEffectService<typeof target>({
      inspect: (value) => ({
        hp: value.hp,
        maxHp: value.maxHp,
        mp: value.mp,
        maxMp: value.maxMp,
        hunger: value.hunger,
        maxHunger: 100,
        defeated: false,
      }),
      applyEvent: (value) => value,
    })

    const result = rejectionService.apply(target, undefined)
    target.metadata.value = 2

    expect(result.applied).toBe(false)
    expect(result.target).not.toBe(target)
    expect(result.target.metadata.value).toBe(1)
    expect(Object.isFrozen(result.target.metadata)).toBe(true)
  })
})
