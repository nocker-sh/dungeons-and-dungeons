import { describe, expect, it } from "vite-plus/test"
import { createBattleAbility } from "@/lib/wiz/core/engine/battle/ability"
import { deriveEffectiveBattleState } from "@/lib/wiz/core/engine/battle/derive-effective-battle-state"
import { WizEngineBattleAbilityExecutor } from "@/lib/wiz/core/engine/battle/execution/ability-executor"
import { WizEngineBattleDamageResult } from "@/lib/wiz/core/engine/damage/damage-result"
import type { WizEngineBattleDamageCalculator } from "@/lib/wiz/core/engine/damage/default-damage-calculator"
import { wizMockWeakEnemyParty } from "@/lib/wiz/core/mocks/wiz-mock-weak-enemy-party"
import { wizMockSoloParty } from "@/lib/wiz/core/mocks/wiz-mock-solo-party"
import { wizMockBuffAbility } from "@/lib/wiz/core/mocks/wiz-mock-buff-ability"
import { wizMockFireballAbility } from "@/lib/wiz/core/mocks/wiz-mock-fireball-ability"
import { wizMockHealAbility } from "@/lib/wiz/core/mocks/wiz-mock-heal-ability"
import { wizMockPoisonAbility } from "@/lib/wiz/core/mocks/wiz-mock-poison-ability"

// モックダメージ計算機 (常にダメージを返す)
const mockDamageCalculator: WizEngineBattleDamageCalculator = {
  calculate: () =>
    new WizEngineBattleDamageResult({
      damage: 25,
      isCritical: false,
      isEvaded: false,
      isBlocked: false,
      elementalModifier: 1.0,
      hitCount: 1,
    }),
}

describe("execute (ダメージスキル)", () => {
  it("ダメージスキルを実行できる", () => {
    const executor = new WizEngineBattleAbilityExecutor({
      damageCalculator: mockDamageCalculator,
    })
    const party = wizMockSoloParty()
    const enemies = wizMockWeakEnemyParty()
    const skill = wizMockFireballAbility()
    const targetId = enemies.getAllAliveMonsters()[0].id

    const result = executor.execute(skill, "hero-1", [targetId], party, enemies)

    expect(result.success).toBe(true)
    expect(result.logs).toContainEqual({
      key: "BATTLE_ABILITY",
      actorId: "hero-1",
      abilityId: skill.id,
      targetId,
    })
    expect(result.logs).toContainEqual({
      key: "BATTLE_DAMAGE",
      targetId,
      damage: 25,
    })
    expect(
      result.logs.some((log) => "actorName" in log || "targetName" in log)
    ).toBe(false)
  })

  it("MPを消費する", () => {
    const executor = new WizEngineBattleAbilityExecutor({
      damageCalculator: mockDamageCalculator,
    })
    const party = wizMockSoloParty()
    const enemies = wizMockWeakEnemyParty()
    const skill = wizMockFireballAbility()
    const targetId = enemies.getAllAliveMonsters()[0].id
    const initialMp =
      party.getMemberById("hero-1")?.status.resources.current("mana") ?? 0

    const result = executor.execute(skill, "hero-1", [targetId], party, enemies)

    const newMp =
      result.party.getMemberById("hero-1")?.status.resources.current("mana") ??
      0
    expect(newMp).toBe(initialMp - (skill.costs.mana ?? 0))
  })

  it("複数ターゲットにダメージを与えられる", () => {
    const executor = new WizEngineBattleAbilityExecutor({
      damageCalculator: mockDamageCalculator,
    })
    const party = wizMockSoloParty()
    const enemies = wizMockWeakEnemyParty()
    const skill = wizMockFireballAbility()
    const targetIds = enemies.getAllAliveMonsters().map((m) => m.id)

    const result = executor.execute(skill, "hero-1", targetIds, party, enemies)

    const damageLogs = result.logs.filter((e) => e.key === "BATTLE_DAMAGE")
    expect(damageLogs.length).toBe(targetIds.length)
  })

  it("回避された場合はミスログを生成する", () => {
    const evadeCalculator: WizEngineBattleDamageCalculator = {
      calculate: () =>
        new WizEngineBattleDamageResult({
          damage: 0,
          isCritical: false,
          isEvaded: true,
          isBlocked: false,
          elementalModifier: 1.0,
          hitCount: 0,
        }),
    }
    const executor = new WizEngineBattleAbilityExecutor({
      damageCalculator: evadeCalculator,
    })
    const party = wizMockSoloParty()
    const enemies = wizMockWeakEnemyParty()
    const skill = wizMockFireballAbility()
    const targetId = enemies.getAllAliveMonsters()[0].id

    const result = executor.execute(skill, "hero-1", [targetId], party, enemies)

    expect(result.logs).toContainEqual({
      key: "BATTLE_MISS",
      actorId: "hero-1",
      targetId,
    })
  })

  it("クリティカルヒット時はクリティカルログを生成する", () => {
    const criticalCalculator: WizEngineBattleDamageCalculator = {
      calculate: () =>
        new WizEngineBattleDamageResult({
          damage: 50,
          isCritical: true,
          isEvaded: false,
          isBlocked: false,
          elementalModifier: 1.0,
          hitCount: 1,
        }),
    }
    const executor = new WizEngineBattleAbilityExecutor({
      damageCalculator: criticalCalculator,
    })
    const party = wizMockSoloParty()
    const enemies = wizMockWeakEnemyParty()
    const skill = wizMockFireballAbility()
    const targetId = enemies.getAllAliveMonsters()[0].id

    const result = executor.execute(skill, "hero-1", [targetId], party, enemies)

    expect(result.logs).toContainEqual({
      key: "BATTLE_CRITICAL",
      actorId: "hero-1",
      targetId,
      damage: 50,
    })
  })
})

describe("execute (回復スキル)", () => {
  it("味方を回復できる", () => {
    const executor = new WizEngineBattleAbilityExecutor()
    const party = wizMockSoloParty()
    const enemies = wizMockWeakEnemyParty()
    const skill = wizMockHealAbility() // power: 40

    // 先に50ダメージを与えておく (100 -> 50)
    const damagedParty = party.withDamageToMember("hero-1", 50)
    const initialHp =
      damagedParty
        .getMemberById("hero-1")
        ?.status.resources.current("health") ?? 0
    expect(initialHp).toBe(50)

    const result = executor.execute(
      skill,
      "hero-1",
      ["hero-1"],
      damagedParty,
      enemies
    )

    // 50 + 40 = 90
    const newHp =
      result.party
        .getMemberById("hero-1")
        ?.status.resources.current("health") ?? 0
    expect(newHp).toBe(90)
    expect(result.logs).toContainEqual({
      key: "BATTLE_HEAL",
      targetId: "hero-1",
      amount: skill.effect.power,
    })
  })
})

describe("execute (ステータス効果スキル)", () => {
  it("デバフスキルでステータス効果を付与できる", () => {
    const executor = new WizEngineBattleAbilityExecutor()
    const party = wizMockSoloParty()
    const enemies = wizMockWeakEnemyParty()
    const skill = wizMockPoisonAbility()
    const targetId = enemies.getAllAliveMonsters()[0].id

    const result = executor.execute(skill, "hero-1", [targetId], party, enemies)

    expect(result.success).toBe(true)
    expect(result.logs).toContainEqual({
      key: "BATTLE_EFFECT_APPLIED",
      targetId,
      effect: {
        source: "ability",
        abilityId: skill.id,
        effectType: "poison",
      },
    })
  })

  it("バフスキルは期限内だけ派生statusへ反映する", () => {
    const effectConfig = {
      defaultBuffTurns: 1,
      defaultDebuffTurns: 1,
      defaultEffectTurns: 1,
    }
    const executor = new WizEngineBattleAbilityExecutor({
      effectConfig,
    })
    effectConfig.defaultBuffTurns = 99
    const party = wizMockSoloParty()
    const enemies = wizMockWeakEnemyParty()
    const skill = wizMockBuffAbility()
    const baseAttack =
      party.getMemberById("hero-1")?.status.attributes.value("attack") ?? 0

    const result = executor.execute(skill, "hero-1", ["hero-1"], party, enemies)
    const buffedMember = result.party.getMemberById("hero-1")
    if (!buffedMember) throw new Error("Member not found")

    expect(result.success).toBe(true)
    expect(result.logs).toContainEqual({
      key: "BATTLE_EFFECT_APPLIED",
      targetId: "hero-1",
      effect: {
        source: "ability",
        abilityId: skill.id,
        effectType: "attackUp",
      },
    })
    expect(buffedMember.status.attributes.value("attack")).toBe(baseAttack)
    expect(
      deriveEffectiveBattleState(
        buffedMember.status,
        buffedMember.effects
      ).attributes.value("attack")
    ).toBe(baseAttack + skill.effect.power)

    const expiredMember = result.party.advanceEffects().getMemberById("hero-1")
    if (!expiredMember) throw new Error("Member not found")
    expect(
      deriveEffectiveBattleState(
        expiredMember.status,
        expiredMember.effects
      ).attributes.value("attack")
    ).toBe(baseAttack)
  })

  it("デバフスキルは対象の基礎statusを変更せず派生statusを下げる", () => {
    const executor = new WizEngineBattleAbilityExecutor()
    const party = wizMockSoloParty()
    const enemies = wizMockWeakEnemyParty()
    const ability = createBattleAbility({
      id: "skill-break",
      name: "Armor Break",
      description: "Lower defense",
      tags: [],
      costs: { mana: 2 },
      effect: {
        type: "effect",
        side: "opponents",
        target: "single",
        element: "physical",
        power: 4,
        effectId: "defenseDown",
        modifier: { defense: -4 },
      },
      custom: {},
    })
    const targetId = enemies.getAllAliveMonsters()[0].id
    const baseDefense =
      enemies.getMonsterById(targetId)?.status.attributes.value("defense") ?? 0

    const result = executor.execute(
      ability,
      "hero-1",
      [targetId],
      party,
      enemies
    )
    const affectedTarget = result.enemies.getMonsterById(targetId)
    if (!affectedTarget) throw new Error("Target not found")

    expect(affectedTarget.status.attributes.value("defense")).toBe(baseDefense)
    expect(
      deriveEffectiveBattleState(
        affectedTarget.status,
        affectedTarget.effects
      ).attributes.value("defense")
    ).toBe(Math.max(0, baseDefense - ability.effect.power))
  })
})

describe("execute (エッジケース)", () => {
  it("アクターが見つからない場合は失敗を返す", () => {
    const executor = new WizEngineBattleAbilityExecutor()
    const party = wizMockSoloParty()
    const enemies = wizMockWeakEnemyParty()
    const skill = wizMockFireballAbility()

    const result = executor.execute(
      skill,
      "non-existent",
      ["goblin-1"],
      party,
      enemies
    )

    expect(result.success).toBe(false)
    expect(result.logs.length).toBe(0)
  })

  it("MP不足の場合は状態を変更せず失敗を返す", () => {
    const executor = new WizEngineBattleAbilityExecutor({
      damageCalculator: mockDamageCalculator,
    })
    const party = wizMockSoloParty()
    const enemies = wizMockWeakEnemyParty()
    const ability = wizMockFireballAbility().withCosts({ mana: 31 })
    const targetId = enemies.getAllAliveMonsters()[0].id

    const result = executor.execute(
      ability,
      "hero-1",
      [targetId],
      party,
      enemies
    )

    expect(result.accepted).toBe(false)
    expect(result.party).toBe(party)
    expect(result.enemies).toBe(enemies)
    expect(result.logs).toHaveLength(0)
  })

  it("存在しないtarget IDを拒否し、不正なログを発行しない", () => {
    const executor = new WizEngineBattleAbilityExecutor({
      damageCalculator: mockDamageCalculator,
    })
    const party = wizMockSoloParty()
    const enemies = wizMockWeakEnemyParty()
    const skill = wizMockFireballAbility()

    const result = executor.execute(
      skill,
      "hero-1",
      ["non-existent"],
      party,
      enemies
    )

    expect(result.success).toBe(false)
    expect(result.accepted).toBe(false)
    expect(result.party).toBe(party)
    expect(result.enemies).toBe(enemies)
    expect(result.logs).toHaveLength(0)
  })
})
