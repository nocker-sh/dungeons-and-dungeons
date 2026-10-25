import { describe, expect, it } from "vite-plus/test"
import { WizEngineBattleContent } from "@/lib/wiz/core/engine/battle/content"
import { WizEngineBattleExecutionResult } from "@/lib/wiz/core/engine/battle/execution/execution-result"
import { WizEngineBattleActionBuilder } from "@/lib/wiz/core/engine/battle/turn-action-builder"
import { WizEngineBattleDefaultRewardCalculator } from "@/lib/wiz/core/engine/reward/default-reward-calculator"
import { wizMockWeakEnemyParty } from "@/lib/wiz/core/mocks/mock-enemy-party"
import { wizMockSoloParty } from "@/lib/wiz/core/mocks/mock-party"
import { wizMockFireballAbility } from "@/lib/wiz/core/mocks/mock-ability"
import { WizSceneBattleService } from "@/lib/wiz/core/runtime/scenes/battle/wiz-battle-service"

const service = new WizSceneBattleService({
  rewardCalculator: new WizEngineBattleDefaultRewardCalculator(),
})
const actionBuilder = new WizEngineBattleActionBuilder({ nextId: () => "test-action" })

describe("WizSceneBattleService", () => {
  describe("startBattle", () => {
    it("encounter フェーズを生成する", () => {
      const party = wizMockSoloParty()
      const enemies = wizMockWeakEnemyParty()

      const result = service.startBattle(party, enemies)

      expect(result.encounterScene.phase).toBe("encounter")
      expect(result.encounterScene.context.party).toBe(party)
      expect(result.encounterScene.context.enemies).toBe(enemies)
    })
  })

  describe("createTurnOrderScene", () => {
    it("turnOrder フェーズを生成する", () => {
      const party = wizMockSoloParty()
      const enemies = wizMockWeakEnemyParty()
      const { encounterScene } = service.startBattle(party, enemies)

      const turnOrderScene = service.createTurnOrderScene(encounterScene)

      expect(turnOrderScene.phase).toBe("turnOrder")
    })

    it("custom turn-order policyを各turnで適用する", () => {
      let calls = 0
      const customService = new WizSceneBattleService({
        rewardCalculator: new WizEngineBattleDefaultRewardCalculator(),
        turnOrderPolicy: {
          order: (context) => {
            calls += 1
            return [
              ...context.enemies.getAllAliveMonsters().map((monster) => monster.id),
              ...context.party.getActableMembers().map((character) => character.id),
            ]
          },
        },
      })
      const { encounterScene } = customService.startBattle(
        wizMockSoloParty(),
        wizMockWeakEnemyParty(),
      )

      const firstTurn = customService.createTurnOrderScene(encounterScene)
      expect(firstTurn.phase).toBe("turnOrder")
      if (firstTurn.phase !== "turnOrder") return
      expect(firstTurn.getCurrentActor()?.isEnemy).toBe(true)

      const secondTurn = customService.toNextTurn(firstTurn)
      expect(secondTurn.phase).toBe("turnOrder")
      if (secondTurn.phase !== "turnOrder") return
      expect(secondTurn.getCurrentActor()?.isEnemy).toBe(true)
      expect(calls).toBe(2)
    })

    it("canonical actor集合でないcustom turn-orderを拒否する", () => {
      const customService = new WizSceneBattleService({
        rewardCalculator: new WizEngineBattleDefaultRewardCalculator(),
        turnOrderPolicy: {
          order: (context) => [context.party.members[0].id],
        },
      })
      const { encounterScene } = customService.startBattle(
        wizMockSoloParty(),
        wizMockWeakEnemyParty(),
      )

      expect(() => customService.createTurnOrderScene(encounterScene)).toThrow(
        "Battle turn-order policy must return every canonical actor ID once",
      )
    })
  })

  describe("getCurrentActor", () => {
    it("turnOrder フェーズで現在のアクターを返す", () => {
      const party = wizMockSoloParty()
      const enemies = wizMockWeakEnemyParty()
      const { encounterScene } = service.startBattle(party, enemies)
      const turnOrderScene = service.createTurnOrderScene(encounterScene)

      const actor = service.getCurrentActor(turnOrderScene)

      expect(actor).not.toBeNull()
      expect(actor?.id).toBeDefined()
      expect(actor?.name).toBeDefined()
    })

    it("turnOrder 以外のフェーズでは null を返す", () => {
      const party = wizMockSoloParty()
      const enemies = wizMockWeakEnemyParty()
      const { encounterScene } = service.startBattle(party, enemies)

      const actor = service.getCurrentActor(encounterScene)

      expect(actor).toBeNull()
    })
  })

  describe("selectEnemyAction", () => {
    it("turnOrder 以外のフェーズでは null を返す", () => {
      const party = wizMockSoloParty()
      const enemies = wizMockWeakEnemyParty()
      const { encounterScene } = service.startBattle(party, enemies)

      const action = service.selectEnemyAction("goblin-1", encounterScene)

      expect(action).toBeNull()
    })

    it("存在しないモンスター ID では null を返す", () => {
      const party = wizMockSoloParty()
      const enemies = wizMockWeakEnemyParty()
      const { encounterScene } = service.startBattle(party, enemies)
      const turnOrderScene = service.createTurnOrderScene(encounterScene)

      const action = service.selectEnemyAction("nonexistent", turnOrderScene)

      expect(action).toBeNull()
    })
  })

  describe("isTurnComplete", () => {
    it("turnOrder 以外のフェーズでは false を返す", () => {
      const party = wizMockSoloParty()
      const enemies = wizMockWeakEnemyParty()
      const { encounterScene } = service.startBattle(party, enemies)

      expect(service.isTurnComplete(encounterScene)).toBe(false)
    })
  })

  describe("executeAction", () => {
    it("turnOrder フェーズで実行できる", () => {
      const party = wizMockSoloParty()
      const enemies = wizMockWeakEnemyParty()
      const { encounterScene } = service.startBattle(party, enemies)
      const turnOrderScene = service.createTurnOrderScene(encounterScene)
      if (turnOrderScene.phase !== "turnOrder") return

      const result = service.executeAction(turnOrderScene, actionBuilder.attack("hero", "goblin-1"))

      expect(result.scene).toBeDefined()
    })

    it("class継承不要のstructural executorを実行する", () => {
      let executed = false
      const customService = new WizSceneBattleService({
        rewardCalculator: new WizEngineBattleDefaultRewardCalculator(),
        executor: {
          execute: (action, party, enemies) => {
            executed = true
            return WizEngineBattleExecutionResult.accept({
              party,
              enemies,
              logs: [],
              success: true,
              action,
            })
          },
        },
      })
      const { encounterScene } = customService.startBattle(
        wizMockSoloParty(),
        wizMockWeakEnemyParty(),
      )
      const turnOrderScene = customService.createTurnOrderScene(encounterScene)
      if (turnOrderScene.phase !== "turnOrder") return
      const actor = turnOrderScene.getCurrentActor()
      if (!actor) return
      const targetId = actor.isEnemy
        ? turnOrderScene.context.party.members[0].id
        : turnOrderScene.context.enemies.getAllMonsters()[0].id

      const result = customService.executeAction(
        turnOrderScene,
        actionBuilder.attack(actor.id, targetId),
      )

      expect(executed).toBe(true)
      expect(result.accepted).toBe(true)
      expect(result.action?.actorId).toBe(actor.id)
    })

    it("battle contentをexecutorへ実行時注入する", () => {
      const skill = wizMockFireballAbility()
      const content = WizEngineBattleContent.fromArrays({ abilities: [skill] })
      const contentService = new WizSceneBattleService({
        content,
        rewardCalculator: new WizEngineBattleDefaultRewardCalculator(),
      })
      const { encounterScene } = contentService.startBattle(
        wizMockSoloParty(),
        wizMockWeakEnemyParty(),
      )
      const turnOrderScene = contentService.createTurnOrderScene(encounterScene)
      if (turnOrderScene.phase !== "turnOrder") return
      const actor = turnOrderScene.getCurrentActor()
      if (!actor) return
      const targetId = actor.isEnemy
        ? turnOrderScene.context.party.members[0].id
        : turnOrderScene.context.enemies.getAllMonsters()[0].id

      const result = contentService.executeAction(
        turnOrderScene,
        actionBuilder.ability(actor.id, skill.id, [targetId]),
        {
          actorAbilityIds: [skill.id],
          content: new WizEngineBattleContent(),
        },
      )

      expect(result.accepted).toBe(true)
    })
  })

  describe("toNextTurn", () => {
    it("serviceが標準policyを再適用して次turnを生成する", () => {
      const { encounterScene } = service.startBattle(wizMockSoloParty(), wizMockWeakEnemyParty())
      const firstTurn = service.createTurnOrderScene(encounterScene)
      if (firstTurn.phase !== "turnOrder") return
      const skipped = service.skipCurrentActor(firstTurn)

      const secondTurn = service.toNextTurn(skipped)

      expect(secondTurn.phase).toBe("turnOrder")
      if (secondTurn.phase !== "turnOrder") return
      expect(secondTurn.context.turnNumber).toBe(2)
      expect(secondTurn.currentActorIndex).toBe(0)
      expect(secondTurn.turnOrder.length).toBeGreaterThan(0)
    })

    it("turnOrder 以外のフェーズではシーンを変更しない", () => {
      const party = wizMockSoloParty()
      const enemies = wizMockWeakEnemyParty()
      const { encounterScene } = service.startBattle(party, enemies)

      expect(service.toNextTurn(encounterScene)).toBe(encounterScene)
    })
  })

  describe("skipCurrentActor", () => {
    it("turnOrder 以外のフェーズではシーンを変更しない", () => {
      const party = wizMockSoloParty()
      const enemies = wizMockWeakEnemyParty()
      const { encounterScene } = service.startBattle(party, enemies)

      expect(service.skipCurrentActor(encounterScene)).toBe(encounterScene)
    })
  })
})
