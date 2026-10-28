import { describe, expect, it } from "vite-plus/test"
import { WizEffectSet } from "@/lib/wiz/core/domain/values/effect-set"
import { WizBattleActorState } from "@/lib/wiz/core/engine/battle/actor-state"
import { createBattleEffect } from "@/lib/wiz/core/engine/battle/create-battle-effect"
import { deriveEffectiveBattleState } from "@/lib/wiz/core/engine/battle/derive-effective-battle-state"
import { getBattleAbilityEffectId } from "@/lib/wiz/core/engine/battle/get-battle-ability-effect-id"
import { WIZ_BATTLE_EFFECT_TAG } from "@/lib/wiz/core/engine/battle/standard-tags"
import { createBattleAbility } from "@/lib/wiz/core/engine/battle/ability"

const baseState = () =>
  WizBattleActorState.create({
    attributes: { attack: 15, defense: 10, speed: 8 },
    resources: {
      health: { current: 100, maximum: 100 },
      mana: { current: 20, maximum: 20 },
    },
    custom: {},
  })

const effect = (instanceId: string, effectId: string, power: number) =>
  createBattleEffect({
    instanceId,
    effectId,
    source: { kind: "system", id: "effects-test" },
    name: instanceId,
    lifetime: { type: "turns", remaining: 2 },
    power,
  })

describe("deriveEffectiveBattleState", () => {
  it("applies active modifiers without changing the base state", () => {
    const base = baseState()
    const effects = WizEffectSet.create([
      effect("attack", "attackUp", 5),
      effect("defense", "defenseDown", 3),
      effect("speed", "speedUp", 4),
    ])

    const derived = deriveEffectiveBattleState(base, effects)

    expect(derived.attributes.toPlain()).toEqual({
      attack: 20,
      defense: 7,
      speed: 12,
    })
    expect(base.attributes.toPlain()).toEqual({
      attack: 15,
      defense: 10,
      speed: 8,
    })
  })

  it("uses a custom modifier supplied by content", () => {
    const custom = createBattleEffect({
      instanceId: "custom",
      effectId: "battleFocus",
      source: { kind: "ability", id: "focus" },
      name: "Focus",
      lifetime: { type: "turns", remaining: 2 },
      power: 999,
      custom: {
        statusModifier: { attack: 2, defense: 3, speed: -1 },
      },
    })

    const derived = deriveEffectiveBattleState(
      baseState(),
      WizEffectSet.create([custom])
    )

    expect(derived.attributes.toPlain()).toEqual({
      attack: 17,
      defense: 13,
      speed: 7,
    })
  })
})

describe("battle effect definition", () => {
  it("accepts arbitrary effect IDs and derives behavior from tags", () => {
    const effect = createBattleEffect({
      instanceId: "stasis-1",
      effectId: "chronomancer.stasis",
      source: { kind: "ability", id: "stasis" },
      name: "Stasis",
      lifetime: { type: "turns", remaining: 1 },
      tags: [WIZ_BATTLE_EFFECT_TAG.blocksAction],
    })

    expect(effect.effectId).toBe("chronomancer.stasis")
    expect(effect.tags).toContain(WIZ_BATTLE_EFFECT_TAG.blocksAction)
  })

  it("reads an open effect ID from an ability", () => {
    const ability = createBattleAbility({
      id: "stasis",
      name: "Stasis",
      tags: [],
      costs: { mana: 3 },
      effect: {
        type: "effect",
        side: "opponents",
        target: "single",
        element: "ice",
        power: 0,
        effectId: "chronomancer.stasis",
      },
      custom: {},
    })

    expect(getBattleAbilityEffectId(ability)).toBe("chronomancer.stasis")
  })
})
