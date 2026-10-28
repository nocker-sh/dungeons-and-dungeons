import { describe, expect, it } from "vite-plus/test"
import { WizBattleCharacter } from "@/lib/wiz/core/engine/battle/actors/character"
import { WizEffectSet } from "@/lib/wiz/core/domain/values/effect-set"
import { WizBattleActorState } from "@/lib/wiz/core/engine/battle/actor-state"
import { createBattleEffect } from "@/lib/wiz/core/engine/battle/create-battle-effect"

const createStatus = (hp = 100) =>
  WizBattleActorState.create({
    attributes: { attack: 20, defense: 15, speed: 10 },
    resources: {
      health: { current: hp, maximum: 100 },
      mana: { current: 50, maximum: 50 },
    },
    custom: {},
  })

const createCharacter = (hp = 100) =>
  new WizBattleCharacter({
    id: "char-1",
    name: "Hero",
    custom: {},
    status: createStatus(hp),
    effects: WizEffectSet.create(),
  })

const createEffect = (
  type: "poison" | "paralysis" | "defending" | "dead" | "fled" = "poison"
) =>
  createBattleEffect({
    instanceId: `effect-${type}`,
    effectId: type,
    source: { kind: "system", id: "character-test" },
    name: type,
    lifetime: { type: "turns", remaining: 3 },
  })

describe("withDamage", () => {
  it("reduces hp by damage amount", () => {
    const char = createCharacter()
    const damaged = char.withDamage(30)
    expect(damaged.status.resources.current("health")).toBe(70)
  })
})

describe("withHeal", () => {
  it("increases hp by heal amount", () => {
    const char = createCharacter(50)
    const healed = char.withHeal(30)
    expect(healed.status.resources.current("health")).toBe(80)
  })
})

describe("withEffect", () => {
  it("adds effect to character", () => {
    const char = createCharacter()
    const effect = createEffect()
    const withEffect = char.withEffect(effect)
    expect(withEffect.effects.effects).toHaveLength(1)
    expect(withEffect.effects.effects[0]).toBe(effect)
  })
})

describe("withoutEffect", () => {
  it("removes effect by id", () => {
    const char = createCharacter()
    const effect = createEffect()
    const withEffect = char.withEffect(effect)
    const withoutEffect = withEffect.withoutEffect(effect.instanceId)
    expect(withoutEffect.effects.effects).toHaveLength(0)
  })
})

describe("isAlive", () => {
  it("returns true when hp > 0", () => {
    const char = createCharacter(1)
    expect(char.isAlive()).toBe(true)
  })

  it("returns false when hp = 0", () => {
    const char = createCharacter(0)
    expect(char.isAlive()).toBe(false)
  })
})

describe("canAct", () => {
  it("returns true when alive and no preventing effects", () => {
    const char = createCharacter()
    expect(char.canAct()).toBe(true)
  })

  it("returns false when dead", () => {
    const char = createCharacter(0)
    expect(char.canAct()).toBe(false)
  })

  it("returns false when paralyzed", () => {
    const char = createCharacter()
    const paralyzed = char.withEffect(createEffect("paralysis"))
    expect(paralyzed.canAct()).toBe(false)
  })
})

describe("isDefending", () => {
  it("returns true when has defending status", () => {
    const char = createCharacter()
    const defending = char.withEffect(createEffect("defending"))
    expect(defending.isDefending()).toBe(true)
  })

  it("returns false when not defending", () => {
    const char = createCharacter()
    expect(char.isDefending()).toBe(false)
  })
})

describe("getDefenseMultiplier", () => {
  it("returns 2.0 when defending", () => {
    const char = createCharacter()
    const defending = char.withEffect(createEffect("defending"))
    expect(defending.getDefenseMultiplier()).toBe(2.0)
  })

  it("returns 1.0 when not defending", () => {
    const char = createCharacter()
    expect(char.getDefenseMultiplier()).toBe(1.0)
  })
})

describe("hasMp", () => {
  it("returns true when mp >= amount", () => {
    const char = createCharacter()
    expect(char.hasMp(50)).toBe(true)
  })

  it("returns false when mp < amount", () => {
    const char = createCharacter()
    expect(char.hasMp(51)).toBe(false)
  })
})

describe("withMpCost", () => {
  it("reduces mp by cost amount", () => {
    const char = createCharacter()
    const used = char.withMpCost(20)
    expect(used.status.resources.current("mana")).toBe(30)
  })
})

describe("isDead", () => {
  it("returns true when hp = 0", () => {
    const char = createCharacter(0)
    expect(char.isDead()).toBe(true)
  })

  it("returns false when hp > 0", () => {
    const char = createCharacter(1)
    expect(char.isDead()).toBe(false)
  })
})

describe("hasFled", () => {
  it("returns true when has fled status", () => {
    const char = createCharacter()
    const fled = char.withEffect(createEffect("fled"))
    expect(fled.hasFled()).toBe(true)
  })

  it("returns false when not fled", () => {
    const char = createCharacter()
    expect(char.hasFled()).toBe(false)
  })
})

describe("isInBattle", () => {
  it("returns true when alive and not fled", () => {
    const char = createCharacter()
    expect(char.isInBattle()).toBe(true)
  })

  it("returns false when dead", () => {
    const char = createCharacter(0)
    expect(char.isInBattle()).toBe(false)
  })

  it("returns false when fled", () => {
    const char = createCharacter()
    const fled = char.withEffect(createEffect("fled"))
    expect(fled.isInBattle()).toBe(false)
  })
})

describe("immutability", () => {
  it("is frozen", () => {
    const char = createCharacter()
    expect(Object.isFrozen(char)).toBe(true)
  })

  it("returns new instance on modification", () => {
    const original = createCharacter()
    const modified = original.withDamage(10)
    expect(modified).not.toBe(original)
  })

  it("does not retain a mutable effect array", () => {
    const input = [createEffect()]
    const effects = WizEffectSet.create(input)
    const character = new WizBattleCharacter({
      id: "char-1",
      name: "Hero",
      custom: {},
      status: createStatus(),
      effects,
    })

    input.length = 0

    expect(character.effects.effects).toHaveLength(1)
    expect(Object.isFrozen(character.effects)).toBe(true)
  })
})
