import { describe, expect, it } from "vite-plus/test"
import { WizBattleLog } from "@/lib/wiz/core/types/wiz-log-message"
import { zWizLogMessage } from "@/lib/wiz/core/vault/schema"

describe("battle effect reference builders", () => {
  it("保存可能なreadonly意味参照を作る", () => {
    const status = WizBattleLog.effect("defending")
    const skill = WizBattleLog.abilityEffect("skill-guard", "defenseUp")
    const item = WizBattleLog.itemEffect("item-herb", "attackUp")
    const one = WizBattleLog.removeEffect(skill)
    const all = WizBattleLog.removeAllEffects()

    expect(status).toEqual({ source: "system", effectType: "defending" })
    expect(skill).toEqual({
      source: "ability",
      abilityId: "skill-guard",
      effectType: "defenseUp",
    })
    expect(item).toEqual({
      source: "item",
      itemId: "item-herb",
      effectType: "attackUp",
    })
    expect(one).toEqual({ scope: "effect", effect: skill })
    expect(all).toEqual({ scope: "all" })
    expect(Object.isFrozen(status)).toBe(true)
    expect(Object.isFrozen(skill)).toBe(true)
    expect(Object.isFrozen(item)).toBe(true)
    expect(Object.isFrozen(one)).toBe(true)
    expect(Object.isFrozen(one.scope === "effect" ? one.effect : undefined)).toBe(true)
    expect(Object.isFrozen(all)).toBe(true)
  })

  it("構造的に渡されたeffectを検証してcanonical valueだけを所有する", () => {
    const source = {
      source: "ability" as const,
      abilityId: "skill-guard",
      effectType: "defenseUp",
      presentationName: "Defense Up",
    }
    const removal = WizBattleLog.removeEffect(source)
    const log = WizBattleLog.effectApplied("hero", source)

    source.abilityId = "mutated"

    expect(removal).toEqual({
      scope: "effect",
      effect: {
        source: "ability",
        abilityId: "skill-guard",
        effectType: "defenseUp",
      },
    })
    expect(log.effect).toEqual({
      source: "ability",
      abilityId: "skill-guard",
      effectType: "defenseUp",
    })
    expect(() =>
      WizBattleLog.removeEffect({
        source: "item",
        itemId: " item-herb ",
        effectType: "attackUp",
      }),
    ).toThrow(TypeError)
    expect(() =>
      WizBattleLog.effectApplied("hero", { source: "unknown" } as unknown as Parameters<
        typeof WizBattleLog.effectApplied
      >[1]),
    ).toThrow(TypeError)
  })
})

describe("zWizLogMessage battle effect validation", () => {
  it("canonicalな付与・解除ログを検証する", () => {
    expect(
      zWizLogMessage.parse({
        key: "BATTLE_EFFECT_APPLIED",
        targetId: "hero",
        effect: {
          source: "ability",
          abilityId: "skill-guard",
          effectType: "defenseUp",
        },
      }),
    ).toEqual({
      key: "BATTLE_EFFECT_APPLIED",
      targetId: "hero",
      effect: {
        source: "ability",
        abilityId: "skill-guard",
        effectType: "defenseUp",
      },
    })
    expect(
      zWizLogMessage.parse({
        key: "BATTLE_EFFECTS_REMOVED",
        targetId: "hero",
        removal: { scope: "all" },
      }),
    ).toEqual({
      key: "BATTLE_EFFECTS_REMOVED",
      targetId: "hero",
      removal: { scope: "all" },
    })
  })

  it("canonicalログへ表示名を混入できない", () => {
    expect(
      zWizLogMessage.safeParse({
        key: "BATTLE_EFFECT_APPLIED",
        targetId: "hero",
        effect: {
          source: "system",
          effectType: "defending",
          effectName: "防御",
        },
      }).success,
    ).toBe(false)
  })
})

describe("WizBattleLog", () => {
  it("static factory自体を生成・差し替えできない", () => {
    expect(() => Reflect.construct(WizBattleLog, [])).toThrow(TypeError)
    expect(Object.isFrozen(WizBattleLog)).toBe(true)
    expect(Object.isFrozen(WizBattleLog.prototype)).toBe(true)
  })

  it("表示名を含まないimmutableなcanonicalログを生成する", () => {
    const attack = WizBattleLog.attack("hero", "goblin_0")
    const skill = WizBattleLog.ability("hero", "fireball", "goblin_0")
    const item = WizBattleLog.item("hero", "potion", "hero")

    expect(attack).toEqual({
      key: "BATTLE_ATTACK",
      actorId: "hero",
      targetId: "goblin_0",
    })
    expect(skill).toEqual({
      key: "BATTLE_ABILITY",
      actorId: "hero",
      abilityId: "fireball",
      targetId: "goblin_0",
    })
    expect(item).toEqual({
      key: "BATTLE_ITEM",
      actorId: "hero",
      itemId: "potion",
      targetId: "hero",
    })
    expect(Object.isFrozen(attack)).toBe(true)
    expect(Object.isFrozen(skill)).toBe(true)
    expect(Object.isFrozen(item)).toBe(true)
  })

  it("空または前後空白を含むsemantic IDを拒否する", () => {
    expect(() => WizBattleLog.attack("", "goblin_0")).toThrow("actorId")
    expect(() => WizBattleLog.attack("hero", " goblin_0")).toThrow("targetId")
    expect(() => WizBattleLog.ability("hero", " ", "goblin_0")).toThrow("abilityId")
    expect(() => WizBattleLog.item("hero", "potion ", "hero")).toThrow("itemId")
  })

  it("非有限・負数の戦闘量を拒否する", () => {
    expect(() => WizBattleLog.damage("goblin_0", Number.NaN)).toThrow("damage")
    expect(() => WizBattleLog.heal("hero", -1)).toThrow("amount")
  })
})

describe("zWizLogMessage battle ID validation", () => {
  it("canonical ID payloadを検証する", () => {
    expect(
      zWizLogMessage.parse({
        key: "BATTLE_ABILITY",
        actorId: "hero",
        abilityId: "fireball",
        targetId: "goblin_0",
      }),
    ).toEqual({
      key: "BATTLE_ABILITY",
      actorId: "hero",
      abilityId: "fireball",
      targetId: "goblin_0",
    })
  })

  it("canonicalログへの表示名混入と不正IDを拒否する", () => {
    expect(
      zWizLogMessage.safeParse({
        key: "BATTLE_ATTACK",
        actorId: "hero",
        targetId: "goblin_0",
        actorName: "勇者",
      }).success,
    ).toBe(false)
    expect(
      zWizLogMessage.safeParse({
        key: "BATTLE_ITEM",
        actorId: "hero",
        itemId: " ",
        targetId: "hero",
      }).success,
    ).toBe(false)
  })
})

describe("zWizLogMessage affinity level validation", () => {
  it("作品固有のsemantic level IDを保存する", () => {
    expect(
      zWizLogMessage.parse({
        key: "AFFINITY_LEVEL_CHANGED",
        npcId: "guide",
        level: "trusted",
      }),
    ).toEqual({
      key: "AFFINITY_LEVEL_CHANGED",
      npcId: "guide",
      level: "trusted",
    })
  })

  it("空または前後空白を含むlevel IDを拒否する", () => {
    expect(
      zWizLogMessage.safeParse({
        key: "AFFINITY_LEVEL_CHANGED",
        npcId: "guide",
        level: " ",
      }).success,
    ).toBe(false)
    expect(
      zWizLogMessage.safeParse({
        key: "AFFINITY_LEVEL_CHANGED",
        npcId: "guide",
        level: " trusted ",
      }).success,
    ).toBe(false)
  })
})
