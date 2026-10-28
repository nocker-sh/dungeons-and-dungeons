import { describe, expect, it } from "vite-plus/test"
import { WizEngineBattleTurnAction } from "@/lib/wiz/core/engine/battle/turn-action"

describe("attack", () => {
  it("creates attack action with single target", () => {
    const action = WizEngineBattleTurnAction.attack("actor-1", "target-1", "attack-1")
    expect(action.type).toBe("attack")
    expect(action.actorId).toBe("actor-1")
    expect(action.targetIds).toEqual(["target-1"])
  })
})

describe("attackMultiple", () => {
  it("creates attack action with multiple targets", () => {
    const action = WizEngineBattleTurnAction.attackMultiple(
      "actor-1",
      ["target-1", "target-2"],
      "attack-1",
    )
    expect(action.type).toBe("attack")
    expect(action.targetIds).toEqual(["target-1", "target-2"])
  })
})

describe("ability", () => {
  it("creates skill action", () => {
    const action = WizEngineBattleTurnAction.ability("actor-1", "fireball", ["target-1"], "skill-1")
    expect(action.type).toBe("ability")
    expect(action.actorId).toBe("actor-1")
    expect(action.targetIds).toEqual(["target-1"])
    expect(action.abilityId).toBe("fireball")
  })
})

describe("item", () => {
  it("creates item action", () => {
    const action = WizEngineBattleTurnAction.item("actor-1", "potion", ["target-1"], "item-1")
    expect(action.type).toBe("item")
    expect(action.actorId).toBe("actor-1")
    expect(action.targetIds).toEqual(["target-1"])
    expect(action.itemId).toBe("potion")
  })
})

describe("defend", () => {
  it("creates defend action targeting self", () => {
    const action = WizEngineBattleTurnAction.defend("actor-1", "defend-1")
    expect(action.type).toBe("defend")
    expect(action.actorId).toBe("actor-1")
    expect(action.targetIds).toEqual(["actor-1"])
  })
})

describe("flee", () => {
  it("creates flee action", () => {
    const action = WizEngineBattleTurnAction.flee("actor-1", "flee-1")
    expect(action.type).toBe("flee")
    expect(action.actorId).toBe("actor-1")
  })
})

describe("fromUnknown", () => {
  it("不正なfieldとaction固有invariantを拒否する", () => {
    expect(() =>
      WizEngineBattleTurnAction.fromUnknown({
        id: " attack-1 ",
        type: "attack",
        actorId: "actor-1",
        targetIds: ["target-1"],
        abilityId: null,
        itemId: null,
      }),
    ).toThrow()
    expect(() =>
      WizEngineBattleTurnAction.fromUnknown({
        id: "defend-1",
        type: "defend",
        actorId: "actor-1",
        targetIds: ["target-1"],
        abilityId: null,
        itemId: null,
      }),
    ).toThrow()
  })

  it("prototypeだけを偽装したactionを認証しない", () => {
    const forged = Object.create(WizEngineBattleTurnAction.prototype)

    expect(() => WizEngineBattleTurnAction.assertAuthentic(forged)).toThrow(
      "Battle action must be an authentic WizEngineBattleTurnAction",
    )
  })
})

describe("immutability", () => {
  it("is frozen", () => {
    const action = WizEngineBattleTurnAction.attack("actor-1", "target-1", "attack-1")
    expect(Object.isFrozen(action)).toBe(true)
    expect(Object.isFrozen(WizEngineBattleTurnAction)).toBe(true)
    expect(Object.isFrozen(WizEngineBattleTurnAction.prototype)).toBe(true)
  })
})

describe("explicit ids", () => {
  it("preserves the caller-provided ID", () => {
    const action = WizEngineBattleTurnAction.attack("actor-1", "target-1", "command-1")
    expect(action.id).toBe("command-1")
  })
})
