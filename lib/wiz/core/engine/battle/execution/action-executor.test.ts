import { describe, expect, it } from "vite-plus/test"
import { WizEngineBattleContent } from "@/lib/wiz/core/engine/battle/content"
import { createBattleEffect } from "@/lib/wiz/core/engine/battle/create-battle-effect"
import { WizEngineBattleTurnActionExecutor } from "@/lib/wiz/core/engine/battle/execution/action-executor"
import { WizEngineBattleTurnAction } from "@/lib/wiz/core/engine/battle/turn-action"
import { WizEngineBattleActionBuilder } from "@/lib/wiz/core/engine/battle/turn-action-builder"
import { WizEngineBattleDamageResult } from "@/lib/wiz/core/engine/damage/damage-result"
import type { WizEngineBattleDamageCalculator } from "@/lib/wiz/core/engine/damage/default-damage-calculator"
import type { WizEngineBattleFleeCalculator } from "@/lib/wiz/core/engine/flee/default-flee-calculator"
import { WizEngineBattleFleeResult } from "@/lib/wiz/core/engine/flee/flee-result"
import { wizMockWeakEnemyParty } from "@/lib/wiz/core/mocks/wiz-mock-weak-enemy-party"
import { wizMockPotion } from "@/lib/wiz/core/mocks/wiz-mock-potion"
import { wizMockSoloParty } from "@/lib/wiz/core/mocks/wiz-mock-solo-party"
import { wizMockBuffAbility } from "@/lib/wiz/core/mocks/wiz-mock-buff-ability"
import { wizMockFireballAbility } from "@/lib/wiz/core/mocks/wiz-mock-fireball-ability"

const actionBuilder = new WizEngineBattleActionBuilder({
  nextId: () => "test-action",
})

const createContent = (input: {
  readonly abilities?: readonly ReturnType<typeof wizMockFireballAbility>[]
  readonly items?: readonly ReturnType<typeof wizMockPotion>[]
}) =>
  WizEngineBattleContent.fromArrays({
    abilities: input.abilities,
    items: input.items,
  })

// モックダメージ計算機
const mockDamageCalculator: WizEngineBattleDamageCalculator = {
  calculate: () =>
    new WizEngineBattleDamageResult({
      damage: 20,
      isCritical: false,
      isEvaded: false,
      isBlocked: false,
      elementalModifier: 1.0,
      hitCount: 1,
    }),
}

// 常に成功する逃走計算機
const mockSuccessFleeCalculator: WizEngineBattleFleeCalculator = {
  calculate: () =>
    new WizEngineBattleFleeResult({ success: true, canRetry: false }),
}

// 常に失敗する逃走計算機
const mockFailFleeCalculator: WizEngineBattleFleeCalculator = {
  calculate: () =>
    new WizEngineBattleFleeResult({ success: false, canRetry: true }),
}

describe("execute port", () => {
  it("executeをbindせず呼べ、実装を差し替えられない", () => {
    const executor = new WizEngineBattleTurnActionExecutor({
      damageCalculator: mockDamageCalculator,
    })
    const party = wizMockSoloParty()
    const enemies = wizMockWeakEnemyParty()
    const action = actionBuilder.attack(
      "hero-1",
      enemies.getAllAliveMonsters()[0].id
    )
    const { execute } = executor

    const result = execute(action, party, enemies)

    expect(result.success).toBe(true)
    expect(Object.isFrozen(executor)).toBe(true)
    expect(Object.isFrozen(WizEngineBattleTurnActionExecutor.prototype)).toBe(
      true
    )
    expect(Object.isFrozen(WizEngineBattleTurnActionExecutor)).toBe(true)

    const verifyReadonly = () => {
      const replacementExecute = executor.execute
      // @ts-expect-error executeはreadonly function property。
      executor.execute = replacementExecute
    }
    void verifyReadonly
  })

  it("注入portのcallbackを構築時に捕捉して外部差し替えを遮断する", () => {
    const damageCalculator = {
      calculate: () =>
        new WizEngineBattleDamageResult({
          damage: 20,
          isCritical: false,
          isEvaded: false,
          isBlocked: false,
          elementalModifier: 1,
          hitCount: 1,
        }),
    }
    const fleeCalculator = {
      calculate: () =>
        new WizEngineBattleFleeResult({ success: true, canRetry: false }),
    }
    const idGenerator = {
      next: () => "captured-id",
    }
    const executor = new WizEngineBattleTurnActionExecutor({
      damageCalculator,
      fleeCalculator,
      idGenerator,
    })
    const party = wizMockSoloParty()
    const enemies = wizMockWeakEnemyParty()
    const targetId = enemies.getAllAliveMonsters()[0].id
    const targetHp =
      enemies.getMonsterById(targetId)?.status.resources.current("health") ?? 0

    damageCalculator.calculate = () =>
      new WizEngineBattleDamageResult({
        damage: 999,
        isCritical: false,
        isEvaded: false,
        isBlocked: false,
        elementalModifier: 1,
        hitCount: 1,
      })
    fleeCalculator.calculate = () =>
      new WizEngineBattleFleeResult({ success: false, canRetry: true })
    idGenerator.next = () => "replaced-id"

    const attackResult = executor.execute(
      actionBuilder.attack("hero-1", targetId),
      party,
      enemies
    )
    const defendResult = executor.execute(
      actionBuilder.defend("hero-1"),
      party,
      enemies
    )
    const fleeResult = executor.fleeCalculator.calculate({
      partyAverageSpeed: 1,
      enemyAverageSpeed: 1,
      attemptCount: 0,
    })

    expect(
      attackResult.enemies
        .getMonsterById(targetId)
        ?.status.resources.current("health")
    ).toBe(targetHp - 20)
    expect(
      defendResult.party
        .getMemberById("hero-1")
        ?.effects.effects.find((effect) => effect.effectId === "defending")
        ?.instanceId
    ).toBe("defend-hero-1-captured-id")
    expect(fleeResult.success).toBe(true)
    expect(executor.damageCalculator).not.toBe(damageCalculator)
    expect(executor.fleeCalculator).not.toBe(fleeCalculator)
    expect(Object.isFrozen(executor.damageCalculator)).toBe(true)
    expect(Object.isFrozen(executor.fleeCalculator)).toBe(true)
  })
})

describe("execute (attack)", () => {
  it("通常攻撃を実行できる", () => {
    const executor = new WizEngineBattleTurnActionExecutor({
      damageCalculator: mockDamageCalculator,
    })
    const party = wizMockSoloParty()
    const enemies = wizMockWeakEnemyParty()
    const targetId = enemies.getAllAliveMonsters()[0].id

    const action = actionBuilder.attack("hero-1", targetId)

    const result = executor.execute(action, party, enemies)

    expect(result.success).toBe(true)
    expect(result.logs).toContainEqual({
      key: "BATTLE_ATTACK",
      actorId: "hero-1",
      targetId,
    })
    expect(result.logs).toContainEqual({
      key: "BATTLE_DAMAGE",
      targetId,
      damage: 20,
    })
    expect(
      result.logs.some((log) => "actorName" in log || "targetName" in log)
    ).toBe(false)
  })

  it("攻撃でダメージを与える", () => {
    const executor = new WizEngineBattleTurnActionExecutor({
      damageCalculator: mockDamageCalculator,
    })
    const party = wizMockSoloParty()
    const enemies = wizMockWeakEnemyParty()
    const targetId = enemies.getAllAliveMonsters()[0].id
    const initialHp =
      enemies.getMonsterById(targetId)?.status.resources.current("health") ?? 0

    const action = actionBuilder.attack("hero-1", targetId)

    const result = executor.execute(action, party, enemies)

    const newHp =
      result.enemies
        .getMonsterById(targetId)
        ?.status.resources.current("health") ?? 0
    expect(newHp).toBe(initialHp - 20)
  })

  it("一時status modifier込みの派生attack/defenseでダメージ計算する", () => {
    const damageCalculator: WizEngineBattleDamageCalculator = {
      calculate: ({ attacker, defender }) =>
        new WizEngineBattleDamageResult({
          damage: Math.max(
            0,
            attacker.attributes.value("attack") -
              defender.attributes.value("defense")
          ),
          isCritical: false,
          isEvaded: false,
          isBlocked: false,
          elementalModifier: 1,
          hitCount: 1,
        }),
    }
    const executor = new WizEngineBattleTurnActionExecutor({ damageCalculator })
    const party = wizMockSoloParty()
    const enemies = wizMockWeakEnemyParty()
    const targetId = enemies.getAllAliveMonsters()[0].id
    const actor = party.getMemberById("hero-1")
    const target = enemies.getMonsterById(targetId)
    if (!actor || !target) throw new Error("Expected battle actors")
    const attackEffect = createBattleEffect({
      instanceId: "attack-up",
      effectId: "attackUp",
      source: { kind: "system", id: "action-executor-test" },
      name: "Attack Up",
      lifetime: { type: "turns", remaining: 2 },
      power: 10,
    })
    const defenseEffect = createBattleEffect({
      instanceId: "defense-down",
      effectId: "defenseDown",
      source: { kind: "system", id: "action-executor-test" },
      name: "Defense Down",
      lifetime: { type: "turns", remaining: 2 },
      power: 4,
    })
    const affectedParty = party.withEffectToMember(actor.id, attackEffect)
    const affectedEnemies = enemies.withEffectToMonster(targetId, defenseEffect)
    const action = actionBuilder.attack(actor.id, targetId)

    const result = executor.execute(action, affectedParty, affectedEnemies)

    const expectedDamage =
      actor.status.attributes.value("attack") +
      10 -
      Math.max(0, target.status.attributes.value("defense") - 4)
    expect(
      result.enemies
        .getMonsterById(targetId)
        ?.status.resources.current("health")
    ).toBe(
      Math.max(0, target.status.resources.current("health") - expectedDamage)
    )
    expect(
      result.party.getMemberById(actor.id)?.status.attributes.value("attack")
    ).toBe(actor.status.attributes.value("attack"))
    expect(
      result.enemies
        .getMonsterById(targetId)
        ?.status.attributes.value("defense")
    ).toBe(target.status.attributes.value("defense"))
  })

  it("回避された場合はミスログが発生する", () => {
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
    const executor = new WizEngineBattleTurnActionExecutor({
      damageCalculator: evadeCalculator,
    })
    const party = wizMockSoloParty()
    const enemies = wizMockWeakEnemyParty()
    const targetId = enemies.getAllAliveMonsters()[0].id

    const action = actionBuilder.attack("hero-1", targetId)

    const result = executor.execute(action, party, enemies)

    expect(result.logs.some((e) => e.key === "BATTLE_MISS")).toBe(true)
  })

  it("クリティカルヒット時はクリティカルログが発生する", () => {
    const criticalCalculator: WizEngineBattleDamageCalculator = {
      calculate: () =>
        new WizEngineBattleDamageResult({
          damage: 40,
          isCritical: true,
          isEvaded: false,
          isBlocked: false,
          elementalModifier: 1.0,
          hitCount: 1,
        }),
    }
    const executor = new WizEngineBattleTurnActionExecutor({
      damageCalculator: criticalCalculator,
    })
    const party = wizMockSoloParty()
    const enemies = wizMockWeakEnemyParty()
    const targetId = enemies.getAllAliveMonsters()[0].id

    const action = actionBuilder.attack("hero-1", targetId)

    const result = executor.execute(action, party, enemies)

    expect(result.logs.some((e) => e.key === "BATTLE_CRITICAL")).toBe(true)
  })

  it("敵を倒すと死亡ログが発生する", () => {
    const lethalCalculator: WizEngineBattleDamageCalculator = {
      calculate: () =>
        new WizEngineBattleDamageResult({
          damage: 9999,
          isCritical: false,
          isEvaded: false,
          isBlocked: false,
          elementalModifier: 1.0,
          hitCount: 1,
        }),
    }
    const executor = new WizEngineBattleTurnActionExecutor({
      damageCalculator: lethalCalculator,
    })
    const party = wizMockSoloParty()
    const enemies = wizMockWeakEnemyParty()
    const targetId = enemies.getAllAliveMonsters()[0].id

    const action = actionBuilder.attack("hero-1", targetId)

    const result = executor.execute(action, party, enemies)

    expect(result.logs.some((e) => e.key === "BATTLE_DEATH")).toBe(true)
  })

  it("アクターが見つからない場合は失敗を返す", () => {
    const executor = new WizEngineBattleTurnActionExecutor()
    const party = wizMockSoloParty()
    const enemies = wizMockWeakEnemyParty()

    const action = actionBuilder.attack("non-existent", "goblin-1")

    const result = executor.execute(action, party, enemies)

    expect(result.success).toBe(false)
  })
})

describe("execute (skill)", () => {
  it("スキルを実行できる", () => {
    const executor = new WizEngineBattleTurnActionExecutor({
      damageCalculator: mockDamageCalculator,
    })
    const party = wizMockSoloParty()
    const enemies = wizMockWeakEnemyParty()
    const skill = wizMockFireballAbility()
    const targetId = enemies.getAllAliveMonsters()[0].id

    const action = actionBuilder.ability("hero-1", skill.id, [targetId])

    const result = executor.execute(action, party, enemies, {
      actorAbilityIds: [skill.id],
      content: createContent({ abilities: [skill] }),
    })

    expect(result.success).toBe(true)
    expect(result.accepted).toBe(true)
    expect(result.logs.some((e) => e.key === "BATTLE_ABILITY")).toBe(true)
  })

  it("effectConfigをskill executorへ伝播する", () => {
    const executor = new WizEngineBattleTurnActionExecutor({
      effectConfig: {
        defaultBuffTurns: 8,
        defaultDebuffTurns: 6,
        defaultEffectTurns: 4,
      },
    })
    const party = wizMockSoloParty()
    const enemies = wizMockWeakEnemyParty()
    const skill = wizMockBuffAbility()
    const action = actionBuilder.ability("hero-1", skill.id, ["hero-1"])

    const result = executor.execute(action, party, enemies, {
      actorAbilityIds: [skill.id],
      content: new WizEngineBattleContent({
        abilities: { [skill.id]: skill },
      }),
    })

    expect(result.accepted).toBe(true)
    expect(
      result.party.getMemberById("hero-1")?.effects.effects[0]?.lifetime
    ).toEqual({
      type: "turns",
      remaining: 8,
    })
  })

  it("contentに未登録のability IDを拒否する", () => {
    const executor = new WizEngineBattleTurnActionExecutor()
    const party = wizMockSoloParty()
    const enemies = wizMockWeakEnemyParty()
    const targetId = enemies.getAllAliveMonsters()[0].id
    const action = actionBuilder.ability("hero-1", "missing-skill", [targetId])

    const result = executor.execute(action, party, enemies, {
      actorAbilityIds: ["missing-skill"],
      content: new WizEngineBattleContent(),
    })

    expect(result.accepted).toBe(false)
    expect(result.party).toBe(party)
    expect(result.enemies).toBe(enemies)
  })

  it("未習得のスキルを拒否する", () => {
    const executor = new WizEngineBattleTurnActionExecutor({
      damageCalculator: mockDamageCalculator,
    })
    const party = wizMockSoloParty()
    const enemies = wizMockWeakEnemyParty()
    const skill = wizMockFireballAbility()
    const targetId = enemies.getAllAliveMonsters()[0].id
    const action = actionBuilder.ability("hero-1", skill.id, [targetId])

    const result = executor.execute(action, party, enemies, {
      actorAbilityIds: [],
      content: createContent({ abilities: [skill] }),
    })

    expect(result.accepted).toBe(false)
    expect(result.party).toBe(party)
    expect(result.enemies).toBe(enemies)
    expect(result.logs).toHaveLength(0)
  })

  it("MP不足のスキルを拒否する", () => {
    const executor = new WizEngineBattleTurnActionExecutor({
      damageCalculator: mockDamageCalculator,
    })
    const party = wizMockSoloParty()
    const enemies = wizMockWeakEnemyParty()
    const ability = wizMockFireballAbility().withCosts({ mana: 31 })
    const targetId = enemies.getAllAliveMonsters()[0].id
    const action = actionBuilder.ability("hero-1", ability.id, [targetId])

    const result = executor.execute(action, party, enemies, {
      actorAbilityIds: [ability.id],
      content: createContent({ abilities: [ability] }),
    })

    expect(result.accepted).toBe(false)
    expect(result.party).toBe(party)
    expect(result.enemies).toBe(enemies)
    expect(result.logs).toHaveLength(0)
  })

  it("ability IDがないcommandを生成できない", () => {
    expect(() =>
      WizEngineBattleTurnAction.fromUnknown({
        id: "test-action",
        type: "ability",
        actorId: "hero-1",
        targetIds: ["goblin-1"],
        abilityId: null,
        itemId: null,
      })
    ).toThrow()
  })
})

describe("execute (defend)", () => {
  it("防御を実行できる", () => {
    const executor = new WizEngineBattleTurnActionExecutor()
    const party = wizMockSoloParty()
    const enemies = wizMockWeakEnemyParty()

    const action = actionBuilder.defend("hero-1")

    const result = executor.execute(action, party, enemies)

    expect(result.success).toBe(true)
    expect(result.logs).toContainEqual({
      key: "BATTLE_DEFEND",
      actorId: "hero-1",
    })
    expect(result.logs).toContainEqual({
      key: "BATTLE_EFFECT_APPLIED",
      targetId: "hero-1",
      effect: {
        source: "system",
        effectType: "defending",
      },
    })
    expect(JSON.stringify(result.logs)).not.toContain("防御")
  })

  it("防御状態が付与される", () => {
    const executor = new WizEngineBattleTurnActionExecutor()
    const party = wizMockSoloParty()
    const enemies = wizMockWeakEnemyParty()

    const action = actionBuilder.defend("hero-1")

    const result = executor.execute(action, party, enemies)

    const member = result.party.getMemberById("hero-1")
    expect(member?.isDefending()).toBe(true)
  })
})

describe("execute (item)", () => {
  it("アイテムを使用できる", () => {
    const executor = new WizEngineBattleTurnActionExecutor()
    const party = wizMockSoloParty()
    const enemies = wizMockWeakEnemyParty()
    const item = wizMockPotion()

    const action = actionBuilder.item("hero-1", item.id, ["hero-1"])

    const result = executor.execute(action, party, enemies, {
      availableItemIds: [item.id],
      content: createContent({ items: [item] }),
    })

    expect(result.success).toBe(true)
    expect(result.accepted).toBe(true)
    expect(result.logs.some((e) => e.key === "BATTLE_ITEM")).toBe(true)
  })

  it("contentに未登録のitem IDを拒否する", () => {
    const executor = new WizEngineBattleTurnActionExecutor()
    const party = wizMockSoloParty()
    const enemies = wizMockWeakEnemyParty()
    const action = actionBuilder.item("hero-1", "missing-item", ["hero-1"])

    const result = executor.execute(action, party, enemies, {
      availableItemIds: ["missing-item"],
      content: new WizEngineBattleContent(),
    })

    expect(result.accepted).toBe(false)
    expect(result.party).toBe(party)
    expect(result.enemies).toBe(enemies)
  })

  it("未所持のアイテムを拒否する", () => {
    const executor = new WizEngineBattleTurnActionExecutor()
    const party = wizMockSoloParty()
    const enemies = wizMockWeakEnemyParty()
    const item = wizMockPotion()
    const action = actionBuilder.item("hero-1", item.id, ["hero-1"])

    const result = executor.execute(action, party, enemies, {
      availableItemIds: [],
      content: createContent({ items: [item] }),
    })

    expect(result.accepted).toBe(false)
    expect(result.party).toBe(party)
    expect(result.enemies).toBe(enemies)
    expect(result.logs).toHaveLength(0)
  })

  it("item IDがないcommandを生成できない", () => {
    expect(() =>
      WizEngineBattleTurnAction.fromUnknown({
        id: "test-action",
        type: "item",
        actorId: "hero-1",
        targetIds: ["hero-1"],
        abilityId: null,
        itemId: null,
      })
    ).toThrow()
  })
})

describe("execute (flee)", () => {
  it("逃走成功時は成功を返す", () => {
    const executor = new WizEngineBattleTurnActionExecutor({
      fleeCalculator: mockSuccessFleeCalculator,
    })
    const party = wizMockSoloParty()
    const enemies = wizMockWeakEnemyParty()

    const action = actionBuilder.flee("hero-1")

    const result = executor.execute(action, party, enemies)

    expect(result.success).toBe(true)
    expect(result.logs).toContainEqual({
      key: "BATTLE_FLEE",
      actorId: "hero-1",
    })
    expect(result.logs).toContainEqual({
      key: "BATTLE_FLEE_SUCCESS",
      actorId: "hero-1",
    })
  })

  it("逃走成功時はfledステータスが付与される", () => {
    const executor = new WizEngineBattleTurnActionExecutor({
      fleeCalculator: mockSuccessFleeCalculator,
    })
    const party = wizMockSoloParty()
    const enemies = wizMockWeakEnemyParty()

    const action = actionBuilder.flee("hero-1")

    const result = executor.execute(action, party, enemies)

    const member = result.party.getMemberById("hero-1")
    expect(member?.hasEffect("fled")).toBe(true)
  })

  it("逃走失敗時は失敗を返す", () => {
    const executor = new WizEngineBattleTurnActionExecutor({
      fleeCalculator: mockFailFleeCalculator,
    })
    const party = wizMockSoloParty()
    const enemies = wizMockWeakEnemyParty()

    const action = actionBuilder.flee("hero-1")

    const result = executor.execute(action, party, enemies)

    expect(result.success).toBe(false)
    expect(result.accepted).toBe(true)
    expect(result.logs).toContainEqual({
      key: "BATTLE_FLEE",
      actorId: "hero-1",
    })
    expect(result.logs).toContainEqual({
      key: "BATTLE_FLEE_FAILED",
      actorId: "hero-1",
    })
  })
})

describe("execute (target validation)", () => {
  it("通常攻撃で味方を対象にできない", () => {
    const executor = new WizEngineBattleTurnActionExecutor()
    const party = wizMockSoloParty()
    const enemies = wizMockWeakEnemyParty()
    const action = actionBuilder.attack("hero-1", "hero-1")

    const result = executor.execute(action, party, enemies)

    expect(result.accepted).toBe(false)
    expect(result.party).toBe(party)
    expect(result.enemies).toBe(enemies)
  })

  it("存在しない対象を拒否する", () => {
    const executor = new WizEngineBattleTurnActionExecutor()
    const party = wizMockSoloParty()
    const enemies = wizMockWeakEnemyParty()
    const action = actionBuilder.attack("hero-1", "missing")

    const result = executor.execute(action, party, enemies)

    expect(result.accepted).toBe(false)
  })
})

describe("execute (unknown)", () => {
  it("factoryを通らないactionをauthorityとして受け入れない", () => {
    const executor = new WizEngineBattleTurnActionExecutor()
    const party = wizMockSoloParty()
    const enemies = wizMockWeakEnemyParty()

    const forged = Object.freeze({
      id: "forged-action",
      type: "attack" as const,
      actorId: "hero-1",
      targetIds: [enemies.getAllAliveMonsters()[0].id],
      abilityId: null,
      itemId: null,
    }) as unknown as WizEngineBattleTurnAction

    expect(() => executor.execute(forged, party, enemies)).toThrow(
      "Battle action must be an authentic WizEngineBattleTurnAction"
    )
  })
})
