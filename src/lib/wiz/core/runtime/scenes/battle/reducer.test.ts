import { describe, expect, it } from "vite-plus/test"
import { MOCK_VAULT } from "@/lib/wiz/core/mocks/mock-vault"
import { WizEngineBattleContent } from "@/lib/wiz/core/engine/battle/content"
import { WizEngineBattleContext } from "@/lib/wiz/core/engine/battle/context"
import { WizEngineBattleTurnActionExecutor } from "@/lib/wiz/core/engine/battle/execution/action-executor"
import { WizEngineBattleExecutionResult } from "@/lib/wiz/core/engine/battle/execution/execution-result"
import { WizEngineBattlePhaseDefeat } from "@/lib/wiz/core/engine/battle/phases/defeat"
import { WizEngineBattleDefaultTurnOrderPolicy } from "@/lib/wiz/core/engine/battle/phases/turn-order-policy"
import { WizEngineBattlePhaseTurnOrder } from "@/lib/wiz/core/engine/battle/phases/turn-order"
import { WizEngineBattlePhaseVictory } from "@/lib/wiz/core/engine/battle/phases/victory"
import { WizEngineBattleActionBuilder } from "@/lib/wiz/core/engine/battle/turn-action-builder"
import { WizEngineBattleFleeResult } from "@/lib/wiz/core/engine/flee/flee-result"
import { WizEngineBattleReward } from "@/lib/wiz/core/engine/reward/battle-reward"
import { WizEngineBattleDefaultRewardCalculator } from "@/lib/wiz/core/engine/reward/default-reward-calculator"
import { wizMockEasyBattle } from "@/lib/wiz/core/mocks/mock-battle"
import { wizMockPotion } from "@/lib/wiz/core/mocks/mock-item"
import { wizMockFireballAbility } from "@/lib/wiz/core/mocks/mock-ability"
import { wizMockWeakEnemyParty } from "@/lib/wiz/core/mocks/mock-enemy-party"
import { wizMockSoloParty } from "@/lib/wiz/core/mocks/mock-party"
import { createMockInventoryService, withMockInventory } from "@/lib/wiz/core/mocks/mock-inventory"
import { WizSceneBattleCharacterAdapter } from "@/lib/wiz/core/runtime/converters/battle-character-adapter"
import { WizSceneBattleReducer } from "@/lib/wiz/core/runtime/scenes/battle/reducer"
import { WizSceneBattleRewardSettlementResult } from "@/lib/wiz/core/runtime/scenes/battle/reward-settlement"
import { WizStateBattle } from "@/lib/wiz/core/runtime/scenes/battle/state"
import { WizSceneBattleService } from "@/lib/wiz/core/runtime/scenes/battle/wiz-battle-service"
import { toVillageScene } from "@/lib/wiz/core/runtime/scene-transitions"

const actionBuilder = new WizEngineBattleActionBuilder({ nextId: () => "test-action" })
const turnOrderPolicy = new WizEngineBattleDefaultTurnOrderPolicy()
const battleContent = WizEngineBattleContent.fromArrays({
  abilities: [wizMockFireballAbility()],
  items: [wizMockPotion()],
})
const rewardContent = Object.freeze({
  items: Object.freeze({
    "item-potion": Object.freeze({
      id: "item-potion",
      name: "Potion",
      description: "Potion",
      itemType: "consumable" as const,
      price: 1,
      sellPrice: 1,
    }),
  }),
})
const inventoryService = createMockInventoryService(undefined, "battle-entry")
const reducer = new WizSceneBattleReducer({
  battleService: new WizSceneBattleService({
    content: battleContent,
    rewardCalculator: new WizEngineBattleDefaultRewardCalculator(),
  }),
  content: rewardContent,
  inventoryService,
})

function createBattleState(
  phase: WizStateBattle["phase"],
  returnAreaId = "forest",
): WizStateBattle {
  return new WizStateBattle<unknown, unknown, undefined>({
    type: "battle",
    phase,
    returnAreaId,
    vault: MOCK_VAULT,
  })
}

function createContext() {
  return new WizEngineBattleContext({
    id: "test-battle",
    turnNumber: 1,
    party: wizMockSoloParty(),
    enemies: wizMockWeakEnemyParty(),
    executedActions: [],
    initiative: "none",
  })
}

type PlayerTurnStateOptions = {
  readonly hp?: number
  readonly mp?: number
  readonly abilityIds?: readonly string[]
  readonly itemId?: string
  readonly solo?: boolean
}

function createPlayerTurnState(options: PlayerTurnStateOptions = {}) {
  let vault = MOCK_VAULT.updatePlayer((player) =>
    player
      .withHp(options.hp ?? player.hp)
      .withMp(options.mp ?? player.mp)
      .withAbilityIds(options.abilityIds ?? player.abilityIds),
  )
  const itemId = options.itemId
  if (itemId) {
    vault = withMockInventory(vault, [{ contentType: "item", contentId: itemId }])
  }
  if (options.solo) {
    vault = vault.withPartyMembers([])
  }

  const party = WizSceneBattleCharacterAdapter.createDefault().partyFromVault(vault.toPlain())
  const context = new WizEngineBattleContext({
    id: "player-turn-battle",
    turnNumber: 1,
    party,
    enemies: wizMockWeakEnemyParty(),
    executedActions: [],
    initiative: "none",
  })
  let phase = WizEngineBattlePhaseTurnOrder.create(context, turnOrderPolicy.order(context))
  while (phase.getCurrentActor()?.id !== "player") {
    phase = phase.skipCurrentActor()
  }

  return new WizStateBattle({
    type: "battle",
    phase,
    returnAreaId: "forest",
    vault,
  })
}

describe("WizSceneBattleReducer", () => {
  describe("battle以外の状態", () => {
    it("battle以外の状態を契約違反として拒否する", () => {
      const villageState = toVillageScene(MOCK_VAULT)
      const action = { type: "BATTLE_START" as const }

      expect(() =>
        reducer.reduce(
          // @ts-expect-error battle reducerはbattle stateだけを受理する。
          villageState,
          action,
        ),
      ).toThrow(TypeError)
    })
  })

  describe("BATTLE_START", () => {
    it("encounterフェーズからturnOrderフェーズへ遷移する", () => {
      const encounter = wizMockEasyBattle()
      const state = createBattleState(encounter)
      const action = { type: "BATTLE_START" as const }

      const result = reducer.reduce(state, action)

      expect(result.state.type).toBe("battle")
      if (result.state.type === "battle") {
        expect(result.state.phase.phase).toBe("turnOrder")
      }
      expect(result.transition).toBeUndefined()
    })

    it("BATTLE_STARTログが記録される", () => {
      const encounter = wizMockEasyBattle()
      const state = createBattleState(encounter)
      const action = { type: "BATTLE_START" as const }

      const result = reducer.reduce(state, action)

      const hasLog = result.state.vault.log.some((log) => log.key === "BATTLE_START")
      expect(hasLog).toBe(true)
    })

    it("encounterフェーズ以外では状態を変更しない", () => {
      const context = createContext()
      const victoryPhase = new WizEngineBattlePhaseVictory({ context })
      const state = createBattleState(victoryPhase)
      const action = { type: "BATTLE_START" as const }

      const result = reducer.reduce(state, action)

      expect(result.state).toBe(state)
      expect(result.transition).toBeUndefined()
    })
  })

  describe("BATTLE_FLEE", () => {
    it("encounterフェーズから逃走すると探索画面へ遷移する", () => {
      const encounter = wizMockEasyBattle()
      const state = createBattleState(encounter, "forest")
      const action = { type: "BATTLE_FLEE" as const }

      const result = reducer.reduce(state, action)

      expect(result.transition).toEqual({
        type: "GO_TO_EXPLORATION",
        areaId: "forest",
      })
    })

    it("FLED_BATTLEログが記録される", () => {
      const encounter = wizMockEasyBattle()
      const state = createBattleState(encounter)
      const action = { type: "BATTLE_FLEE" as const }

      const result = reducer.reduce(state, action)

      const hasLog = result.state.vault.log.some((log) => log.key === "FLED_BATTLE")
      expect(hasLog).toBe(true)
    })

    it("逃走時にlogがクリアされる", () => {
      const encounter = wizMockEasyBattle()
      const vaultWithLog = MOCK_VAULT.addLog({ key: "BATTLE_START" })
      const state = new WizStateBattle({
        type: "battle",
        phase: encounter,
        returnAreaId: "forest",
        vault: vaultWithLog,
      })
      const action = { type: "BATTLE_FLEE" as const }

      const result = reducer.reduce(state, action)

      // logはクリアされた後にFLED_BATTLEが追加される
      const battleStartLogs = result.state.vault.log.filter((log) => log.key === "BATTLE_START")
      expect(battleStartLogs).toHaveLength(0)
    })

    it("encounterフェーズ以外では状態を変更しない", () => {
      const context = createContext()
      const victoryPhase = new WizEngineBattlePhaseVictory({ context })
      const state = createBattleState(victoryPhase)
      const action = { type: "BATTLE_FLEE" as const }

      const result = reducer.reduce(state, action)

      expect(result.state).toBe(state)
      expect(result.transition).toBeUndefined()
    })
  })

  describe("BATTLE_EXECUTE_ACTION", () => {
    it("custom reward settlementが標準反映を完全に一度だけ置き換える", () => {
      const settlementCalls: string[] = []
      const rewardItem = wizMockPotion()
      const customReducer = new WizSceneBattleReducer({
        battleService: new WizSceneBattleService({
          executor: {
            execute: (executedAction, party, enemies) =>
              WizEngineBattleExecutionResult.accept({
                party,
                enemies: enemies.withDamageToAll(9999),
                logs: [],
                success: true,
                action: executedAction,
              }),
          },
          rewardCalculator: {
            calculate: () =>
              new WizEngineBattleReward({
                experience: 100,
                gold: 50,
                droppedItems: [{ itemId: rewardItem.id, quantity: 3 }],
                custom: undefined,
              }),
          },
        }),
        content: rewardContent,
        inventoryService,
        rewardSettlement: {
          settle: ({ vault, returnAreaId }) => {
            settlementCalls.push(returnAreaId)
            return WizSceneBattleRewardSettlementResult.accept(
              vault.addFlag("custom-reward-settled"),
            )
          },
        },
      })
      const state = createPlayerTurnState()
      const experienceBefore = state.vault.player.exp
      const goldBefore = state.vault.player.gold
      const progressBefore = state.vault.findArea("forest")?.progress
      const targetId = state.phase.context.enemies.getAllAliveMonsters()[0].id

      const result = customReducer.reduce(state, {
        type: "BATTLE_EXECUTE_ACTION",
        action: actionBuilder.attack("player", targetId),
      })

      expect(result.state.type).toBe("battle")
      if (result.state.type !== "battle") return
      expect(result.state.phase.phase).toBe("victory")
      expect(settlementCalls).toEqual(["forest"])
      expect(result.state.vault.hasFlag("custom-reward-settled")).toBe(true)
      expect(result.state.vault.player.exp).toBe(experienceBefore)
      expect(result.state.vault.player.gold).toBe(goldBefore)
      expect(result.state.vault.inventory.totalQuantity("item", rewardItem.id)).toBe(0)
      expect(result.state.vault.findArea("forest")?.progress).toBe(progressBefore)
      expect(result.state.vault.log.some((message) => message.key === "BATTLE_VICTORY")).toBe(false)
    })

    it("未知の報酬itemはscene全体をexact stateのまま拒否する", () => {
      const unknownItemId = "unknown-reward-item"
      const rejectingReducer = new WizSceneBattleReducer({
        battleService: new WizSceneBattleService({
          executor: {
            execute: (executedAction, party, enemies) =>
              WizEngineBattleExecutionResult.accept({
                party,
                enemies: enemies.withDamageToAll(9999),
                logs: [],
                success: true,
                action: executedAction,
              }),
          },
          rewardCalculator: {
            calculate: () =>
              new WizEngineBattleReward({
                experience: 100,
                gold: 50,
                droppedItems: [{ itemId: unknownItemId, quantity: 1 }],
                custom: undefined,
              }),
          },
        }),
        content: rewardContent,
        inventoryService,
      })
      const state = createPlayerTurnState()
      const targetId = state.phase.context.enemies.getAllAliveMonsters()[0].id

      const result = rejectingReducer.reduce(state, {
        type: "BATTLE_EXECUTE_ACTION",
        action: actionBuilder.attack("player", targetId),
      })

      expect(result.accepted).toBe(false)
      if (result.accepted) {
        throw new TypeError("Expected reward settlement rejection")
      }
      expect(result.reason).toBe("BATTLE_REWARD_ITEM_NOT_FOUND")
      expect(result.state).toBe(state)
      expect(result.state.vault).toBe(state.vault)
    })

    it("未所持アイテムを拒否し、状態とターンを進めない", () => {
      const item = wizMockPotion()
      const state = createPlayerTurnState({ hp: 10 })
      const action = {
        type: "BATTLE_EXECUTE_ACTION" as const,
        action: actionBuilder.item("player", item.id, ["player"]),
      }

      const result = reducer.reduce(state, action)

      expect(result.state).toBe(state)
      expect(state.vault.player.hp).toBe(10)
      expect(state.vault.inventory.totalQuantity("item", item.id)).toBe(0)
    })

    it("所持アイテムを消費し、回復後のHPをphaseとvaultへ同期する", () => {
      const item = wizMockPotion()
      const state = createPlayerTurnState({ hp: 10, itemId: item.id })
      const action = {
        type: "BATTLE_EXECUTE_ACTION" as const,
        action: actionBuilder.item("player", item.id, ["player"]),
      }

      const result = reducer.reduce(state, action)

      expect(result.state.type).toBe("battle")
      if (result.state.type !== "battle") return
      expect(result.state.vault.inventory.totalQuantity("item", item.id)).toBe(0)
      expect(result.state.vault.player.hp).toBe(50)
      expect(
        result.state.phase.context.party
          .getMemberById("player")
          ?.status.resources.current("health"),
      ).toBe(50)
    })

    it("未習得スキルを拒否し、MPを消費しない", () => {
      const skill = wizMockFireballAbility()
      const state = createPlayerTurnState({ mp: 20, abilityIds: [] })
      const targetIds = state.phase.context.enemies
        .getAllAliveMonsters()
        .map((monster) => monster.id)
      const action = {
        type: "BATTLE_EXECUTE_ACTION" as const,
        action: actionBuilder.ability("player", skill.id, targetIds),
      }

      const result = reducer.reduce(state, action)

      expect(result.state).toBe(state)
      expect(state.vault.player.mp).toBe(20)
    })

    it("習得済みスキルのMP消費をphaseとvaultへ同期する", () => {
      const skill = wizMockFireballAbility()
      const state = createPlayerTurnState({ mp: 20, abilityIds: [skill.id] })
      const targetIds = state.phase.context.enemies
        .getAllAliveMonsters()
        .map((monster) => monster.id)
      const action = {
        type: "BATTLE_EXECUTE_ACTION" as const,
        action: actionBuilder.ability("player", skill.id, targetIds),
      }

      const result = reducer.reduce(state, action)

      expect(result.state.type).toBe("battle")
      if (result.state.type !== "battle") return
      expect(result.state.vault.player.mp).toBe(10)
      expect(
        result.state.phase.context.party.getMemberById("player")?.status.resources.current("mana"),
      ).toBe(10)
    })

    it("最後の生存メンバーが逃走した場合は敗北ではなく探索へ戻る", () => {
      const fleeReducer = new WizSceneBattleReducer({
        battleService: new WizSceneBattleService({
          executor: new WizEngineBattleTurnActionExecutor({
            fleeCalculator: {
              calculate: () => new WizEngineBattleFleeResult({ success: true, canRetry: false }),
            },
          }),
          rewardCalculator: new WizEngineBattleDefaultRewardCalculator(),
        }),
        content: rewardContent,
        inventoryService,
      })
      const state = createPlayerTurnState({ hp: 15, mp: 12, solo: true })
      const action = {
        type: "BATTLE_EXECUTE_ACTION" as const,
        action: actionBuilder.flee("player"),
      }

      const result = fleeReducer.reduce(state, action)

      expect(result.transition).toEqual({
        type: "GO_TO_EXPLORATION",
        areaId: "forest",
      })
      expect(result.state.type).toBe("battle")
      if (result.state.type !== "battle") return
      expect(result.state.phase.phase).toBe("turnOrder")
      expect(result.state.vault.player.hp).toBe(15)
      expect(result.state.vault.player.mp).toBe(12)
      expect(result.state.vault.isEnded).toBe(false)
    })
  })

  describe("BATTLE_END", () => {
    it("victoryフェーズから探索画面へ遷移する", () => {
      const context = createContext()
      const victoryPhase = new WizEngineBattlePhaseVictory({ context })
      const state = createBattleState(victoryPhase, "forest")
      const action = { type: "BATTLE_END" as const }

      const result = reducer.reduce(state, action)

      expect(result.transition).toEqual({
        type: "GO_TO_EXPLORATION",
        areaId: "forest",
      })
    })

    it("victory終了時にlogがクリアされる", () => {
      const context = createContext()
      const victoryPhase = new WizEngineBattlePhaseVictory({ context })
      const vaultWithLog = MOCK_VAULT.addLog({
        key: "BATTLE_VICTORY",
        exp: 10,
        gold: 5,
      })
      const state = new WizStateBattle({
        type: "battle",
        phase: victoryPhase,
        returnAreaId: "forest",
        vault: vaultWithLog,
      })
      const action = { type: "BATTLE_END" as const }

      const result = reducer.reduce(state, action)

      expect(result.state.vault.log).toHaveLength(0)
    })

    it("defeatフェーズから村へ遷移する", () => {
      const context = createContext()
      const defeatPhase = new WizEngineBattlePhaseDefeat({ context })
      const state = createBattleState(defeatPhase)
      const action = { type: "BATTLE_END" as const }

      const result = reducer.reduce(state, action)

      expect(result.transition).toEqual({ type: "GO_TO_VILLAGE" })
    })

    it("victoryでもdefeatでもないフェーズでは状態を変更しない", () => {
      const encounter = wizMockEasyBattle()
      const state = createBattleState(encounter)
      const action = { type: "BATTLE_END" as const }

      const result = reducer.reduce(state, action)

      expect(result.state).toBe(state)
      expect(result.transition).toBeUndefined()
    })
  })

  describe("未知のアクション", () => {
    it("未知のアクションでは状態を変更しない", () => {
      const encounter = wizMockEasyBattle()
      const state = createBattleState(encounter)
      const unknownAction = { type: "UNKNOWN_ACTION" } as never

      const result = reducer.reduce(state, unknownAction)

      expect(result.state).toBe(state)
      expect(result.transition).toBeUndefined()
    })
  })
})
