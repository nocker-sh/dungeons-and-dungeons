import { describe, expect, it } from "vite-plus/test"
import {
  MOCK_CONTENT,
  MOCK_CONTEXT,
  MOCK_INITIAL_STATE,
  MOCK_SHOP_DIALOGUE_SERVICE,
  MOCK_VAULT,
} from "@/lib/wiz/core/mocks/mock-vault"
import { withMockInventory } from "@/lib/wiz/core/mocks/with-mock-inventory"
import { WizEngineBattleContent } from "@/lib/wiz/core/engine/battle/content"
import { WizEngineBattleTurnAction } from "@/lib/wiz/core/engine/battle/turn-action"
import { WizStandardRuntimeEnvironment } from "@/lib/wiz/core/presets/runtime-environment"
import { WizRootReducer } from "@/lib/wiz/core/presets/default"
import { WizPresetValue } from "@/lib/wiz/core/presets/wiz-preset"
import { toConversationScene } from "@/lib/wiz/core/runtime/to-conversation-scene"
import { toCraftingScene } from "@/lib/wiz/core/runtime/to-crafting-scene"
import { toExplorationScene } from "@/lib/wiz/core/runtime/to-exploration-scene"
import { WizDice } from "@/lib/wiz/core/services/wiz-dice"

const rootReducer = new WizRootReducer({
  content: MOCK_CONTENT,
  context: MOCK_CONTEXT,
  shopDialogueService: MOCK_SHOP_DIALOGUE_SERVICE,
})

const reduce = (
  state: Parameters<WizRootReducer["reduce"]>[0],
  action: Parameters<WizRootReducer["reduce"]>[1]
) => rootReducer.reduce(state, action).state

describe("WizRootReducer", () => {
  describe("構築", () => {
    it("依存性を渡して構築できる", () => {
      const reducer = new WizRootReducer({
        content: MOCK_CONTENT,
        context: MOCK_CONTEXT,
        shopDialogueService: MOCK_SHOP_DIALOGUE_SERVICE,
      })
      expect(reducer).toBeDefined()
      expect(typeof reducer.reduce).toBe("function")
    })

    it("abilityLearning なしでも構築できる", () => {
      const reducer = new WizRootReducer({
        content: MOCK_CONTENT,
        context: MOCK_CONTEXT,
        shopDialogueService: MOCK_SHOP_DIALOGUE_SERVICE,
      })
      expect(reducer).toBeDefined()
    })
  })

  describe("シーン遷移: village -> shop", () => {
    it("GO_TO_SHOP アクションで shop state に遷移する", () => {
      const newState = reduce(MOCK_INITIAL_STATE, {
        type: "GO_TO_SHOP",
        shopId: "item_shop",
      })

      expect(newState.type).toBe("shop")
      if (newState.type === "shop") {
        expect(newState.shopId).toBe("item_shop")
      }
    })
  })

  describe("シーン遷移: village -> inn", () => {
    it("GO_TO_INN アクションで inn state に遷移する", () => {
      const newState = reduce(MOCK_INITIAL_STATE, { type: "GO_TO_INN" })

      expect(newState.type).toBe("inn")
    })
  })

  describe("シーン遷移: village -> quest", () => {
    it("GO_TO_QUEST アクションで quest state に遷移する", () => {
      const newState = reduce(MOCK_INITIAL_STATE, { type: "GO_TO_QUEST" })

      expect(newState.type).toBe("quest")
    })
  })

  describe("シーン遷移: village -> crafting", () => {
    it("GO_TO_CRAFTING アクションで crafting state に遷移する", () => {
      const newState = reduce(MOCK_INITIAL_STATE, { type: "GO_TO_CRAFTING" })

      expect(newState.type).toBe("crafting")
    })
  })

  describe("システムアクション", () => {
    it("ADD_LOG アクションがシステムリデューサーにルーティングされる", () => {
      const newState = reduce(MOCK_INITIAL_STATE, {
        type: "ADD_LOG",
        message: { key: "ENTERED_INN" },
      })

      const lastLog = newState.vault.log[newState.vault.log.length - 1]
      expect(lastLog).toEqual({ key: "ENTERED_INN" })
    })
  })

  it("exploration actionを別sceneのexploration reducerへ誤routeしない", () => {
    const result = rootReducer.reduce(MOCK_INITIAL_STATE, {
      type: "EXPLORATION_ACTION",
      areaId: "forest",
      action: "explore",
    })

    expect(result.accepted).toBe(true)
    expect(result.state).toBe(MOCK_INITIAL_STATE)
  })

  describe("semantic rejection", () => {
    it("inventory拒否を理由付きで返し入力stateを維持する", () => {
      const result = rootReducer.reduce(MOCK_INITIAL_STATE, {
        type: "USE_ITEM",
        itemId: "potion",
      })

      expect(result).toMatchObject({
        accepted: false,
        reason: "INVENTORY_ITEM_NOT_FOUND",
      })
      expect(result.state).toBe(MOCK_INITIAL_STATE)
    })

    it("navigation拒否を理由付きで返し入力stateを維持する", () => {
      const exploration = toExplorationScene(MOCK_VAULT, "forest")
      const result = rootReducer.reduce(exploration, {
        type: "ENCOUNTER_MONSTER",
        areaId: "forest",
        monsterId: "missing",
      })

      expect(result).toMatchObject({
        accepted: false,
        reason: "ENCOUNTER_TARGET_NOT_IN_AREA",
      })
      expect(result.state).toBe(exploration)
    })

    it("battle中のinventory actionを理由付きで拒否する", () => {
      const monster = MOCK_VAULT.areas.find((area) => area.id === "forest")
        ?.monsters[0]
      if (!monster) throw new Error("forest monster is required")
      const encounter = rootReducer.reduce(
        toExplorationScene(MOCK_VAULT, "forest"),
        {
          type: "ENCOUNTER_MONSTER",
          areaId: "forest",
          monsterId: monster.id,
        }
      ).state
      const battle = rootReducer.reduce(encounter, {
        type: "BATTLE_START",
      }).state

      const result = rootReducer.reduce(battle, {
        type: "USE_ITEM",
        itemId: "potion",
      })

      expect(result).toMatchObject({
        accepted: false,
        reason: "ACTION_NOT_ALLOWED_IN_SCENE",
      })
      expect(result.state).toBe(battle)
    })

    it("conversationの失敗をidentity fallbackなしで伝える", () => {
      const npc = MOCK_INITIAL_STATE.vault.npcs[0]
      if (!npc) throw new Error("NPC fixture is required")
      const state = toConversationScene(MOCK_INITIAL_STATE.vault, npc.id)
      const dialogue = state.getCurrentDialogue()
      if (!dialogue) throw new Error("dialogue fixture is required")

      const result = rootReducer.reduce(state, {
        type: "SELECT_DIALOGUE_OPTION",
        npcId: npc.id,
        dialogueId: dialogue.id,
        optionId: "missing",
      })

      expect(result).toMatchObject({
        accepted: false,
        reason: "DIALOGUE_OPTION_REJECTED",
      })
      expect(result.state).toBe(state)
    })
  })

  describe("プリセットと乱数の構成", () => {
    it("statusConversion が実際の戦闘開始経路に反映される", () => {
      const monster = MOCK_VAULT.areas.find((area) => area.id === "forest")
        ?.monsters[0]
      if (!monster) throw new Error("forest monster is required")

      const reducer = new WizRootReducer({
        content: MOCK_CONTENT,
        context: MOCK_CONTEXT,
        shopDialogueService: MOCK_SHOP_DIALOGUE_SERVICE,
        preset: WizPresetValue.create({
          statusConversion: {
            speedFormula: () => 999,
          },
        }),
      })

      const next = reducer.reduce(toExplorationScene(MOCK_VAULT, "forest"), {
        type: "ENCOUNTER_MONSTER",
        areaId: "forest",
        monsterId: monster.id,
      }).state

      expect(next.type).toBe("battle")
      if (next.type === "battle") {
        expect(
          next.phase.context.party
            .getMemberById("player")
            ?.status.attributes.value("speed")
        ).toBe(999)
      }
    })

    it("Root に注入した同じダイスを探索判定と遭遇抽選で使う", () => {
      const reducer = new WizRootReducer({
        content: MOCK_CONTENT,
        context: MOCK_CONTEXT,
        shopDialogueService: MOCK_SHOP_DIALOGUE_SERVICE,
        environment: WizStandardRuntimeEnvironment.create({
          dice: WizDice.fixed([6, 5, 1, 3, 5]),
        }),
        preset: WizPresetValue.create({
          exploration: { monsterEncounterBase: 50 },
          time: {
            timeEffects: {
              morning: {
                monsterEncounterRate: 2,
              },
            },
          },
        }),
      })

      const next = reducer.reduce(toExplorationScene(MOCK_VAULT, "forest"), {
        type: "EXPLORATION_ACTION",
        areaId: "forest",
        action: "explore",
      }).state

      expect(next.type).toBe("battle")
      if (next.type === "battle") {
        expect(
          next.phase.context.enemies
            .getAllMonsters()
            .map((monster) => monster.groupId)
        ).toEqual(["goblin", "goblin", "wolf"])
      }
    })

    it("environmentのseeded diceをcraftingの実経路まで伝播する", () => {
      const reducer = new WizRootReducer({
        content: MOCK_CONTENT,
        context: MOCK_CONTEXT,
        shopDialogueService: MOCK_SHOP_DIALOGUE_SERVICE,
        environment: WizStandardRuntimeEnvironment.create({
          dice: WizDice.withSeed(123),
          clock: () => 1_234,
          nextId: () => "fixed-action",
        }),
      })
      const vault = withMockInventory(MOCK_VAULT, [
        { contentType: "item", contentId: "herb", quantity: 2 },
      ])
      const selected = reducer.reduce(toCraftingScene(vault), {
        type: "SELECT_RECIPE",
        recipeId: "potion",
      }).state
      const crafted = reducer.reduce(selected, { type: "CONFIRM_CRAFT" }).state

      if (crafted.type !== "crafting" || crafted.result.status === "pending") {
        throw new Error("completed crafting result is required")
      }
      expect(crafted.result.diceResult.dice).toEqual([2, 5])
    })

    it("environmentのnextId列をbattle・action・status IDへ一貫して伝播する", () => {
      const focusAbility = {
        id: "focus",
        name: "Focus",
        description: "Raise attack",
        tags: [],
        costs: { mana: 0 },
        effect: {
          type: "effect" as const,
          side: "allies" as const,
          target: "self" as const,
          element: "physical",
          power: 5,
          effectId: "attackUp",
          tags: [],
          modifier: { attack: 5 },
        },
        custom: {},
      }
      const battleContent = new WizEngineBattleContent({
        abilities: { [focusAbility.id]: focusAbility },
      })
      const vaultWithAbility = MOCK_VAULT.updatePlayer((player) =>
        player.addAbilityId(focusAbility.id)
      )
      const vault = vaultWithAbility.withAreas(
        vaultWithAbility.areas.map((area) => ({
          ...area,
          monsters: area.monsters.map((monster) => ({
            ...monster,
            agility: 9_999,
          })),
        }))
      )
      const generatedIds = [
        "battle-sequence",
        "enemy-action-sequence",
        "status-sequence",
      ]
      const environment = WizStandardRuntimeEnvironment.create({
        dice: WizDice.fixed([3]),
        clock: () => 4_242,
        nextId: () => {
          const id = generatedIds.shift()
          if (!id) throw new Error("unexpected ID generation")
          return id
        },
      })
      const reducer = new WizRootReducer({
        content: MOCK_CONTENT,
        context: MOCK_CONTEXT,
        shopDialogueService: MOCK_SHOP_DIALOGUE_SERVICE,
        battleContent,
        environment,
        preset: WizPresetValue.create({
          effect: { defaultBuffTurns: 8 },
        }),
      })
      const sourceMonster = vault.areas.find((area) => area.id === "forest")
        ?.monsters[0]
      if (!sourceMonster) throw new Error("forest monster is required")
      const battle = reducer.reduce(toExplorationScene(vault, "forest"), {
        type: "ENCOUNTER_MONSTER",
        areaId: "forest",
        monsterId: sourceMonster.id,
      }).state

      expect(battle.type).toBe("battle")
      if (battle.type !== "battle") throw new Error("battle state is required")
      expect(battle.phase.context.id).toBe("battle_battle-sequence")

      const turnOrder = reducer.reduce(battle, { type: "BATTLE_START" }).state
      if (
        turnOrder.type !== "battle" ||
        turnOrder.phase.phase !== "turnOrder"
      ) {
        throw new Error("turn order phase is required")
      }
      expect(turnOrder.phase.getCurrentActor()?.isEnemy).toBe(true)

      const afterEnemyAction = reducer.reduce(turnOrder, {
        type: "BATTLE_EXECUTE_ENEMY_TURN",
      }).state
      if (afterEnemyAction.type !== "battle")
        throw new Error("battle result is required")
      expect(afterEnemyAction.phase.context.executedActions[0]?.id).toBe(
        "enemy-action-sequence"
      )
      if (afterEnemyAction.phase.phase !== "turnOrder") {
        throw new Error("player turn is required")
      }

      const result = reducer.reduce(afterEnemyAction, {
        type: "BATTLE_EXECUTE_ACTION",
        action: WizEngineBattleTurnAction.ability(
          "player",
          focusAbility.id,
          ["player"],
          "focus-action"
        ),
      }).state

      if (result.type !== "battle") throw new Error("battle result is required")
      const effect =
        result.phase.context.party.requireMemberById("player").effects
          .effects[0]
      expect(effect?.lifetime).toEqual({ type: "turns", remaining: 8 })
      expect(effect?.instanceId).toBe("focus-player-status-sequence")
      expect(generatedIds).toEqual([])
    })

    it("presetのaffinity範囲をdialogue effectへ伝播する", () => {
      const npcId = "elda"
      const vault = MOCK_VAULT.withNpcs(
        MOCK_VAULT.npcs.map((npc) =>
          npc.id === npcId
            ? {
                ...npc,
                affinity: 20,
                dialogues: [
                  {
                    id: "bounded-dialogue",
                    minAffinity: 0,
                    lines: [{ speaker: npc.name, text: "選んで" }],
                    options: [
                      {
                        id: "raise",
                        text: "上げる",
                        effects: { affinityChange: 999 },
                      },
                    ],
                  },
                ],
              }
            : npc
        )
      )
      const reducer = new WizRootReducer({
        content: MOCK_CONTENT,
        context: MOCK_CONTEXT,
        shopDialogueService: MOCK_SHOP_DIALOGUE_SERVICE,
        preset: WizPresetValue.create({
          conversation: {
            affinity: {
              minimum: 10,
              maximum: 25,
              levels: [{ id: "bounded", minimum: 10 }],
            },
          },
        }),
      })

      const result = reducer.reduce(toConversationScene(vault, npcId), {
        type: "SELECT_DIALOGUE_OPTION",
        npcId,
        dialogueId: "bounded-dialogue",
        optionId: "raise",
      }).state

      expect(result.vault.findNpc(npcId)?.affinity).toBe(25)
    })
  })

  describe("未知のアクション", () => {
    it("未知のアクションでは state がそのまま返る", () => {
      const newState = reduce(MOCK_INITIAL_STATE, {
        type: "UNKNOWN_ACTION",
      } as never)

      expect(newState).toBe(MOCK_INITIAL_STATE)
    })
  })
})
