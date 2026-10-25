import { describe, expect, it } from "vite-plus/test"
import type { WizExplorationProbabilityConfig } from "@/lib/wiz/core/config/exploration/wiz-exploration-probability-config"
import {
  MOCK_CONTENT,
  MOCK_SHOP_DIALOGUE_SERVICE,
  MOCK_VAULT,
} from "@/lib/wiz/core/mocks/mock-vault"
import type { WizItemEffectApplicationService } from "@/lib/wiz/core/domain/services/item-effect-service"
import { WizEngineExplorationEventProgress } from "@/lib/wiz/core/engine/exploration/event-progress"
import type { WizEngineExplorationEventRewardService } from "@/lib/wiz/core/engine/exploration/event-reward"
import { WizEngineExplorationSkillCheck } from "@/lib/wiz/core/engine/exploration/skill-check"
import { createMockInventoryService, withMockInventory } from "@/lib/wiz/core/mocks/mock-inventory"
import { WizSceneTransitionService } from "@/lib/wiz/core/runtime/scene-transition-service"
import { MOCK_BATTLE_AUTHORITIES } from "@/lib/wiz/core/mocks/mock-battle-authorities"
import { toExplorationScene, toVillageScene } from "@/lib/wiz/core/runtime/scene-transitions"
import { WizSceneExplorationReducer } from "@/lib/wiz/core/runtime/scenes/exploration/reducer"
import { WizDice } from "@/lib/wiz/core/services/wiz-dice"
import type { WizVaultEventState } from "@/lib/wiz/core/vault/states/event/schema"
import type { WizHungerServicePort } from "@/lib/wiz/core/vault/states/player/services/wiz-hunger-service"
import type { WizVaultPlayer } from "@/lib/wiz/core/vault/states/player/value"

const inventoryService = createMockInventoryService(undefined, "exploration-entry")
const createReducer = (dice?: WizDice, probabilityConfig?: WizExplorationProbabilityConfig) => {
  const actualDice = dice ?? new WizDice()
  const skillCheckService = new WizEngineExplorationSkillCheck(actualDice)
  return new WizSceneExplorationReducer({
    content: MOCK_CONTENT,
    dice: actualDice,
    probabilityConfig,
    skillCheckService,
    inventoryService,
  })
}

const transitionService = new WizSceneTransitionService<unknown, unknown, unknown>({
  ...MOCK_BATTLE_AUTHORITIES,
  content: MOCK_CONTENT,
  shopDialogueService: MOCK_SHOP_DIALOGUE_SERVICE,
})
const applyResult = (result: ReturnType<WizSceneExplorationReducer["reduce"]>) =>
  transitionService.applyResult(result).state

const mockMonster = MOCK_VAULT.areas
  .find((area) => area.id === "forest")
  ?.monsters.find((monster) => monster.id === "goblin")
if (!mockMonster) {
  throw new TypeError("Canonical goblin fixture is required")
}

const mockEvent: WizVaultEventState = {
  id: "test-event",
  description: "テストイベントが発生した",
  choices: [
    {
      label: "調べる",
      stat: "wisdom",
      difficulty: 10,
      successText: "何かを発見した!",
      failText: "何も見つからなかった",
      successReward: { gold: 50 },
      failPenalty: { hpLoss: 5 },
    },
    {
      label: "無視する",
      successText: "その場を離れた",
      failText: "",
    },
  ],
}

describe("reduce port", () => {
  it("reduceをbindせず呼べ、実装を差し替えられない", () => {
    const reducer = createReducer()
    const state = toExplorationScene(MOCK_VAULT, "forest")
    const { reduce } = reducer

    const result = reduce(state, { type: "CONTINUE_EXPLORATION" })

    expect(result.state.type).toBe("exploration")
    expect(Object.isFrozen(reducer)).toBe(true)
    expect(Object.isFrozen(WizSceneExplorationReducer.prototype)).toBe(true)
    expect(Object.isFrozen(WizSceneExplorationReducer)).toBe(true)

    const verifyReadonly = () => {
      const replacementReduce = reducer.reduce
      // @ts-expect-error reduceはreadonly function property。
      reducer.reduce = replacementReduce
    }
    void verifyReadonly
  })

  it("reward portを構築時に捕捉して外部差し替えを遮断する", () => {
    const rewardService: {
      applyReward: WizEngineExplorationEventRewardService["applyReward"]
      applyPenalty: WizEngineExplorationEventRewardService["applyPenalty"]
    } = {
      applyReward: (vault) => vault.updatePlayer((player) => player.addGold(7)),
      applyPenalty: (vault) => vault,
    }
    const dice = WizDice.fixed([6, 6])
    const reducer = new WizSceneExplorationReducer({
      content: MOCK_CONTENT,
      dice,
      inventoryService,
      rewardService,
      skillCheckService: new WizEngineExplorationSkillCheck(dice),
    })
    rewardService.applyReward = (vault) => vault.updatePlayer((player) => player.addGold(999))
    rewardService.applyPenalty = (vault) => vault.updatePlayer((player) => player.damage(999))
    const initialGold = MOCK_VAULT.player.gold
    const state = toExplorationScene(MOCK_VAULT, "forest").withEventProgress(
      WizEngineExplorationEventProgress.encounter(mockEvent, 0).toPlain(),
    )

    const result = applyResult(reducer.reduce(state, { type: "ROLL_DICE", eventId: "test-event" }))

    expect(result.vault.player.gold).toBe(initialGold + 7)
  })

  it("item effect portとcontentを所有分離して外部差し替えを遮断する", () => {
    const itemEffectService: {
      apply: WizItemEffectApplicationService<WizVaultPlayer>["apply"]
    } = {
      apply: (target) =>
        Object.freeze({
          applied: true,
          target: target.addHunger(5),
          events: Object.freeze([
            Object.freeze({
              type: "hunger_restored",
              amount: 5,
            }),
          ]),
        }),
    }
    const items = { ...MOCK_CONTENT.items }
    const reducer = new WizSceneExplorationReducer({
      content: { items },
      inventoryService,
      itemEffectService,
    })
    Reflect.deleteProperty(items, "bread")
    itemEffectService.apply = (target) =>
      Object.freeze({
        applied: false,
        target,
        rejection: Object.freeze({ type: "missing_effect" }),
      })
    const vault = withMockInventory(
      MOCK_VAULT.updatePlayer((player) => player.withHunger(50)),
      [{ contentType: "item", contentId: "bread" }],
    )
    const state = toExplorationScene(vault, "forest")

    const result = applyResult(reducer.reduce(state, { type: "EAT_FOOD", itemId: "bread" }))

    expect(result.vault.player.hunger).toBe(55)
    expect(result.vault.inventory.totalQuantity("item", "bread")).toBe(0)
  })

  it("注入した空腹規則を探索の時間経過にも適用する", () => {
    const hungerService = {
      getHungerImpact: () =>
        Object.freeze({
          actionPointReduction: 0,
          abilityPowerMultiplier: 1,
          hpLoss: 7,
        }),
      getHungerState: () => "custom",
    } satisfies WizHungerServicePort
    const reducer = new WizSceneExplorationReducer({
      content: MOCK_CONTENT,
      hungerService,
      inventoryService,
    })
    const state = toExplorationScene(
      MOCK_VAULT.updatePlayer((player) => player.withAp(0)),
      "forest",
    )

    const result = applyResult(
      reducer.reduce(state, {
        type: "EXPLORATION_ACTION",
        areaId: "forest",
        action: "rest",
      }),
    )

    expect(result.vault.player.hp).toBe(state.vault.player.hp - 7)
  })
})

describe("EXPLORATION_ACTION", () => {
  describe("action: explore", () => {
    it("構築後のconfig変更から探索規則を所有分離する", () => {
      const probabilityConfig = {
        monsterEncounterBase: 0,
        eventBase: 0,
        eventMin: 0,
        eventMax: 0,
        eventWeatherCoefficient: 0,
        hungerCostFromDangerLevel: () => 1,
      }
      const reducer = createReducer(WizDice.fixed([6]), probabilityConfig)
      probabilityConfig.monsterEncounterBase = 100
      probabilityConfig.eventMin = 100
      probabilityConfig.eventMax = 100
      probabilityConfig.hungerCostFromDangerLevel = () => 99
      const state = toExplorationScene(MOCK_VAULT, "forest")
      const initialHunger = state.vault.player.hunger

      const result = applyResult(
        reducer.reduce(state, {
          type: "EXPLORATION_ACTION",
          areaId: "forest",
          action: "explore",
        }),
      )

      expect(result.vault.player.hunger).toBe(initialHunger - 1)
    })

    it("探索を進めてエリア進行度が増加する (イベントなし)", () => {
      // 低い値を返すダイスでモンスターもイベントも発生しないようにする
      const dice = WizDice.fixed([1, 1])
      const reducer = createReducer(dice)
      const state = toExplorationScene(MOCK_VAULT, "forest")
      const initialProgress = state.vault.areas.find((a) => a.id === "forest")?.progress ?? 0
      const action = {
        type: "EXPLORATION_ACTION" as const,
        areaId: "forest",
        action: "explore" as const,
      }

      const result = applyResult(reducer.reduce(state, action))

      if (result.type === "exploration") {
        const newProgress = result.vault.areas.find((a) => a.id === "forest")?.progress ?? 0
        expect(newProgress).toBe(initialProgress + 10)
      }
    })

    it("モンスターとエンカウントして戦闘フェーズに遷移する", () => {
      // シードによって結果が変わるので、戦闘になるシードを探す
      const vault = MOCK_VAULT.updateArea("forest", (a) => ({
        ...a,
        monsters: [mockMonster],
      }))
      const state = toExplorationScene(vault, "forest")
      const action = {
        type: "EXPLORATION_ACTION" as const,
        areaId: "forest",
        action: "explore" as const,
      }

      let battleEncountered = false
      for (let seed = 0; seed < 100; seed++) {
        const dice = WizDice.withSeed(seed)
        const reducer = createReducer(dice)
        const result = applyResult(reducer.reduce(state, action))
        if (result.type === "battle") {
          battleEncountered = true
          break
        }
      }
      expect(battleEncountered).toBe(true)
    })

    it("イベントが発生してイベント状態になる", () => {
      // モンスターは発生しないがイベントは発生する確率に設定
      // chance(30)でfalse、chance(25)でtrue になるよう調整
      const dice = WizDice.withSeed(42)
      createReducer(dice)
      const vault = MOCK_VAULT.updateArea("forest", (a) => ({
        ...a,
        monsters: [],
        events: [mockEvent],
      }))
      const state = toExplorationScene(vault, "forest")
      const action = {
        type: "EXPLORATION_ACTION" as const,
        areaId: "forest",
        action: "explore" as const,
      }

      // シードによって結果が変わるので、何度か試行
      let eventEncountered = false
      for (let seed = 0; seed < 100; seed++) {
        const testDice = WizDice.withSeed(seed)
        const testReducer = createReducer(testDice)
        const testResult = applyResult(testReducer.reduce(state, action))
        if (testResult.type === "exploration" && testResult.eventProgress.status === "encounter") {
          eventEncountered = true
          expect(testResult.eventProgress.event).toEqual(mockEvent)
          break
        }
      }
      expect(eventEncountered).toBe(true)
    })

    it("存在しないエリアIDをsemantic reasonとして返す", () => {
      const reducer = createReducer()
      const state = toExplorationScene(MOCK_VAULT, "nonexistent-area")
      const action = {
        type: "EXPLORATION_ACTION" as const,
        areaId: "nonexistent-area",
        action: "explore" as const,
      }

      const result = applyResult(reducer.reduce(state, action))

      expect(result.type).toBe("exploration")
      if (result.type === "exploration") {
        expect(result.message).toEqual({
          type: "action_rejected",
          action: "explore",
          areaId: "nonexistent-area",
          reason: "area_not_found",
        })
      }
    })
  })

  describe("action: gather", () => {
    it("採集可能なアイテムを取得できる", () => {
      const dice = WizDice.fixed([1, 1])
      const reducer = createReducer(dice)
      const vault = MOCK_VAULT.updateArea("forest", (a) => ({
        ...a,
        availableGathering: ["herb"],
      }))
      const state = toExplorationScene(vault, "forest")
      const action = {
        type: "EXPLORATION_ACTION" as const,
        areaId: "forest",
        action: "gather" as const,
      }

      const result = applyResult(reducer.reduce(state, action))

      if (result.type === "exploration") {
        expect(result.message).toEqual({
          type: "items_gathered",
          areaId: "forest",
          itemIds: ["herb", "herb"],
        })
        expect(result.vault.log.filter((message) => message.key === "GATHERED_ITEM")).toEqual([
          { key: "GATHERED_ITEM", itemId: "herb" },
          { key: "GATHERED_ITEM", itemId: "herb" },
        ])
      }
    })

    it("bonus採集品もquest進捗とlogへ反映する", () => {
      const dice = WizDice.fixed([1, 6])
      const reducer = createReducer(dice)
      const vault = MOCK_VAULT.updateArea("forest", (area) => ({
        ...area,
        availableGathering: ["rare_herb", "herb"],
      })).updateQuest("gather_herbs", (quest) => ({ ...quest, accepted: true }))
      const state = toExplorationScene(vault, "forest")

      const result = applyResult(
        reducer.reduce(state, {
          type: "EXPLORATION_ACTION",
          areaId: "forest",
          action: "gather",
        }),
      )

      expect(result.type).toBe("exploration")
      if (result.type === "exploration") {
        expect(result.message).toEqual({
          type: "items_gathered",
          areaId: "forest",
          itemIds: ["rare_herb", "herb"],
        })
        expect(result.vault.findQuest("gather_herbs")?.objective).toMatchObject({
          type: "gather",
          current: 1,
        })
        expect(result.vault.log).toContainEqual({ key: "GATHERED_ITEM", itemId: "rare_herb" })
        expect(result.vault.log).toContainEqual({ key: "GATHERED_ITEM", itemId: "herb" })
      }
    })

    it("採集可能なものがない場合はメッセージを表示", () => {
      const reducer = createReducer()
      const vault = MOCK_VAULT.updateArea("forest", (a) => ({
        ...a,
        availableGathering: [],
      }))
      const state = toExplorationScene(vault, "forest")
      const action = {
        type: "EXPLORATION_ACTION" as const,
        areaId: "forest",
        action: "gather" as const,
      }

      const result = applyResult(reducer.reduce(state, action))

      if (result.type === "exploration") {
        expect(result.message).toEqual({
          type: "gather_rejected",
          areaId: "forest",
          reason: "nothing_available",
        })
      }
    })
  })

  describe("action: hunt", () => {
    it("モンスターを狩って戦闘フェーズに遷移する", () => {
      const dice = WizDice.fixed([1, 1])
      const reducer = createReducer(dice)
      const vault = MOCK_VAULT.updateArea("forest", (a) => ({
        ...a,
        monsters: [mockMonster],
      }))
      const state = toExplorationScene(vault, "forest")
      const action = {
        type: "EXPLORATION_ACTION" as const,
        areaId: "forest",
        action: "hunt" as const,
      }

      const result = applyResult(reducer.reduce(state, action))

      expect(result.type).toBe("battle")
    })

    it("DISCOVERED_MONSTER ログが記録される", () => {
      const dice = WizDice.fixed([1, 1])
      const reducer = createReducer(dice)
      const vault = MOCK_VAULT.updateArea("forest", (a) => ({
        ...a,
        monsters: [mockMonster],
      }))
      const state = toExplorationScene(vault, "forest")
      const action = {
        type: "EXPLORATION_ACTION" as const,
        areaId: "forest",
        action: "hunt" as const,
      }

      const result = applyResult(reducer.reduce(state, action))

      const hasLog = result.vault.log.some((log) => log.key === "DISCOVERED_MONSTER")
      expect(hasLog).toBe(true)
    })

    it("モンスターがいない場合はメッセージを表示", () => {
      const reducer = createReducer()
      const vault = MOCK_VAULT.updateArea("forest", (a) => ({
        ...a,
        monsters: [],
      }))
      const state = toExplorationScene(vault, "forest")
      const action = {
        type: "EXPLORATION_ACTION" as const,
        areaId: "forest",
        action: "hunt" as const,
      }

      const result = applyResult(reducer.reduce(state, action))

      if (result.type === "exploration") {
        expect(result.vault.log).toContainEqual({
          key: "NO_MONSTERS_AVAILABLE",
        })
      }
    })
  })

  it("exploration以外の状態を契約違反として拒否する", () => {
    const reducer = createReducer()
    const villageState = toVillageScene(MOCK_VAULT)
    const action = {
      type: "EXPLORATION_ACTION" as const,
      areaId: "forest",
      action: "explore" as const,
    }

    expect(() =>
      reducer.reduce(
        // @ts-expect-error exploration reducerはexploration stateだけを受理する。
        villageState,
        action,
      ),
    ).toThrow(TypeError)
  })
})

describe("SELECT_EVENT_CHOICE", () => {
  it("イベントの選択肢を選べる", () => {
    const reducer = createReducer()
    const state = toExplorationScene(MOCK_VAULT, "forest").withEventProgress(
      WizEngineExplorationEventProgress.encounter(mockEvent).toPlain(),
    )
    const action = {
      type: "SELECT_EVENT_CHOICE" as const,
      eventId: "test-event",
      choiceIndex: 0,
    }

    const result = applyResult(reducer.reduce(state, action))

    if (result.type === "exploration" && result.eventProgress.status === "encounter") {
      expect(result.eventProgress.choiceIndex).toBe(0)
    }
  })

  it("encounter状態でない場合はsemantic reasonを返す", () => {
    const reducer = createReducer()
    const state = toExplorationScene(MOCK_VAULT, "forest")
    const action = {
      type: "SELECT_EVENT_CHOICE" as const,
      eventId: "test-event",
      choiceIndex: 0,
    }

    const result = applyResult(reducer.reduce(state, action))

    expect(result.type).toBe("exploration")
    if (result.type === "exploration") {
      expect(result.message).toEqual({
        type: "event_choice_rejected",
        reason: "event_not_active",
        choiceIndex: 0,
      })
    }
  })

  it("exploration以外の状態を契約違反として拒否する", () => {
    const reducer = createReducer()
    const villageState = toVillageScene(MOCK_VAULT)
    const action = {
      type: "SELECT_EVENT_CHOICE" as const,
      eventId: "test-event",
      choiceIndex: 0,
    }

    expect(() =>
      reducer.reduce(
        // @ts-expect-error exploration reducerはexploration stateだけを受理する。
        villageState,
        action,
      ),
    ).toThrow(TypeError)
  })
})

describe("semantic rejections", () => {
  it("AP不足をaction reasonとして返す", () => {
    const reducer = createReducer()
    const state = toExplorationScene(
      MOCK_VAULT.updatePlayer((player) => player.withAp(0)),
      "forest",
    )

    const result = applyResult(
      reducer.reduce(state, {
        type: "EXPLORATION_ACTION",
        areaId: "forest",
        action: "explore",
      }),
    )

    expect(result.type).toBe("exploration")
    if (result.type === "exploration") {
      expect(result.message).toEqual({
        type: "action_rejected",
        action: "explore",
        areaId: "forest",
        reason: "not_enough_ap",
      })
    }
  })

  it("AP満タン時の休憩をaction reasonとして返す", () => {
    const reducer = createReducer()
    const state = toExplorationScene(
      MOCK_VAULT.updatePlayer((player) => player.resetAp()),
      "forest",
    )

    const result = applyResult(
      reducer.reduce(state, {
        type: "EXPLORATION_ACTION",
        areaId: "forest",
        action: "rest",
      }),
    )

    expect(result.type).toBe("exploration")
    if (result.type === "exploration") {
      expect(result.message).toEqual({
        type: "action_rejected",
        action: "rest",
        areaId: "forest",
        reason: "already_rested",
      })
    }
  })

  it("食料ではないitemをfood reasonとして返す", () => {
    const reducer = createReducer()
    const state = toExplorationScene(MOCK_VAULT, "forest")

    const result = applyResult(
      reducer.reduce(state, {
        type: "EAT_FOOD",
        itemId: "herb",
      }),
    )

    expect(result.type).toBe("exploration")
    if (result.type === "exploration") {
      expect(result.message).toEqual({
        type: "food_rejected",
        itemId: "herb",
        reason: "not_food",
      })
    }
  })
})

describe("ROLL_DICE", () => {
  it("難易度がない選択肢は自動成功する", () => {
    const reducer = createReducer()
    const state = toExplorationScene(MOCK_VAULT, "forest").withEventProgress(
      WizEngineExplorationEventProgress.encounter(mockEvent, 1).toPlain(),
    )
    const action = { type: "ROLL_DICE" as const, eventId: "test-event" }

    const result = applyResult(reducer.reduce(state, action))

    if (result.type === "exploration" && result.eventProgress.status === "result") {
      expect(result.eventProgress.diceResult.success).toBe(true)
      expect(result.eventProgress.resultText).toBe("その場を離れた")
      expect(result.vault.log.at(-1)).toEqual({
        key: "EVENT_RESOLVED",
        eventId: "test-event",
        succeeded: true,
      })
    }
  })

  it("スキルチェックに成功すると報酬を得る", () => {
    // 高い値を出して成功させる
    const dice = WizDice.fixed([6, 6])
    const reducer = createReducer(dice)
    const initialGold = MOCK_VAULT.player.gold
    const state = toExplorationScene(MOCK_VAULT, "forest").withEventProgress(
      WizEngineExplorationEventProgress.encounter(mockEvent, 0).toPlain(),
    )
    const action = { type: "ROLL_DICE" as const, eventId: "test-event" }

    const result = applyResult(reducer.reduce(state, action))

    if (result.type === "exploration" && result.eventProgress.status === "result") {
      expect(result.eventProgress.diceResult.success).toBe(true)
      expect(result.vault.player.gold).toBe(initialGold + 50)
      expect(result.vault.log.at(-1)).toEqual({
        key: "EVENT_RESOLVED",
        eventId: "test-event",
        succeeded: true,
      })
    }
  })

  it("スキルチェックに失敗するとペナルティを受ける", () => {
    // 低い値を出して失敗させる
    const dice = WizDice.fixed([1, 1])
    const reducer = createReducer(dice)
    const initialHp = MOCK_VAULT.player.hp
    const state = toExplorationScene(MOCK_VAULT, "forest").withEventProgress(
      WizEngineExplorationEventProgress.encounter(mockEvent, 0).toPlain(),
    )
    const action = { type: "ROLL_DICE" as const, eventId: "test-event" }

    const result = applyResult(reducer.reduce(state, action))

    if (result.type === "exploration" && result.eventProgress.status === "result") {
      expect(result.eventProgress.diceResult.success).toBe(false)
      expect(result.vault.player.hp).toBe(initialHp - 5)
      expect(result.vault.log.at(-1)).toEqual({
        key: "EVENT_RESOLVED",
        eventId: "test-event",
        succeeded: false,
      })
    }
  })

  it("選択肢未選択の場合はsemantic reasonを返す", () => {
    const reducer = createReducer()
    const state = toExplorationScene(MOCK_VAULT, "forest").withEventProgress(
      WizEngineExplorationEventProgress.encounter(mockEvent).toPlain(),
    )
    const action = { type: "ROLL_DICE" as const, eventId: "test-event" }

    const result = applyResult(reducer.reduce(state, action))

    expect(result.type).toBe("exploration")
    if (result.type === "exploration") {
      expect(result.message).toEqual({
        type: "event_roll_rejected",
        reason: "choice_not_selected",
      })
    }
  })

  it("encounter状態でない場合はsemantic reasonを返す", () => {
    const reducer = createReducer()
    const state = toExplorationScene(MOCK_VAULT, "forest")
    const action = { type: "ROLL_DICE" as const, eventId: "test-event" }

    const result = applyResult(reducer.reduce(state, action))

    expect(result.type).toBe("exploration")
    if (result.type === "exploration") {
      expect(result.message).toEqual({
        type: "event_roll_rejected",
        reason: "event_not_active",
      })
    }
  })
})

describe("CONTINUE_EXPLORATION", () => {
  it("イベント進行とsemantic messageをリセットする", () => {
    const reducer = createReducer()
    const state = toExplorationScene(MOCK_VAULT, "forest")
      .withEventProgress(WizEngineExplorationEventProgress.encounter(mockEvent, 0).toPlain())
      .withMessage({
        type: "items_gathered",
        areaId: "forest",
        itemIds: ["herb"],
      })
    const action = { type: "CONTINUE_EXPLORATION" as const }

    const result = applyResult(reducer.reduce(state, action))

    if (result.type === "exploration") {
      expect(result.eventProgress.status).toBe("none")
      expect(result.message).toBe(null)
    }
  })

  it("exploration以外の状態を契約違反として拒否する", () => {
    const reducer = createReducer()
    const villageState = toVillageScene(MOCK_VAULT)
    const action = { type: "CONTINUE_EXPLORATION" as const }

    expect(() =>
      reducer.reduce(
        // @ts-expect-error exploration reducerはexploration stateだけを受理する。
        villageState,
        action,
      ),
    ).toThrow(TypeError)
  })
})

describe("未知のアクション", () => {
  it("未知のアクションでは状態を変更しない", () => {
    const reducer = createReducer()
    const state = toExplorationScene(MOCK_VAULT, "forest")
    const action = { type: "UNKNOWN_ACTION" as const }

    const result = applyResult(reducer.reduce(state, action as never))

    expect(result).toBe(state)
  })
})
