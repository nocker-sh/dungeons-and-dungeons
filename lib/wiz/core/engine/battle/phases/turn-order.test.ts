import { describe, expect, it } from "vite-plus/test"
import { WizBattleCharacter } from "@/lib/wiz/core/engine/battle/actors/character"
import { WizEffectSet } from "@/lib/wiz/core/domain/values/effect-set"
import { WizBattleEnemyParty } from "@/lib/wiz/core/engine/battle/actors/enemy-party"
import { WizBattleMonster } from "@/lib/wiz/core/engine/battle/actors/monster"
import { WizBattleMonsterGroup } from "@/lib/wiz/core/engine/battle/actors/monster-group"
import { WizBattleParty } from "@/lib/wiz/core/engine/battle/actors/party"
import { WizBattleActorState } from "@/lib/wiz/core/engine/battle/actor-state"
import { WizEngineBattleContent } from "@/lib/wiz/core/engine/battle/content"
import { WizEngineBattleContext } from "@/lib/wiz/core/engine/battle/context"
import { createBattleEffect } from "@/lib/wiz/core/engine/battle/create-battle-effect"
import { WizEngineBattleExecutionResult } from "@/lib/wiz/core/engine/battle/execution/execution-result"
import { WizEngineBattlePhaseDefeat } from "@/lib/wiz/core/engine/battle/phases/defeat"
import { WizEngineBattleDefaultTurnOrderPolicy } from "@/lib/wiz/core/engine/battle/phases/turn-order-policy"
import { WizEngineBattlePhaseTurnOrder } from "@/lib/wiz/core/engine/battle/phases/turn-order"
import { WizEngineBattlePhaseVictory } from "@/lib/wiz/core/engine/battle/phases/victory"
import type { WizEngineBattleTurnAction } from "@/lib/wiz/core/engine/battle/turn-action"
import { WizEngineBattleActionBuilder } from "@/lib/wiz/core/engine/battle/turn-action-builder"

const actionBuilder = new WizEngineBattleActionBuilder({
  nextId: () => "test-action",
})
const turnOrderPolicy = new WizEngineBattleDefaultTurnOrderPolicy()

const createTurnOrderPhase = (context: WizEngineBattleContext) =>
  WizEngineBattlePhaseTurnOrder.create(context, turnOrderPolicy.order(context))

const createStatus = (
  overrides: Partial<{ hp: number; maxHp: number; speed: number }> = {}
) =>
  WizBattleActorState.create({
    attributes: { attack: 15, defense: 10, speed: overrides.speed ?? 10 },
    resources: {
      health: { current: overrides.hp ?? 100, maximum: overrides.maxHp ?? 100 },
      mana: { current: 30, maximum: 30 },
    },
    custom: {},
  })

const createCharacter = (id: string, name: string, speed: number) =>
  new WizBattleCharacter({
    id,
    name,
    custom: {},
    status: createStatus({ speed }),
    effects: WizEffectSet.create(),
  })

const createMonster = (
  id: string,
  name: string,
  speed: number,
  groupId: string
) =>
  new WizBattleMonster({
    id,
    name,
    custom: {},
    status: createStatus({ speed }),
    effects: WizEffectSet.create(),
    groupId,
  })

const createDeadMonster = (id: string, name: string, groupId: string) =>
  new WizBattleMonster({
    id,
    name,
    custom: {},
    status: createStatus({ hp: 0, speed: 5 }),
    effects: WizEffectSet.create(),
    groupId,
  })

const createContext = (party: WizBattleParty, enemies: WizBattleEnemyParty) =>
  new WizEngineBattleContext({
    id: "test-battle",
    turnNumber: 1,
    party,
    enemies,
    executedActions: [],
    initiative: "none",
  })

const createBasicSetup = () => {
  const hero = createCharacter("hero", "Hero", 12)
  const mage = createCharacter("mage", "Mage", 8)

  const goblin1 = createMonster("goblin-1", "Goblin 1", 6, "goblin")
  const goblin2 = createMonster("goblin-2", "Goblin 2", 6, "goblin")

  const party = new WizBattleParty({ id: "party", members: [hero, mage] })
  const enemies = new WizBattleEnemyParty({
    id: "enemies",
    groups: [
      new WizBattleMonsterGroup({
        id: "goblin",
        name: "Goblin",
        members: [goblin1, goblin2],
      }),
    ],
  })

  const context = createContext(party, enemies)
  return { hero, mage, goblin1, goblin2, party, enemies, context }
}

describe("WizEngineBattlePhaseTurnOrder", () => {
  it("標準turn-order policyをbind不要かつ再代入不可にする", () => {
    const { context } = createBasicSetup()
    const detachedOrder = turnOrderPolicy.order

    expect(Object.isFrozen(WizEngineBattleDefaultTurnOrderPolicy)).toBe(true)
    expect(
      Object.isFrozen(WizEngineBattleDefaultTurnOrderPolicy.prototype)
    ).toBe(true)
    expect(Object.isFrozen(turnOrderPolicy)).toBe(true)
    expect(
      Object.hasOwn(WizEngineBattleDefaultTurnOrderPolicy.prototype, "order")
    ).toBe(false)
    expect(Object.hasOwn(turnOrderPolicy, "order")).toBe(true)
    expect(detachedOrder(context)).toEqual([
      "hero",
      "mage",
      "goblin-1",
      "goblin-2",
    ])
    expect(Reflect.set(turnOrderPolicy, "order", () => [])).toBe(false)
  })

  describe("create", () => {
    it("ターンオーダーフェーズを生成できる", () => {
      const { context } = createBasicSetup()
      const phase = createTurnOrderPhase(context)

      expect(phase.phase).toBe("turnOrder")
      expect(phase.context).toBe(context)
      expect(phase.currentActorIndex).toBe(0)
      expect(phase.turnOrder.length).toBe(4)
    })

    it("turnOrder要素をdefensive copyしてdeep freezeする", () => {
      const { context } = createBasicSetup()
      const source = [{ id: "hero", name: "Hero", speed: 12, isEnemy: false }]
      const phase = new WizEngineBattlePhaseTurnOrder({
        context,
        turnOrder: source,
        currentActorIndex: 0,
      })

      source[0]!.name = "Changed"
      source.push({ id: "mage", name: "Mage", speed: 8, isEnemy: false })

      expect(phase.turnOrder).toEqual([
        { id: "hero", name: "Hero", speed: 12, isEnemy: false },
      ])
      expect(Object.isFrozen(phase.turnOrder)).toBe(true)
      expect(Object.isFrozen(phase.turnOrder[0])).toBe(true)
      expect(Object.isFrozen(phase.getRemainingTurnOrder())).toBe(true)
    })
  })

  describe("turnOrder", () => {
    it("速度順に並んでいる (高い順)", () => {
      const { context } = createBasicSetup()
      const phase = createTurnOrderPhase(context)

      const speeds = phase.turnOrder.map((a) => a.speed)
      for (let i = 0; i < speeds.length - 1; i++) {
        expect(speeds[i]).toBeGreaterThanOrEqual(speeds[i + 1])
      }
    })

    it("味方と敵が混在してソートされる", () => {
      const { context } = createBasicSetup()
      const phase = createTurnOrderPhase(context)

      // hero(speed=12) > mage(speed=8) > goblin1(speed=6) = goblin2(speed=6)
      expect(phase.turnOrder[0].id).toBe("hero")
      expect(phase.turnOrder[0].isEnemy).toBe(false)
      expect(phase.turnOrder[1].id).toBe("mage")
      expect(phase.turnOrder[1].isEnemy).toBe(false)
      expect(phase.turnOrder[2].isEnemy).toBe(true)
      expect(phase.turnOrder[3].isEnemy).toBe(true)
    })

    it("一時speed modifier込みの派生速度で並べる", () => {
      const { party, enemies } = createBasicSetup()
      const slowEffect = createBattleEffect({
        instanceId: "hero-slow",
        effectId: "speedDown",
        source: { kind: "system", id: "turn-order-test" },
        name: "Slow",
        lifetime: { type: "turns", remaining: 2 },
        power: 10,
      })
      const affectedParty = party.withEffectToMember("hero", slowEffect)
      const phase = createTurnOrderPhase(createContext(affectedParty, enemies))

      expect(phase.turnOrder[0].id).toBe("mage")
      expect(phase.turnOrder.at(-1)?.id).toBe("hero")
      expect(phase.turnOrder.at(-1)?.speed).toBe(2)
    })
  })

  describe("getCurrentActor", () => {
    it("現在のアクターを取得できる", () => {
      const { context } = createBasicSetup()
      const phase = createTurnOrderPhase(context)

      const actor = phase.getCurrentActor()
      expect(actor).not.toBeNull()
      expect(actor!.id).toBe("hero")
      expect(actor!.speed).toBe(12)
    })

    it("全アクターが行動済みの場合は null を返す", () => {
      const { context } = createBasicSetup()
      const phase = createTurnOrderPhase(context)

      // 全員スキップ
      let current = phase
      for (let i = 0; i < phase.turnOrder.length; i++) {
        current = current.skipCurrentActor()
      }

      expect(current.getCurrentActor()).toBeNull()
    })
  })

  describe("executeAction", () => {
    it("アクションを実行し次のアクターに進む", () => {
      const { context } = createBasicSetup()
      const phase = createTurnOrderPhase(context)

      const action = actionBuilder.attack("hero", "goblin-1")
      const executor = {
        execute: (
          _action: WizEngineBattleTurnAction,
          party: WizBattleParty,
          enemies: WizBattleEnemyParty
        ) =>
          WizEngineBattleExecutionResult.accept({
            party,
            enemies,
            logs: [{ key: "WORLD_STARTED" as const }],
            success: true,
          }),
      }

      const result = phase.executeAction(action, executor)

      expect(result.accepted).toBe(true)
      expect(result.logs.length).toBe(1)
      expect(result.scene).toBeInstanceOf(WizEngineBattlePhaseTurnOrder)
      if (result.scene instanceof WizEngineBattlePhaseTurnOrder) {
        expect(result.scene.currentActorIndex).toBeGreaterThan(0)
      }
    })

    it("敵が全滅したら Victory フェーズに遷移する", () => {
      const hero = createCharacter("hero", "Hero", 12)
      const goblin = createMonster("goblin-1", "Goblin", 6, "goblin")

      const party = new WizBattleParty({ id: "party", members: [hero] })
      const enemies = new WizBattleEnemyParty({
        id: "enemies",
        groups: [
          new WizBattleMonsterGroup({
            id: "goblin",
            name: "Goblin",
            members: [goblin],
          }),
        ],
      })

      const context = createContext(party, enemies)
      const phase = createTurnOrderPhase(context)

      const action = actionBuilder.attack("hero", "goblin-1")

      // 敵を倒すエグゼキューター
      const executor = {
        execute: (
          _action: WizEngineBattleTurnAction,
          currentParty: WizBattleParty,
          currentEnemies: WizBattleEnemyParty
        ) =>
          WizEngineBattleExecutionResult.accept({
            party: currentParty,
            enemies: currentEnemies.withDamageToMonster("goblin-1", 9999),
            logs: [{ key: "WORLD_STARTED" as const }],
            success: true,
          }),
      }

      const result = phase.executeAction(action, executor)
      expect(result.scene).toBeInstanceOf(WizEngineBattlePhaseVictory)
    })

    it("味方が全滅したら Defeat フェーズに遷移する", () => {
      const hero = createCharacter("hero", "Hero", 12)
      const goblin = createMonster("goblin-1", "Goblin", 6, "goblin")

      const party = new WizBattleParty({ id: "party", members: [hero] })
      const enemies = new WizBattleEnemyParty({
        id: "enemies",
        groups: [
          new WizBattleMonsterGroup({
            id: "goblin",
            name: "Goblin",
            members: [goblin],
          }),
        ],
      })

      const context = createContext(party, enemies)
      const phase = createTurnOrderPhase(context)

      const action = actionBuilder.attack("hero", "goblin-1")

      // 味方を倒すエグゼキューター
      const executor = {
        execute: (
          _action: WizEngineBattleTurnAction,
          currentParty: WizBattleParty,
          currentEnemies: WizBattleEnemyParty
        ) =>
          WizEngineBattleExecutionResult.accept({
            party: currentParty.withDamageToMember("hero", 9999),
            enemies: currentEnemies,
            logs: [{ key: "WORLD_STARTED" as const }],
            success: true,
          }),
      }

      const result = phase.executeAction(action, executor)
      expect(result.scene).toBeInstanceOf(WizEngineBattlePhaseDefeat)
    })

    it("現在のアクター以外のアクションを拒否し、ターンを進めない", () => {
      const { context } = createBasicSetup()
      const phase = createTurnOrderPhase(context)
      const action = actionBuilder.attack("mage", "goblin-1")
      const executor = {
        execute: (
          _action: WizEngineBattleTurnAction,
          party: WizBattleParty,
          enemies: WizBattleEnemyParty
        ) =>
          WizEngineBattleExecutionResult.accept({
            party,
            enemies,
            logs: [{ key: "WORLD_STARTED" as const }],
            success: true,
          }),
      }

      const result = phase.executeAction(action, executor)

      expect(result.accepted).toBe(false)
      expect(result.scene).toBe(phase)
      expect(result.logs).toHaveLength(0)
      expect(phase.context.executedActions).toHaveLength(0)
      expect(phase.currentActorIndex).toBe(0)
    })

    it("executorが拒否したアクションでは状態とターンを進めない", () => {
      const { context } = createBasicSetup()
      const phase = createTurnOrderPhase(context)
      const action = actionBuilder.attack("hero", "goblin-1")
      const executor = {
        execute: (
          _action: WizEngineBattleTurnAction,
          party: WizBattleParty,
          enemies: WizBattleEnemyParty
        ) =>
          WizEngineBattleExecutionResult.reject({
            party: party.withDamageToMember("hero", 50),
            enemies,
            reason: "CUSTOM_EXECUTOR_REJECTION",
          }),
      }

      const result = phase.executeAction(action, executor)

      expect(result.accepted).toBe(false)
      expect(result.reason).toBe("CUSTOM_EXECUTOR_REJECTION")
      expect(result.scene).toBe(phase)
      expect(result.logs).toHaveLength(0)
      expect(
        phase.context.party
          .getMemberById("hero")
          ?.status.resources.current("health")
      ).toBe(100)
      expect(phase.currentActorIndex).toBe(0)
    })

    it("raw executor resultをauthorityとして受け入れない", () => {
      const { context } = createBasicSetup()
      const phase = createTurnOrderPhase(context)
      const action = actionBuilder.attack("hero", "goblin-1")
      const executor = {
        execute: () =>
          Object.freeze({
            party: context.party,
            enemies: context.enemies,
            logs: [],
            success: true,
            accepted: true,
          }) as unknown as WizEngineBattleExecutionResult,
      }

      expect(() => phase.executeAction(action, executor)).toThrow(
        "Battle executor must return an authentic WizEngineBattleExecutionResult"
      )
    })

    it("custom AIが返したplain actionをturn-order境界で拒否する", () => {
      const { context } = createBasicSetup()
      const phase = createTurnOrderPhase(context)
      const forged = Object.freeze({
        id: "forged-action",
        type: "attack" as const,
        actorId: "hero",
        targetIds: ["goblin-1"],
        abilityId: null,
        itemId: null,
      }) as unknown as WizEngineBattleTurnAction
      const executor = {
        execute: () => {
          throw new Error("must not execute")
        },
      }

      expect(() => phase.executeAction(forged, executor)).toThrow(
        "Battle action must be an authentic WizEngineBattleTurnAction"
      )
    })

    it("呼び出しoptionsのcontentをexecutorへ引き渡す", () => {
      const { context } = createBasicSetup()
      const authoritativeContent = new WizEngineBattleContent()
      const phase = createTurnOrderPhase(context)
      const action = actionBuilder.attack("hero", "goblin-1")
      const executor = {
        execute: (
          _action: WizEngineBattleTurnAction,
          party: WizBattleParty,
          enemies: WizBattleEnemyParty,
          options?: { content?: unknown }
        ) =>
          options?.content === authoritativeContent
            ? WizEngineBattleExecutionResult.accept({
                party,
                enemies,
                logs: [],
                success: true,
              })
            : WizEngineBattleExecutionResult.reject({
                party,
                enemies,
                reason: "BATTLE_ACTION_REJECTED",
              }),
      }

      const result = phase.executeAction(action, executor, {
        content: authoritativeContent,
      })

      expect(result.accepted).toBe(true)
    })
  })

  describe("isTurnComplete", () => {
    it("全アクターが行動済みなら true を返す", () => {
      const { context } = createBasicSetup()
      const phase = createTurnOrderPhase(context)

      let current = phase
      for (let i = 0; i < phase.turnOrder.length; i++) {
        current = current.skipCurrentActor()
      }

      expect(current.isTurnComplete()).toBe(true)
    })

    it("まだ行動していないアクターがいれば false を返す", () => {
      const { context } = createBasicSetup()
      const phase = createTurnOrderPhase(context)

      expect(phase.isTurnComplete()).toBe(false)
    })
  })

  describe("skipCurrentActor", () => {
    it("次のアクターに進む", () => {
      const { context } = createBasicSetup()
      const phase = createTurnOrderPhase(context)

      expect(phase.currentActorIndex).toBe(0)
      expect(phase.getCurrentActor()!.id).toBe("hero")

      const next = phase.skipCurrentActor()
      expect(next.currentActorIndex).toBe(1)
      expect(next.getCurrentActor()!.id).toBe("mage")
    })

    it("turnOrder は変わらない", () => {
      const { context } = createBasicSetup()
      const phase = createTurnOrderPhase(context)

      const next = phase.skipCurrentActor()
      expect(next.turnOrder).toEqual(phase.turnOrder)
    })
  })

  describe("isCurrentActorEnemy", () => {
    it("味方アクターの場合は false を返す", () => {
      const { context } = createBasicSetup()
      const phase = createTurnOrderPhase(context)

      expect(phase.isCurrentActorEnemy()).toBe(false)
    })

    it("敵アクターの場合は true を返す", () => {
      const { context } = createBasicSetup()
      const phase = createTurnOrderPhase(context)

      // hero(12) -> mage(8) -> goblin(6) -> goblin(6)
      const atEnemy = phase.skipCurrentActor().skipCurrentActor()
      expect(atEnemy.isCurrentActorEnemy()).toBe(true)
    })
  })

  describe("getRemainingActorCount", () => {
    it("残りのアクター数を返す", () => {
      const { context } = createBasicSetup()
      const phase = createTurnOrderPhase(context)

      expect(phase.getRemainingActorCount()).toBe(4)

      const skipped = phase.skipCurrentActor()
      expect(skipped.getRemainingActorCount()).toBe(3)
    })

    it("全員行動済みの場合は 0 を返す", () => {
      const { context } = createBasicSetup()
      let phase = createTurnOrderPhase(context)
      for (let i = 0; i < phase.turnOrder.length; i++) {
        phase = phase.skipCurrentActor()
      }

      expect(phase.getRemainingActorCount()).toBe(0)
    })
  })

  describe("getRemainingTurnOrder", () => {
    it("残りのターンオーダーを返す", () => {
      const { context } = createBasicSetup()
      const phase = createTurnOrderPhase(context)

      const remaining = phase.getRemainingTurnOrder()
      expect(remaining.length).toBe(4)

      const afterSkip = phase.skipCurrentActor().getRemainingTurnOrder()
      expect(afterSkip.length).toBe(3)
      expect(afterSkip[0].id).toBe("mage")
    })
  })

  describe("getCurrentActorEntity", () => {
    it("現在のアクターのエンティティを取得できる", () => {
      const { context } = createBasicSetup()
      const phase = createTurnOrderPhase(context)

      const entity = phase.getCurrentActorEntity()
      expect(entity).not.toBeNull()
      expect(entity!.id).toBe("hero")
      expect(entity!.name).toBe("Hero")
    })

    it("全員行動済みの場合は null を返す", () => {
      const { context } = createBasicSetup()
      let phase = createTurnOrderPhase(context)
      for (let i = 0; i < phase.turnOrder.length; i++) {
        phase = phase.skipCurrentActor()
      }

      expect(phase.getCurrentActorEntity()).toBeNull()
    })
  })

  describe("checkBattleEnd", () => {
    it("戦闘が続いている場合は自身を返す", () => {
      const { context } = createBasicSetup()
      const phase = createTurnOrderPhase(context)

      const result = phase.checkBattleEnd()
      expect(result).toBe(phase)
    })

    it("敵が全滅の場合は Victory を返す", () => {
      const hero = createCharacter("hero", "Hero", 12)
      const deadGoblin = createDeadMonster("goblin-1", "Goblin", "goblin")

      const party = new WizBattleParty({ id: "party", members: [hero] })
      const enemies = new WizBattleEnemyParty({
        id: "enemies",
        groups: [
          new WizBattleMonsterGroup({
            id: "goblin",
            name: "Goblin",
            members: [deadGoblin],
          }),
        ],
      })

      const context = createContext(party, enemies)
      const phase = createTurnOrderPhase(context)

      const result = phase.checkBattleEnd()
      expect(result).toBeInstanceOf(WizEngineBattlePhaseVictory)
    })

    it("味方が全滅の場合は Defeat を返す", () => {
      const deadHero = new WizBattleCharacter({
        id: "hero",
        name: "Hero",
        custom: {},
        status: createStatus({ hp: 0, speed: 12 }),
        effects: WizEffectSet.create(),
      })
      const goblin = createMonster("goblin-1", "Goblin", 6, "goblin")

      const party = new WizBattleParty({ id: "party", members: [deadHero] })
      const enemies = new WizBattleEnemyParty({
        id: "enemies",
        groups: [
          new WizBattleMonsterGroup({
            id: "goblin",
            name: "Goblin",
            members: [goblin],
          }),
        ],
      })

      const context = createContext(party, enemies)
      const phase = createTurnOrderPhase(context)

      const result = phase.checkBattleEnd()
      expect(result).toBeInstanceOf(WizEngineBattlePhaseDefeat)
    })
  })
})
