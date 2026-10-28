import { describe, expect, expectTypeOf, it } from "vite-plus/test"
import { z } from "zod"
import { WorldSnapshotValidationError } from "@/lib/wiz/core/content/snapshot-rules"
import { WorldContent } from "@/lib/wiz/core/content/world-content"
import type { WizItemEffectApplicationService } from "@/lib/wiz/core/domain/services/item-effect-service"
import { WizEngineBattleExecutionResult } from "@/lib/wiz/core/engine/battle/execution/execution-result"
import { WizEngineBattleTurnIntent } from "@/lib/wiz/core/engine/battle/turn-intent"
import { WizConversationAffinitySystem } from "@/lib/wiz/core/engine/conversation/create-wiz-standard-conversation-affinity-system"
import { WizEngineInn } from "@/lib/wiz/core/engine/inn"
import { WizEngineInnPlanCatalog } from "@/lib/wiz/core/engine/inn/plan-catalog"
import { WizEngineBattleReward } from "@/lib/wiz/core/engine/reward/battle-reward"
import {
  WIZ_IMMUTABLE_VALUE,
  WizImmutableValue,
} from "@/lib/wiz/core/immutable-value"
import type { WizDeepReadonly } from "@/lib/wiz/core/immutable-value"
import {
  WizStandardActionAppliedEvent,
  WizStandardActions,
  WizStandardConfigurationError,
  WizStandardSceneChangedEvent,
  WizStandardStateProvenanceError,
  WizStandardSceneWorld,
} from "@/lib/wiz/core/presets/standard-scene-world"
import type { WizStandardRejectionReason } from "@/lib/wiz/core/presets/standard-scene-world"
import { WizStandardActionValue } from "@/lib/wiz/core/presets/standard-actions/standard-action-value"
import { WizStandardAreaActions } from "@/lib/wiz/core/presets/standard-actions/standard-area-actions"
import { WizStandardBattleActions } from "@/lib/wiz/core/presets/standard-actions/standard-battle-actions"
import { WizStandardDialogueActions } from "@/lib/wiz/core/presets/standard-actions/standard-dialogue-actions"
import { WizStandardEventActions } from "@/lib/wiz/core/presets/standard-actions/standard-event-actions"
import { WizStandardNpcActions } from "@/lib/wiz/core/presets/standard-actions/standard-npc-actions"
import { WizStandardQuestActions } from "@/lib/wiz/core/presets/standard-actions/standard-quest-actions"
import { WizStandardRecipeActions } from "@/lib/wiz/core/presets/standard-actions/standard-recipe-actions"
import { WizStandardShopActions } from "@/lib/wiz/core/presets/standard-actions/standard-shop-actions"
import { WizRpgMechanics } from "@/lib/wiz/core/presets/rpg-mechanics"
import {
  WizStandardRewardCustomCodec,
  WizStandardSessionCodec,
} from "@/lib/wiz/core/presets/standard-session"
import { WizPresetValidationError } from "@/lib/wiz/core/presets/assert-valid-wiz-preset"
import { WizPresetValue } from "@/lib/wiz/core/presets/wiz-preset"
import { WizPluginSceneRegistry } from "@/lib/wiz/core/runtime/plugin/plugin-scene-registry"
import { WizPluginSceneModule } from "@/lib/wiz/core/runtime/plugin/is-authentic-wiz-plugin-scene-module"
import { WizPluginSceneResultFactory } from "@/lib/wiz/core/runtime/plugin/plugin-scene-result"
import {
  type WizSceneAcceptedResultValue,
  WizSceneResultFactory,
} from "@/lib/wiz/core/runtime/scene-result"
import { WizSceneBattleRewardSettlementResult } from "@/lib/wiz/core/runtime/scenes/battle/reward-settlement"
import { toVillageScene } from "@/lib/wiz/core/runtime/to-village-scene"
import { WizWorldSaveSerializationError } from "@/lib/wiz/core/save/world-save-codec"
import { WorldSnapshot } from "@/lib/wiz/core/save/world-snapshot"
import {
  type WizStandardSchemaDefinition,
  WizStandardSchemaValidationError,
} from "@/lib/wiz/core/standard-schema"
import type { WizVaultPlayer } from "@/lib/wiz/core/vault/states/player/value"
import type { WizVaultValue } from "@/lib/wiz/core/vault/value"
import {
  WizWorldEnvironment,
  WizWorldEventReaction,
} from "@/lib/wiz/core/world/world"
import type { WizDefaultTypes } from "@/lib/wiz/core/types/wiz-types"

const CONTENT_INPUT = {
  items: [
    {
      id: "herb",
      name: "Herb",
      description: "A useful herb",
      itemType: "material",
      price: 5,
      sellPrice: 2,
      effect: { type: "heal", value: 5 },
    },
    {
      id: "tonic",
      name: "Tonic",
      description: "Restores health in battle",
      itemType: "consumable",
      price: 10,
      sellPrice: 5,
      effect: { type: "heal", value: 10 },
    },
    {
      id: "ration",
      name: "Ration",
      description: "Restores hunger",
      itemType: "consumable",
      price: 8,
      sellPrice: 4,
      effect: { type: "food", hungerRestore: 20 },
    },
  ],
  weapons: [
    {
      id: "blade",
      name: "Blade",
      description: "A short blade",
      attack: 5,
      dexterityBonus: 0,
      slotId: "mainHand",
      price: 50,
      sellPrice: 25,
    },
  ],
  armors: [
    {
      id: "cloak",
      name: "Cloak",
      description: "A travel cloak",
      defense: 2,
      agilityPenalty: 0,
      slotId: "body",
      price: 40,
      sellPrice: 20,
    },
  ],
  recipes: [
    {
      id: "herb_bundle",
      name: "Herb bundle",
      description: "Bundle herbs",
      materials: [{ type: "item", itemId: "herb", quantity: 1 }],
      result: { type: "item", itemId: "herb" },
      difficulty: 0,
    },
  ],
  monsters: [
    {
      id: "slime",
      name: "Slime",
      hp: 1,
      attack: 0,
      defense: 0,
      agility: 0,
      expReward: 0,
      goldReward: 1,
      drops: [{ itemId: "herb", chance: 100 }],
    },
  ],
  events: [
    {
      id: "old_well",
      description: "An old well",
      choices: [
        {
          label: "Look inside",
          successText: "You found nothing.",
          failText: "You found nothing.",
        },
      ],
    },
  ],
  areas: [
    {
      id: "field",
      name: "Field",
      description: "An open field",
      dangerLevel: 1,
      apCost: 1,
      unlocked: true,
      availableGathering: ["herb"],
      monsterIds: ["slime"],
      eventIds: [],
    },
  ],
  npcs: [
    {
      id: "sage",
      name: "Sage",
      occupation: "Guide",
      personality: "Calm",
      initialAffinity: 3,
      likes: ["herb"],
      dislikes: [],
      dialogues: [
        {
          id: "greeting",
          minAffinity: 0,
          lines: [{ speaker: "Sage", text: "Welcome." }],
          options: [
            { id: "ask", text: "What is this place?", affinityChange: 1 },
          ],
        },
      ],
    },
    {
      id: "merchant",
      name: "Merchant",
      occupation: "Trader",
      personality: "Cheerful",
      initialAffinity: 30,
      likes: [],
      dislikes: [],
      dialogues: [],
    },
  ],
  quests: [
    {
      id: "gather_herb",
      name: "Gather herb",
      description: "Gather herbs",
      giverNpcId: "sage",
      objective: { type: "gather", itemId: "herb", count: 3 },
      reward: { gold: 5, exp: 2, affinityBonus: 1 },
    },
  ],
  abilities: [
    {
      id: "spark",
      name: "Spark",
      description: "A small spark",
      tags: [],
      costs: { mana: 1 },
      effect: {
        type: "damage",
        side: "opponents",
        target: "single",
        element: "fire",
        power: 5,
      },
      custom: {},
    },
  ],
  shopDialogues: [
    {
      shopId: "item",
      shopkeeperName: "Merchant",
      greeting: "Welcome",
      products: {
        itemIds: ["herb", "tonic"],
        weaponIds: [],
        armorIds: [],
      },
      topics: [
        {
          id: "rumor",
          label: "Rumor",
          lines: [{ speaker: "shopkeeper", text: "Quiet roads today." }],
        },
      ],
    },
    {
      shopId: "moonlit_apothecary",
      shopkeeperName: "Luna",
      greeting: "Welcome after dark",
      products: {
        itemIds: ["tonic"],
        weaponIds: [],
        armorIds: [],
      },
      topics: [],
    },
    {
      shopId: "armory",
      shopkeeperName: "Smith",
      greeting: "Choose your gear",
      products: {
        itemIds: [],
        weaponIds: ["blade"],
        armorIds: ["cloak"],
      },
      topics: [],
    },
  ],
  abilityTable: [],
  innPlans: [
    {
      id: "meal",
      price: 12,
      hpRecovery: { fixed: 10 },
      hungerRecovery: 20,
      apRecovery: 1,
    },
    {
      id: "moon-suite",
      price: 80,
      hpRecovery: { percent: 100 },
      mpRecovery: { percent: 100 },
      apRecovery: "full",
    },
  ],
} as const

const CONTENT = WorldContent.create(CONTENT_INPUT)

class GoldItemEffectService implements WizItemEffectApplicationService<WizVaultPlayer> {
  constructor() {
    Object.freeze(this)
  }

  apply(target: WizVaultPlayer) {
    return Object.freeze({
      applied: true as const,
      target: target.addGold(7),
      events: Object.freeze([]),
    })
  }
}

class CampState {
  declare readonly [WIZ_IMMUTABLE_VALUE]: true
  readonly type = "camp"

  constructor(
    readonly vault: WizVaultValue,
    readonly rests: number
  ) {
    WizImmutableValue.freeze(this)
  }

  withVault(vault: WizVaultValue): CampState {
    return new CampState(vault, this.rests)
  }

  updateVault(update: (vault: WizVaultValue) => WizVaultValue): CampState {
    return this.withVault(update(this.vault))
  }

  withRest(): CampState {
    return new CampState(this.vault, this.rests + 1)
  }
}

class ShrineState {
  declare readonly [WIZ_IMMUTABLE_VALUE]: true
  readonly type = "shrine"

  constructor(
    readonly vault: WizVaultValue,
    readonly blessings: number
  ) {
    WizImmutableValue.freeze(this)
  }

  withVault(vault: WizVaultValue): ShrineState {
    return new ShrineState(vault, this.blessings)
  }

  updateVault(update: (vault: WizVaultValue) => WizVaultValue): ShrineState {
    return this.withVault(update(this.vault))
  }

  withBlessing(): ShrineState {
    return new ShrineState(this.vault, this.blessings + 1)
  }
}

const CAMP_MODULE = WizPluginSceneModule.define({
  type: "camp",
  action: z.object({ type: z.literal("REST_AT_CAMP") }).strict(),
  navigation: {
    from: ["village"],
    schema: z.object({}).strict(),
    create: (vault): CampState => new CampState(vault, 0),
  },
  reduce: (state: CampState) =>
    WizPluginSceneResultFactory.accept(state.withRest()),
})
const CAMP_SCENES = WizPluginSceneRegistry.define([CAMP_MODULE])

const verifyReservedPluginActionTypes = (): void => {
  // @ts-expect-error plugin action schemaのliteralにはstandard予約名を使用できない
  const module = WizPluginSceneModule.define({
    type: "camp",
    action: z.object({ type: z.literal("ADVANCE_TIME") }).strict(),
    navigation: {
      from: ["village"],
      schema: z.object({}).strict(),
      create: (vault: WizVaultValue): CampState => new CampState(vault, 0),
    },
    reduce: (state: CampState) => WizPluginSceneResultFactory.accept(state),
  })
  void module
}

void verifyReservedPluginActionTypes

describe("WizStandardSceneWorld", () => {
  it("contentとsnapshotから静的definition + 動的stateを一度に構成する", () => {
    const initial = CONTENT.createInitialSnapshot().toPlain()
    const snapshot = WorldSnapshot.create({
      ...initial,
      player: { ...initial.player, gold: 321 },
      inventory: {
        capacity: 20,
        entries: [
          {
            entryId: "herb-stack",
            contentType: "item",
            contentId: "herb",
            quantity: 2,
          },
          {
            entryId: "blade-entry",
            contentType: "weapon",
            contentId: "blade",
            quantity: 1,
          },
          {
            entryId: "cloak-entry",
            contentType: "armor",
            contentId: "cloak",
            quantity: 1,
          },
        ],
      },
      equipment: {
        mainHand: "blade-entry",
        body: "cloak-entry",
      },
      areas: [{ id: "field", progress: 42, unlocked: true }],
      npcs: [
        { id: "sage", affinity: 17 },
        { id: "merchant", affinity: 30 },
      ],
      quests: [
        { id: "gather_herb", accepted: true, completed: false, progress: 2 },
      ],
      flags: ["intro-seen"],
      log: [{ key: "SEASON_CHANGED", season: "summer" }],
    })

    const world = WizStandardSceneWorld.create({
      content: CONTENT,
      initialSnapshot: snapshot,
      initialTransition: { type: "GO_TO_CRAFTING" },
    })

    expect(world.initialState.type).toBe("crafting")
    expect(world.initialState.vault.player.gold).toBe(321)
    expect(world.initialState.vault.areas[0]).toMatchObject({
      id: "field",
      name: "Field",
      progress: 42,
    })
    expect(world.initialState.vault.npcs[0]).toMatchObject({
      id: "sage",
      name: "Sage",
      affinity: 17,
    })
    expect(world.initialState.vault.quests[0]).toMatchObject({
      id: "gather_herb",
      name: "Gather herb",
      accepted: true,
      objective: { current: 2 },
    })
    expect(world.initialSnapshot).toBe(snapshot)
    expect(Object.isFrozen(world)).toBe(true)
    expect(Object.isFrozen(world.initialState)).toBe(true)
  })

  it("dispatchは純粋な結果を返し、未処理actionを明示的に拒否する", () => {
    const world = WizStandardSceneWorld.create({ content: CONTENT })
    const initialState = world.initialState

    const accepted = world.dispatch(
      initialState,
      world.actions.addLog({ key: "SEASON_CHANGED", season: "summer" })
    )
    const rejected = world.dispatch(initialState, {
      type: "SELECT_RECIPE",
      recipeId: "herb_bundle",
    } as never)
    const injectedEncounter = world.dispatch(initialState, {
      type: "ENCOUNTER_MONSTER",
      monsterId: "slime",
    } as never)
    const unknown = world.dispatch(initialState, {
      type: "NOT_REGISTERED",
    } as never)

    expect(accepted.accepted).toBe(true)
    expect(accepted.error).toBeUndefined()
    expect(accepted.state).not.toBe(initialState)
    expect(accepted.state.vault.log).toHaveLength(
      initialState.vault.log.length + 1
    )
    expect(initialState.vault.log).toEqual([{ key: "WORLD_STARTED" }])
    expect(rejected).toMatchObject({
      accepted: false,
      error: {
        code: "UNHANDLED_ACTION",
        actionType: "SELECT_RECIPE",
      },
    })
    expect(injectedEncounter).toMatchObject({
      accepted: false,
      error: {
        code: "UNHANDLED_ACTION",
        actionType: "ENCOUNTER_MONSTER",
      },
    })
    expect(unknown).toMatchObject({
      accepted: false,
      error: {
        code: "UNHANDLED_ACTION",
        actionType: "NOT_REGISTERED",
      },
    })

    const assertDispatchBoundary = () => {
      // @ts-expect-error built-in commandはworld.actionsから作成する
      world.dispatch(initialState, { type: "USE_ITEM", itemId: "herb" })
      // @ts-expect-error internal transition actionはstandard dispatchへ注入できない
      world.dispatch(initialState, {
        type: "ENCOUNTER_MONSTER",
        monsterId: "slime",
      })
    }
    expect(assertDispatchBoundary).toBeTypeOf("function")
  })

  it("別world由来stateと未登録の派生stateを区別して拒否する", () => {
    const expensiveContent = WorldContent.create({
      ...CONTENT_INPUT,
      areas: [
        {
          ...CONTENT_INPUT.areas[0],
          apCost: 7,
        },
      ],
    })
    const sourceWorld = WizStandardSceneWorld.create({ content: CONTENT })
    const targetWorld = WizStandardSceneWorld.create({
      content: expensiveContent,
    })
    const entered = sourceWorld.dispatch(
      sourceWorld.initialState,
      sourceWorld.actions.area("field").enter()
    )
    expect(entered.state.type).toBe("exploration")
    if (entered.state.type !== "exploration") {
      throw new TypeError("Expected exploration")
    }
    expect(entered.state.vault.areas[0]?.apCost).toBe(1)

    try {
      targetWorld.dispatch(
        entered.state,
        targetWorld.actions.area("field").act("explore")
      )
      throw new TypeError("Expected foreign state rejection")
    } catch (error) {
      expect(error).toBeInstanceOf(WizStandardStateProvenanceError)
      expect(error).toMatchObject({
        code: "FOREIGN_WORLD_STATE",
        stateType: "exploration",
      })
    }

    const detached = entered.state.withMessage(null)
    try {
      targetWorld.dispatch(
        detached,
        targetWorld.actions.area("field").act("explore")
      )
      throw new TypeError("Expected untrusted state rejection")
    } catch (error) {
      expect(error).toBeInstanceOf(WizStandardStateProvenanceError)
      expect(error).toMatchObject({
        code: "UNTRUSTED_WORLD_STATE",
        stateType: "exploration",
      })
    }

    expect(() =>
      sourceWorld.dispatch(
        detached,
        sourceWorld.actions.addLog({ key: "SEASON_CHANGED", season: "summer" })
      )
    ).toThrow(
      expect.objectContaining({
        code: "UNTRUSTED_WORLD_STATE",
        stateType: "exploration",
      })
    )
  })

  it("scene-local with派生値をidentity authorityなしでは再投入できない", () => {
    const expectUntrusted = (
      dispatch: () => unknown,
      stateType: string
    ): void => {
      expect(dispatch).toThrow(
        expect.objectContaining({
          code: "UNTRUSTED_WORLD_STATE",
          stateType,
        })
      )
    }

    const villageWorld = WizStandardSceneWorld.create({ content: CONTENT })
    if (villageWorld.initialState.type !== "village") {
      throw new TypeError("Expected village")
    }
    expectUntrusted(
      () =>
        villageWorld.dispatch(
          villageWorld.initialState.withVault(villageWorld.initialState.vault),
          villageWorld.actions.addLog({
            key: "SEASON_CHANGED",
            season: "summer",
          })
        ),
      "village"
    )

    const conversationWorld = WizStandardSceneWorld.create({
      content: CONTENT,
      initialTransition: { type: "GO_TO_CONVERSATION", npcId: "sage" },
    })
    if (conversationWorld.initialState.type !== "conversation") {
      throw new TypeError("Expected conversation")
    }
    const forgedConversation = conversationWorld.initialState.withProgress(
      conversationWorld.initialState.progress.withPhase("ready_to_complete")
    )
    expectUntrusted(
      () =>
        conversationWorld.dispatch(
          forgedConversation,
          conversationWorld.actions.endConversation()
        ),
      "conversation"
    )

    const shopWorld = WizStandardSceneWorld.create({
      content: CONTENT,
      initialTransition: { type: "GO_TO_SHOP", shopId: "item" },
    })
    if (shopWorld.initialState.type !== "shop") {
      throw new TypeError("Expected shop")
    }
    const forgedShop = shopWorld.initialState.withPendingPurchase({
      type: "item",
      itemId: "herb",
      price: 0,
    })
    expectUntrusted(
      () => shopWorld.dispatch(forgedShop, shopWorld.actions.confirmPurchase()),
      "shop"
    )

    const craftingWorld = WizStandardSceneWorld.create({
      content: CONTENT,
      initialTransition: { type: "GO_TO_CRAFTING" },
    })
    if (craftingWorld.initialState.type !== "crafting") {
      throw new TypeError("Expected crafting")
    }
    const forgedCrafting = craftingWorld.initialState.withSelectedRecipe(
      CONTENT.recipes.herb_bundle
    )
    expectUntrusted(
      () =>
        craftingWorld.dispatch(
          forgedCrafting,
          craftingWorld.actions.confirmCraft()
        ),
      "crafting"
    )

    const levelUpSnapshot = CONTENT.createInitialSnapshot().toPlain()
    const levelUpWorld = WizStandardSceneWorld.create({
      content: CONTENT,
      initialSnapshot: WorldSnapshot.create({
        ...levelUpSnapshot,
        player: {
          ...levelUpSnapshot.player,
          exp: levelUpSnapshot.player.expToNextLevel,
        },
      }),
      initialTransition: { type: "GO_TO_LEVEL_UP", returnAreaId: null },
    })
    if (levelUpWorld.initialState.type !== "level_up") {
      throw new TypeError("Expected level up")
    }
    const forgedLevelUp = levelUpWorld.initialState.withPendingAttributes({
      strength: 999,
    })
    expectUntrusted(
      () =>
        levelUpWorld.dispatch(
          forgedLevelUp,
          levelUpWorld.actions.confirmLevelUp()
        ),
      "level_up"
    )

    const explorationWorld = WizStandardSceneWorld.create({
      content: CONTENT,
      initialTransition: { type: "GO_TO_EXPLORATION", areaId: "field" },
    })
    if (explorationWorld.initialState.type !== "exploration") {
      throw new TypeError("Expected exploration")
    }
    const forgedExploration = explorationWorld.initialState.withMessage({
      type: "event_encountered",
      eventId: "forged-event",
    })
    expectUntrusted(
      () =>
        explorationWorld.dispatch(
          forgedExploration,
          explorationWorld.actions.continueExploration()
        ),
      "exploration"
    )
  })

  it("sceneで適用できない既知actionをsemantic reason付きで拒否する", () => {
    const world = WizStandardSceneWorld.create({ content: CONTENT })

    const result = world.dispatch(
      world.initialState,
      world.actions.equip("unowned-entry", "mainHand")
    )

    expect(result).toMatchObject({
      accepted: false,
      error: {
        actionType: "EQUIP",
        code: "ACTION_REJECTED",
        reason: "INVENTORY_EQUIPMENT_NOT_FOUND",
      },
    })
    expect(result.state).toBe(world.initialState)
  })

  it("探索以外からのcontent-bound monster遭遇をsemantic reason付きで拒否する", () => {
    const world = WizStandardSceneWorld.create({ content: CONTENT })

    const result = world.dispatch(
      world.initialState,
      world.actions.area("field").encounter("slime")
    )

    expect(result).toMatchObject({
      accepted: false,
      error: {
        actionType: "ENCOUNTER_MONSTER",
        code: "ACTION_REJECTED",
        reason: "ENCOUNTER_REQUIRES_EXPLORATION",
      },
    })
    expect(result.state).toBe(world.initialState)
  })

  it("村への直接帰還は探索sceneだけで許可する", () => {
    const world = WizStandardSceneWorld.create({ content: CONTENT })

    const rejected = world.dispatch(
      world.initialState,
      world.actions.returnToVillage()
    )
    const exploration = world.dispatch(
      world.initialState,
      world.actions.area("field").enter()
    )
    const battle = world.dispatch(
      exploration.state,
      world.actions.area("field").encounter("slime")
    )
    const rejectedFromBattle = world.dispatch(
      battle.state,
      world.actions.returnToVillage()
    )
    const returned = world.dispatch(
      exploration.state,
      world.actions.returnToVillage()
    )

    expect(rejected).toMatchObject({
      accepted: false,
      error: {
        actionType: "RETURN_TO_VILLAGE",
        code: "ACTION_REJECTED",
        reason: "ACTION_NOT_ALLOWED_IN_SCENE",
      },
    })
    expect(rejected.state).toBe(world.initialState)
    expect(exploration.accepted).toBe(true)
    expect(battle.accepted).toBe(true)
    expect(rejectedFromBattle).toMatchObject({
      accepted: false,
      error: {
        actionType: "RETURN_TO_VILLAGE",
        code: "ACTION_REJECTED",
        reason: "ACTION_NOT_ALLOWED_IN_SCENE",
      },
    })
    expect(rejectedFromBattle.state).toBe(battle.state)
    expect(returned.accepted).toBe(true)
    expect(returned.state.type).toBe("village")
  })

  it("battle中のinventory操作を拒否しbattle item actionだけを許可する", () => {
    const initial = CONTENT.createInitialSnapshot().toPlain()
    const world = WizStandardSceneWorld.create({
      content: CONTENT,
      initialSnapshot: {
        ...initial,
        inventory: {
          ...initial.inventory,
          entries: [
            {
              entryId: "herb-stack",
              contentType: "item",
              contentId: "herb",
              quantity: 1,
            },
          ],
        },
      },
    })
    const exploration = world.dispatch(
      world.initialState,
      world.actions.area("field").enter()
    )
    const encounter = world.dispatch(
      exploration.state,
      world.actions.area("field").encounter("slime")
    )
    const battle = world.dispatch(encounter.state, world.actions.battle.start())

    expect(battle.accepted).toBe(true)
    expect(battle.state.type).toBe("battle")

    const forbiddenActions = [
      world.actions.useItem("herb"),
      world.actions.equip("blade-entry", "mainHand"),
      world.actions.equip("cloak-entry", "body"),
      world.actions.unequip("mainHand"),
      world.actions.unequip("body"),
    ]
    for (const action of forbiddenActions) {
      const result = world.dispatch(battle.state, action)
      expect(result).toMatchObject({
        accepted: false,
        error: {
          actionType: action.type,
          code: "ACTION_REJECTED",
          reason: "ACTION_NOT_ALLOWED_IN_SCENE",
        },
      })
      expect(result.state).toBe(battle.state)
    }

    const battleItem = world.dispatch(
      battle.state,
      world.actions.battle.useItem("player", "herb", ["player"])
    )
    expect(battleItem.accepted).toBe(true)
    expect(battleItem.state.type).toBe("battle")
    expect(battleItem.state).not.toBe(battle.state)
  })

  it("任意のcontent shopIdへ移動し、unknown IDをaction生成時に拒否する", () => {
    const world = WizStandardSceneWorld.create({ content: CONTENT })

    const entered = world.dispatch(
      world.initialState,
      world.actions.shop("moonlit_apothecary").enter()
    )

    expect(entered.accepted).toBe(true)
    expect(entered.state.type).toBe("shop")
    if (entered.state.type === "shop") {
      expect(entered.state.shopId).toBe("moonlit_apothecary")
    }
    expect(() => world.actions.shop("missing_shop" as never)).toThrow(
      RangeError
    )
  })

  it("scene固有のsemantic rejectionを元stateを保ったまま返す", () => {
    const world = WizStandardSceneWorld.create({ content: CONTENT })
    const questBoard = world.dispatch(
      world.initialState,
      world.actions.openQuestBoard()
    )

    expect(questBoard.accepted).toBe(true)
    expect(questBoard.state.type).toBe("quest")

    const result = world.dispatch(
      questBoard.state,
      world.actions.completeQuest()
    )

    expect(result).toMatchObject({
      accepted: false,
      error: {
        actionType: "COMPLETE_QUEST",
        code: "ACTION_REJECTED",
        reason: "QUEST_COMPLETION_REJECTED",
      },
    })
    expect(result.state).toBe(questBoard.state)
  })

  it("探索からvictoryまでのbattle state graphをdeep immutableに保つ", () => {
    const world = WizStandardSceneWorld.create({
      content: CONTENT,
      environment: WizWorldEnvironment.create({
        random: () => 0.99,
        nextId: () => "battle-action",
        now: () => 100,
      }),
    })
    const exploration = world.dispatch(
      world.initialState,
      world.actions.area("field").enter()
    )
    expect(exploration.accepted).toBe(true)
    expect(exploration.state.type).toBe("exploration")

    const encounter = world.dispatch(
      exploration.state,
      world.actions.area("field").encounter("slime")
    )
    expect(encounter.accepted).toBe(true)
    expect(encounter.state.type).toBe("battle")
    if (encounter.state.type !== "battle") {
      throw new TypeError("Expected an encounter battle")
    }

    const encounterMonster =
      encounter.state.phase.context.enemies.getAllMonsters()[0]
    const encounterCustom = encounterMonster.custom as {
      readonly drops: readonly {
        readonly itemId: string
        readonly chance: number
      }[]
    }
    expect(encounter.state.phase.phase).toBe("encounter")
    expect(encounterMonster.status.attributes.value("attack")).toBe(0)
    expect(encounterCustom.drops).toEqual([{ itemId: "herb", chance: 100 }])
    expect(Object.isFrozen(encounterCustom)).toBe(true)
    expect(Object.isFrozen(encounterCustom.drops)).toBe(true)
    expect(Object.isFrozen(encounterCustom.drops[0])).toBe(true)

    const started = world.dispatch(
      encounter.state,
      world.actions.battle.start()
    )
    expect(started.accepted).toBe(true)
    expect(started.state.type).toBe("battle")
    if (
      started.state.type !== "battle" ||
      started.state.phase.phase !== "turnOrder"
    ) {
      throw new TypeError("Expected a turn-order battle")
    }
    expect(Object.isFrozen(started.state.phase)).toBe(true)
    expect(Object.isFrozen(started.state.phase.context)).toBe(true)
    expect(Object.isFrozen(started.state.phase.turnOrder)).toBe(true)
    expect(Object.isFrozen(started.state.phase.turnOrder[0])).toBe(true)
    expect(
      (started.state.phase as unknown as Readonly<Record<string, unknown>>)
        .rewardCalculator
    ).toBeUndefined()

    const victory = world.dispatch(
      started.state,
      world.actions.battle.attack("player", "slime_0")
    )
    expect(victory.accepted).toBe(true)
    expect(victory.state.type).toBe("battle")
    if (
      victory.state.type !== "battle" ||
      victory.state.phase.phase !== "victory"
    ) {
      throw new TypeError("Expected a victory battle")
    }
    const reward = victory.state.phase.reward
    expect(reward).toBeDefined()
    expect(reward?.droppedItems).toEqual([{ itemId: "herb", quantity: 1 }])
    expect(victory.state.vault.inventory.totalQuantity("item", "herb")).toBe(1)
    expect(Object.isFrozen(reward)).toBe(true)
    expect(Object.isFrozen(reward?.droppedItems)).toBe(true)
    expect(Object.isFrozen(reward?.droppedItems[0])).toBe(true)
    expect(
      (victory.state.phase as unknown as Readonly<Record<string, unknown>>)
        .rewardCalculator
    ).toBeUndefined()

    const codec = WizStandardSessionCodec.create({
      contentVersion: "content-v1",
    })
    const envelope = world.save(victory.state, codec)
    if (
      envelope.snapshot.scene.type !== "battle" ||
      envelope.snapshot.scene.phase.phase !== "victory" ||
      envelope.snapshot.scene.phase.reward === undefined
    ) {
      throw new TypeError("Expected a captured victory reward")
    }
    expect(Object.hasOwn(envelope.snapshot.scene.phase.reward, "custom")).toBe(
      false
    )
    const parsed = codec.parse(JSON.parse(JSON.stringify(envelope)))
    const restored = world.restore(parsed, codec)
    expect(restored.type).toBe("battle")
    if (restored.type !== "battle" || restored.phase.phase !== "victory") {
      throw new TypeError("Expected a restored victory reward")
    }
    expect(restored.phase.reward?.custom).toBeUndefined()
  })

  it("custom mechanicsをbattleのturn・実行・報酬確定まで一つの型付き定義で適用する", () => {
    type SoulReward = Readonly<{ souls: number }>
    const factoryContexts: object[] = []
    const mechanics = WizRpgMechanics.defineForContent(CONTENT, {
      battleExecutor: (context) => {
        factoryContexts.push(context)
        return {
          execute: (action, party, enemies) =>
            WizEngineBattleExecutionResult.accept({
              party,
              enemies: enemies.withDamageToAll(9999),
              logs: [],
              success: context.environment.clock() === 77,
              action,
            }),
        }
      },
      turnOrderPolicy: (context) => {
        factoryContexts.push(context)
        return {
          order: (battle) => [
            ...battle.party
              .getActableMembers()
              .map((character) => character.id),
            ...battle.enemies
              .getAllAliveMonsters()
              .map((monster) => monster.id),
          ],
        }
      },
      rewardCalculator: (context) => {
        factoryContexts.push(context)
        return {
          calculate: () =>
            new WizEngineBattleReward({
              experience: 100,
              gold: 50,
              droppedItems: [{ itemId: "herb", quantity: 2 }],
              custom: { souls: 3 },
            }),
        }
      },
      rewardSettlement: (context) => {
        factoryContexts.push(context)
        return {
          settle: ({ vault, reward }) =>
            WizSceneBattleRewardSettlementResult.accept(
              vault.addFlag(
                `${context.content.items.herb.name.toLowerCase()}:souls:${reward.custom.souls}`
              )
            ),
        }
      },
    })
    const world = WizStandardSceneWorld.create({
      content: CONTENT,
      environment: WizWorldEnvironment.create({
        nextId: () => "custom-mechanics-id",
        now: () => 77,
        random: () => 0.99,
      }),
      mechanics,
    })
    const exploration = world.dispatch(
      world.initialState,
      world.actions.area("field").enter()
    )
    const encounter = world.dispatch(
      exploration.state,
      world.actions.area("field").encounter("slime")
    )
    const started = world.dispatch(
      encounter.state,
      world.actions.battle.start()
    )
    if (
      started.state.type !== "battle" ||
      started.state.phase.phase !== "turnOrder"
    ) {
      throw new TypeError("Expected custom battle turn")
    }
    expect(started.state.phase.getCurrentActor()?.id).toBe("player")
    const goldBefore = started.state.vault.player.gold
    const progressBefore = started.state.vault.findArea("field")?.progress

    const victory = world.dispatch(
      started.state,
      world.actions.battle.attack("player", "slime_0")
    )

    expect(victory.accepted).toBe(true)
    expect(victory.state.type).toBe("battle")
    if (victory.state.type !== "battle") {
      throw new TypeError("Expected custom battle result")
    }
    if (victory.state.phase.phase !== "victory") {
      throw new TypeError("Expected custom battle victory")
    }
    expectTypeOf(victory.state.phase.reward?.custom).toEqualTypeOf<
      SoulReward | undefined
    >()
    expect(victory.state.phase.reward?.custom.souls).toBe(3)
    expect(victory.state.vault.hasFlag("herb:souls:3")).toBe(true)
    expect(victory.state.vault.player.gold).toBe(goldBefore)
    expect(victory.state.vault.inventory.totalQuantity("item", "herb")).toBe(0)
    expect(victory.state.vault.findArea("field")?.progress).toBe(progressBefore)
    expect(
      victory.state.vault.log.some(
        (message) => message.key === "BATTLE_VICTORY"
      )
    ).toBe(false)
    expect(factoryContexts).toHaveLength(4)
    expect(new Set(factoryContexts).size).toBe(1)
    expect(Object.isFrozen(factoryContexts[0])).toBe(true)

    let rewardCustomValidationCount = 0
    const rewardCustomCodec = WizStandardRewardCustomCodec.define({
      schema: z
        .strictObject({ storedSouls: z.number() })
        .transform((input) => {
          rewardCustomValidationCount += 1
          return { souls: input.storedSouls + 1 }
        })
        .readonly(),
      capture: (custom) => ({ storedSouls: custom.souls - 1 }),
    })
    const codec = WizStandardSessionCodec.create({
      contentVersion: "content-v1",
      rewardCustom: rewardCustomCodec,
    })
    const envelope = world.save(victory.state, codec)
    expect(rewardCustomValidationCount).toBe(1)
    if (
      envelope.snapshot.scene.type !== "battle" ||
      envelope.snapshot.scene.phase.phase !== "victory"
    ) {
      throw new TypeError("Expected captured custom battle victory")
    }
    expect(envelope.snapshot.scene.phase.reward?.custom.storedSouls).toBe(2)
    const parsed = codec.parse(JSON.parse(JSON.stringify(envelope)))
    expect(rewardCustomValidationCount).toBe(2)
    const restored = world.restore(parsed, codec)
    if (restored.type !== "battle" || restored.phase.phase !== "victory") {
      throw new TypeError("Expected restored custom battle victory")
    }
    expectTypeOf(restored.phase.reward?.custom).toEqualTypeOf<
      SoulReward | undefined
    >()
    expect(restored.phase.reward?.custom.souls).toBe(3)
    expect(Object.isFrozen(restored.phase.reward?.custom)).toBe(true)
    expect(rewardCustomValidationCount).toBe(2)

    const directSnapshot = world.session(victory.state, codec)
    expect(rewardCustomValidationCount).toBe(3)
    const directlyRestored = world.restore(directSnapshot, codec)
    if (
      directlyRestored.type !== "battle" ||
      directlyRestored.phase.phase !== "victory"
    ) {
      throw new TypeError("Expected a directly restored custom battle victory")
    }
    expect(directlyRestored.phase.reward?.custom.souls).toBe(3)
    expect(rewardCustomValidationCount).toBe(3)

    const invalidEnvelope = JSON.parse(JSON.stringify(envelope))
    invalidEnvelope.snapshot.scene.phase.reward.custom.storedSouls = "invalid"
    expect(() => world.restore(invalidEnvelope, codec)).toThrow(
      WizStandardSchemaValidationError
    )

    const refinedCaptureCodec = WizStandardRewardCustomCodec.define({
      schema: z
        .strictObject({ storedSouls: z.number().nonnegative() })
        .transform((input) => ({ souls: input.storedSouls })),
      capture: (custom) => ({ storedSouls: custom.souls }),
    })
    expect(() => refinedCaptureCodec.capture({ souls: -1 })).toThrow(
      WizStandardSchemaValidationError
    )

    const unsafeCaptureCodec = WizStandardRewardCustomCodec.define({
      schema: z
        .strictObject({ payload: z.unknown() })
        .transform(() => ({ souls: 1 })),
      capture: () => ({ payload: new Date(0) }),
    })
    expect(() => unsafeCaptureCodec.capture({ souls: 1 })).toThrow(
      WizWorldSaveSerializationError
    )

    const verifyRewardCodecType = (): void => {
      const defaultCodec = WizStandardSessionCodec.create({
        contentVersion: "content-v1",
      })
      // @ts-expect-error custom reward world requires a matching reward schema codec
      world.save(victory.state, defaultCodec)
    }
    void verifyRewardCodecType
  })

  it("contentの宿泊IDを保ったまま宿泊計算だけを差し替える", () => {
    const mechanics = WizRpgMechanics.defineForContent(CONTENT, {
      innService: () =>
        new WizEngineInn(
          new WizEngineInnPlanCatalog([
            {
              id: "meal",
              price: 0,
              hpRecovery: { fixed: 1 },
            },
          ])
        ),
    })
    const world = WizStandardSceneWorld.create({
      content: CONTENT,
      mechanics,
    })
    const initialGold = world.initialState.vault.player.gold
    const entered = world.dispatch(world.initialState, world.actions.enterInn())
    const selected = world.dispatch(
      entered.state,
      world.actions.selectStayPlan("meal")
    )
    const stayed = world.dispatch(selected.state, world.actions.confirmStay())

    expect(stayed.accepted).toBe(true)
    expect(stayed.state.type).toBe("village")
    expect(stayed.state.vault.player.gold).toBe(initialGold)
  })

  it("custom affinity level IDを会話完了からsemantic logまで保つ", () => {
    const mechanics = WizRpgMechanics.defineForContent(CONTENT, {
      affinitySystem: () =>
        new WizConversationAffinitySystem({
          minimum: 0,
          maximum: 100,
          levels: [
            { id: "unknown", minimum: 0 },
            { id: "known", minimum: 4 },
          ] as const,
        }),
    })
    const world = WizStandardSceneWorld.create({
      content: CONTENT,
      mechanics,
    })
    const entered = world.dispatch(
      world.initialState,
      world.actions.npc("sage").talk()
    )
    const selected = world.dispatch(
      entered.state,
      world.actions.npc("sage").dialogue("greeting").choose("ask")
    )
    const completed = world.dispatch(
      selected.state,
      world.actions.endConversation()
    )

    expect(completed.accepted).toBe(true)
    expect(completed.state.type).toBe("village")
    expect(completed.state.vault.findNpc("sage")?.affinity).toBe(4)
    expect(completed.state.vault.log.at(-1)).toEqual({
      key: "AFFINITY_LEVEL_CHANGED",
      npcId: "sage",
      level: "known",
    })
  })

  it("custom affinity systemをinitial snapshotのauthorityとして使う", () => {
    const content = WorldContent.create({
      npcs: [
        {
          id: "outsider",
          name: "Outsider",
          occupation: "Wanderer",
          personality: "Wary",
          initialAffinity: -5,
          likes: [],
          dislikes: [],
          dialogues: [],
        },
      ],
    } as const)
    const mechanics = WizRpgMechanics.defineForContent(content, {
      affinitySystem: () =>
        new WizConversationAffinitySystem({
          minimum: -10,
          maximum: 10,
          levels: [
            { id: "hostile", minimum: -10 },
            { id: "neutral", minimum: 0 },
          ] as const,
        }),
    })

    expect(() => WizStandardSceneWorld.create({ content })).toThrow(
      WizStandardConfigurationError
    )

    const world = WizStandardSceneWorld.create({ content, mechanics })

    expect(world.initialState.vault.findNpc("outsider")?.affinity).toBe(-5)

    const codec = WizStandardSessionCodec.create({
      contentVersion: "custom-affinity-v1",
    })
    const envelope = JSON.parse(
      JSON.stringify(world.save(world.initialState, codec))
    )
    envelope.snapshot.world.npcs[0].affinity = 11

    expect(() => world.restore(envelope, codec)).toThrow(
      WizStandardConfigurationError
    )
  })

  it("initial transition後のroot再構築でも同じresolved mechanicsとcontent literal型を使う", () => {
    let factoryCalls = 0
    let reducerCalls = 0
    const world = WizStandardSceneWorld.create({
      content: CONTENT,
      initialTransition: { type: "GO_TO_EXPLORATION", areaId: "field" },
      mechanics: WizRpgMechanics.defineForContent(CONTENT, {
        explorationReducer: (context) => {
          factoryCalls += 1
          const herbName: "Herb" = context.content.items.herb.name
          return {
            reduce: (state) => {
              reducerCalls += 1
              return WizSceneResultFactory.accept(
                state.updateVault((vault) =>
                  vault.addFlag(`mechanics:${herbName}`)
                )
              )
            },
          }
        },
      }),
    })

    const result = world.dispatch(
      world.initialState,
      world.actions.area("field").act("rest")
    )

    expect(result.accepted).toBe(true)
    expect(result.state.vault.hasFlag("mechanics:Herb")).toBe(true)
    expect(factoryCalls).toBe(1)
    expect(reducerCalls).toBe(1)
  })

  it("custom mechanicsのliteral rejection reasonを推論してworld全体へ伝播する", () => {
    const mechanics = WizRpgMechanics.defineForContent(CONTENT, {
      battleExecutor: () => ({
        execute: (_action, party, enemies) =>
          WizEngineBattleExecutionResult.reject({
            party,
            enemies,
            reason: "CUSTOM_EXECUTION_REJECTED",
          }),
      }),
      rewardCalculator: () => ({
        calculate: () =>
          new WizEngineBattleReward({
            custom: undefined,
            experience: 0,
            gold: 0,
          }),
      }),
      rewardSettlement: () => ({
        settle: ({ vault }) =>
          WizSceneBattleRewardSettlementResult.reject(
            vault,
            "CUSTOM_SETTLEMENT_REJECTED"
          ),
      }),
      explorationReducer: () => ({
        reduce: (state) =>
          WizSceneResultFactory.reject(state, "CUSTOM_EXPLORATION_REJECTED"),
      }),
    })
    const world = WizStandardSceneWorld.create({
      content: CONTENT,
      initialTransition: { type: "GO_TO_EXPLORATION", areaId: "field" },
      mechanics,
    })

    const dispatch = world.dispatch(
      world.initialState,
      world.actions.area("field").act("rest")
    )
    expect(dispatch).toMatchObject({
      accepted: false,
      error: {
        code: "ACTION_REJECTED",
        reason: "CUSTOM_EXPLORATION_REJECTED",
      },
    })
    if (dispatch.isRejected() && dispatch.error.code === "ACTION_REJECTED") {
      expectTypeOf(dispatch.error.reason).toEqualTypeOf<
        WizStandardRejectionReason<
          never,
          | "CUSTOM_EXECUTION_REJECTED"
          | "CUSTOM_EXPLORATION_REJECTED"
          | "CUSTOM_SETTLEMENT_REJECTED"
        >
      >()
    }

    const navigation = world.navigate(world.initialState, {
      type: "GO_TO_VILLAGE",
    })
    if (navigation.accepted === false) {
      expectTypeOf(navigation.reason).toEqualTypeOf<
        WizStandardRejectionReason<
          never,
          | "CUSTOM_EXECUTION_REJECTED"
          | "CUSTOM_EXPLORATION_REJECTED"
          | "CUSTOM_SETTLEMENT_REJECTED"
        >
      >()
    }
  })

  it("custom mechanicsのwide string rejection reasonを型境界で拒否する", () => {
    const wideReason: string = "CUSTOM_WIDE_REJECTION"
    const verifyWideReasonRejection = () => {
      // @ts-expect-error mechanics rejection reasonは有限なliteral unionでなければならない。
      WizRpgMechanics.defineForContent(CONTENT, {
        battleExecutor: () => ({
          execute: (_action, party, enemies) =>
            WizEngineBattleExecutionResult.reject({
              party,
              enemies,
              reason: wideReason,
            }),
        }),
      })
    }

    expect(typeof verifyWideReasonRejection).toBe("function")
  })

  it("withで追加したliteral rejection reasonも既存reasonとのunionで伝播する", () => {
    const mechanics = WizRpgMechanics.defineForContent(CONTENT, {
      explorationReducer: () => ({
        reduce: (state) =>
          WizSceneResultFactory.reject(state, "BASE_MECHANICS_REJECTED"),
      }),
    }).with({
      battleExecutor: () => ({
        execute: (_action, party, enemies) =>
          WizEngineBattleExecutionResult.reject({
            party,
            enemies,
            reason: "PATCH_MECHANICS_REJECTED",
          }),
      }),
    })
    const world = WizStandardSceneWorld.create({
      content: CONTENT,
      initialTransition: { type: "GO_TO_EXPLORATION", areaId: "field" },
      mechanics,
    })
    const dispatch = world.dispatch(
      world.initialState,
      world.actions.area("field").act("rest")
    )

    expect(dispatch).toMatchObject({
      accepted: false,
      error: {
        code: "ACTION_REJECTED",
        reason: "BASE_MECHANICS_REJECTED",
      },
    })
    if (dispatch.isRejected() && dispatch.error.code === "ACTION_REJECTED") {
      expectTypeOf(dispatch.error.reason).toEqualTypeOf<
        WizStandardRejectionReason<
          never,
          "BASE_MECHANICS_REJECTED" | "PATCH_MECHANICS_REJECTED"
        >
      >()
    }
  })

  it("custom mechanics reducerのraw scene resultをroot authority境界で拒否する", () => {
    const mechanics = WizRpgMechanics.defineForContent(CONTENT, {
      explorationReducer: () => ({
        reduce: (state) =>
          ({
            accepted: true,
            events: [],
            state,
          }) as unknown as WizSceneAcceptedResultValue<typeof state>,
      }),
    })
    const world = WizStandardSceneWorld.create({
      content: CONTENT,
      initialTransition: { type: "GO_TO_EXPLORATION", areaId: "field" },
      mechanics,
    })

    expect(() =>
      world.dispatch(
        world.initialState,
        world.actions.area("field").act("rest")
      )
    ).toThrow("Scene reducer must return an authentic WizSceneResult")
  })

  it("custom mechanics reducerのscene直接変更をroot authority境界で拒否する", () => {
    const mechanics = WizRpgMechanics.defineForContent(CONTENT, {
      explorationReducer: () => ({
        reduce: (state) =>
          WizSceneResultFactory.accept(
            toVillageScene(state.vault)
          ) as unknown as WizSceneAcceptedResultValue<typeof state>,
      }),
    })
    const world = WizStandardSceneWorld.create({
      content: CONTENT,
      initialTransition: { type: "GO_TO_EXPLORATION", areaId: "field" },
      mechanics,
    })

    expect(() =>
      world.dispatch(
        world.initialState,
        world.actions.area("field").act("rest")
      )
    ).toThrow(
      'Scene reducer for "exploration" returned state for "village" without a transition'
    )
  })

  it("custom mechanicsのenvironment読み取りをrejection時にtransaction rollbackする", () => {
    let nextIdCalls = 0
    let nowCalls = 0
    const executionIds: string[] = []
    const executionTimes: number[] = []
    const mechanics = WizRpgMechanics.defineForContent(CONTENT, {
      battleExecutor: (context) => ({
        execute: (_action, party, enemies) => {
          executionIds.push(context.environment.nextId())
          executionTimes.push(context.environment.clock())
          return WizEngineBattleExecutionResult.reject({
            party,
            enemies,
            reason: "BATTLE_ACTION_REJECTED",
          })
        },
      }),
    })
    const world = WizStandardSceneWorld.create({
      content: CONTENT,
      environment: WizWorldEnvironment.create({
        nextId: () => `mechanics-${++nextIdCalls}`,
        now: () => ++nowCalls,
        random: () => 0.99,
      }),
      mechanics,
    })
    const exploration = world.dispatch(
      world.initialState,
      world.actions.area("field").enter()
    )
    const encounter = world.dispatch(
      exploration.state,
      world.actions.area("field").encounter("slime")
    )
    const started = world.dispatch(
      encounter.state,
      world.actions.battle.start()
    )
    const setupNextIdCalls = nextIdCalls
    const action = world.actions.battle.attack("player", "slime_0")

    const first = world.dispatch(started.state, action)
    const nextIdCallsAfterFirst = nextIdCalls
    const second = world.dispatch(started.state, action)

    expect(first.accepted).toBe(false)
    expect(second.accepted).toBe(false)
    expect(first.error).toMatchObject({
      code: "ACTION_REJECTED",
      reason: "BATTLE_ACTION_REJECTED",
    })
    expect(first.state).toBe(started.state)
    expect(second.state).toBe(started.state)
    expect(executionIds).toEqual([executionIds[0], executionIds[0]])
    expect(executionTimes).toEqual([executionTimes[0], executionTimes[0]])
    expect(nextIdCallsAfterFirst).toBe(setupNextIdCalls + 2)
    expect(nextIdCalls).toBe(nextIdCallsAfterFirst)
    expect(nowCalls).toBe(1)
  })

  it("saveへbehaviorを含めず、restore後は復元先worldの現在mechanicsを使う", () => {
    const sourceMechanics = WizRpgMechanics.define<
      WizDefaultTypes,
      undefined,
      typeof CONTENT.arrays
    >({
      battleExecutor: () => ({
        execute: () => {
          throw new Error("source-behavior-must-not-run")
        },
      }),
      turnOrderPolicy: () => ({
        order: (battle) => [
          ...battle.party.getActableMembers().map((character) => character.id),
          ...battle.enemies.getAllAliveMonsters().map((monster) => monster.id),
        ],
      }),
    })
    const sourceWorld = WizStandardSceneWorld.create({
      content: CONTENT,
      environment: WizWorldEnvironment.create({
        nextId: () => "source-id",
        random: () => 0.99,
      }),
      mechanics: sourceMechanics,
    })
    const exploration = sourceWorld.dispatch(
      sourceWorld.initialState,
      sourceWorld.actions.area("field").enter()
    )
    const encounter = sourceWorld.dispatch(
      exploration.state,
      sourceWorld.actions.area("field").encounter("slime")
    )
    const started = sourceWorld.dispatch(
      encounter.state,
      sourceWorld.actions.battle.start()
    )
    const codec = WizStandardSessionCodec.create({
      contentVersion: "content-v1",
    })
    const envelope = sourceWorld.save(started.state, codec)

    expect(JSON.stringify(envelope)).not.toContain(
      "source-behavior-must-not-run"
    )
    expect(JSON.stringify(envelope)).not.toContain("mechanics")

    const targetMechanics = WizRpgMechanics.define<
      WizDefaultTypes,
      undefined,
      typeof CONTENT.arrays
    >({
      battleExecutor: () => ({
        execute: (action, party, enemies) =>
          WizEngineBattleExecutionResult.accept({
            party,
            enemies: enemies.withDamageToAll(9999),
            logs: [],
            success: true,
            action,
          }),
      }),
      rewardCalculator: () => ({
        calculate: () =>
          new WizEngineBattleReward({
            experience: 0,
            gold: 0,
            custom: undefined,
          }),
      }),
      rewardSettlement: () => ({
        settle: ({ vault }) =>
          WizSceneBattleRewardSettlementResult.accept(
            vault.addFlag("target-mechanics-applied")
          ),
      }),
    })
    const targetWorld = WizStandardSceneWorld.create({
      content: CONTENT,
      environment: WizWorldEnvironment.create({
        nextId: () => "target-id",
        random: () => 0.99,
      }),
      mechanics: targetMechanics,
    })
    const restored = targetWorld.restore(envelope, codec)
    if (restored.type !== "battle" || restored.phase.phase !== "turnOrder") {
      throw new TypeError("Expected restored battle turn")
    }

    const result = targetWorld.dispatch(
      restored,
      targetWorld.actions.battle.attack("player", "slime_0")
    )

    expect(result.accepted).toBe(true)
    expect(result.state.vault.hasFlag("target-mechanics-applied")).toBe(true)
  })

  it("battle intentのIDをtransaction内だけで採番しrejection後に再利用する", () => {
    let nextIdCalls = 0
    const world = WizStandardSceneWorld.create({
      content: CONTENT,
      environment: WizWorldEnvironment.create({
        nextId: () => `turn-${++nextIdCalls}`,
        random: () => 0.99,
      }),
    })
    const exploration = world.dispatch(
      world.initialState,
      world.actions.area("field").enter()
    )
    const encounter = world.dispatch(
      exploration.state,
      world.actions.area("field").encounter("slime")
    )
    const started = world.dispatch(
      encounter.state,
      world.actions.battle.start()
    )
    const setupIdCalls = nextIdCalls
    const rejectedIntent = world.actions.battle.attack(
      "missing-actor",
      "slime_0"
    )

    expect(nextIdCalls).toBe(setupIdCalls)
    const rejected = world.dispatch(started.state, rejectedIntent)

    expect(rejected.accepted).toBe(false)
    expect(rejected.state).toBe(started.state)
    expect(nextIdCalls).toBe(setupIdCalls + 1)

    const acceptedIntent = world.actions.battle.attack("player", "slime_0")
    expect(nextIdCalls).toBe(setupIdCalls + 1)
    const accepted = world.dispatch(started.state, acceptedIntent)

    expect(accepted.accepted).toBe(true)
    expect(nextIdCalls).toBe(setupIdCalls + 2)
    expect(accepted.state.type).toBe("battle")
    if (accepted.state.type !== "battle") {
      throw new TypeError("Expected battle state")
    }
    expect(accepted.state.phase.context.executedActions.at(-1)?.id).toBe(
      `turn-${setupIdCalls + 1}`
    )
  })

  it("prototype偽装したbattle intentをmaterializeせずIDも消費しない", () => {
    let nextIdCalls = 0
    const world = WizStandardSceneWorld.create({
      content: CONTENT,
      environment: WizWorldEnvironment.create({
        nextId: () => `forged-turn-${++nextIdCalls}`,
        random: () => 0.99,
      }),
    })
    const exploration = world.dispatch(
      world.initialState,
      world.actions.area("field").enter()
    )
    const encounter = world.dispatch(
      exploration.state,
      world.actions.area("field").encounter("slime")
    )
    const started = world.dispatch(
      encounter.state,
      world.actions.battle.start()
    )
    const setupIdCalls = nextIdCalls
    const forgedIntent = Object.create(WizEngineBattleTurnIntent.prototype)
    Object.defineProperties(forgedIntent, {
      type: { enumerable: true, value: "attack" },
      actorId: { enumerable: true, value: "player" },
      targetIds: { enumerable: true, value: Object.freeze(["slime_0"]) },
      abilityId: { enumerable: true, value: null },
      itemId: { enumerable: true, value: null },
    })
    WizImmutableValue.freeze(forgedIntent)
    const action = Object.freeze({
      type: "BATTLE_EXECUTE_INTENT",
      intent: forgedIntent,
    }) as never

    const result = world.dispatch(started.state, action)

    expect(result).toMatchObject({
      accepted: false,
      error: {
        actionType: "BATTLE_EXECUTE_INTENT",
        code: "UNHANDLED_ACTION",
      },
    })
    expect(result.state).toBe(started.state)
    expect(nextIdCalls).toBe(setupIdCalls)
  })

  it("battle intent materialize後の例外でもIDをrollbackして再利用する", () => {
    let nextIdCalls = 0
    const world = WizStandardSceneWorld.create({
      content: CONTENT,
      environment: WizWorldEnvironment.create({
        nextId: () => `throw-turn-${++nextIdCalls}`,
        random: () => 0.99,
      }),
    })
    const exploration = world.dispatch(
      world.initialState,
      world.actions.area("field").enter()
    )
    const encounter = world.dispatch(
      exploration.state,
      world.actions.area("field").encounter("slime")
    )
    const started = world.dispatch(
      encounter.state,
      world.actions.battle.start()
    )
    const setupIdCalls = nextIdCalls
    const intent = world.actions.battle.attack("player", "slime_0")
    const reaction = WizWorldEventReaction.define<
      unknown,
      WizStandardActionAppliedEvent
    >({
      name: "throw-after-battle-materialization",
      accepts: (event): event is WizStandardActionAppliedEvent =>
        event instanceof WizStandardActionAppliedEvent &&
        event.action.type === "BATTLE_EXECUTE_INTENT",
      react: () => {
        throw new Error("reaction failed")
      },
    })
    const kernel = Reflect.get(world, "kernel")
    const throwingKernel = kernel.withReaction(reaction)

    expect(nextIdCalls).toBe(setupIdCalls)
    expect(() => throwingKernel.dispatch(started.state, intent)).toThrow(
      "reaction failed"
    )
    expect(nextIdCalls).toBe(setupIdCalls + 2)

    const accepted = world.dispatch(started.state, intent)
    expect(accepted.accepted).toBe(true)
    expect(nextIdCalls).toBe(setupIdCalls + 2)
    expect(accepted.state.type).toBe("battle")
    if (accepted.state.type !== "battle") {
      throw new TypeError("Expected battle state")
    }
    expect(accepted.state.phase.context.executedActions.at(-1)?.id).toBe(
      `throw-turn-${setupIdCalls + 1}`
    )
  })

  it("content literal IDだけを受け取るimmutable actionsを公開する", () => {
    const targetIds = ["enemy-1"]
    const encounteredIds = ["enemy-1"]
    let nextId = 0
    const world = WizStandardSceneWorld.create({
      content: CONTENT,
      environment: WizWorldEnvironment.create({
        nextId: () => `action-${++nextId}`,
      }),
    })
    const initialState = world.initialState
    const verifyExactActionPayloads = () => {
      const areaId: "field" = world.actions.area("field").enter().areaId
      const npcId: "sage" = world.actions.npc("sage").talk().npcId
      const recipeId: "herb_bundle" = world.actions
        .recipe("herb_bundle")
        .select().recipeId
      const itemId: "herb" = world.actions.useItem("herb").itemId
      const weaponEntryId: "blade-entry" = world.actions.equip(
        "blade-entry",
        "mainHand"
      ).entryId
      const armorEntryId: "cloak-entry" = world.actions.equip(
        "cloak-entry",
        "body"
      ).entryId
      const questId: "gather_herb" = world.actions
        .quest("gather_herb")
        .select().questId
      const monsterId: "slime" = world.actions
        .area("field")
        .encounter("slime").monsterId
      const foodItemId: "ration" = world.actions.eatFood("ration").itemId
      const dialogueOptionId: "ask" = world.actions
        .npc("sage")
        .dialogue("greeting")
        .choose("ask").optionId
      const giftItemId: "herb" = world.actions.selectGift("herb").itemId
      const choiceIndex: 0 = world.actions
        .event("old_well")
        .choose(0).choiceIndex
      const villageAction: "explore" =
        world.actions.selectVillageAction("explore").action
      const explorationAction: "gather" = world.actions
        .area("field")
        .act("gather").action
      const stayPlan: "meal" = world.actions.selectStayPlan("meal").plan
      const attribute: "wisdom" =
        world.actions.allocateAttribute("wisdom").attribute
      const itemShop = world.actions.shop("item")
      const shopId: "item" = itemShop.enter().shopId
      const shopItemId: "herb" = itemShop.selectItemToBuy("herb").itemId
      const shopTopicId: "rumor" = itemShop.startConversation("rumor").topicId
      const battleSkill = world.actions.battle.useAbility("hero", "spark", [
        "enemy-1",
      ] as const)
      const battleActorId: "hero" = battleSkill.intent.actorId
      const battleSkillId: "spark" = battleSkill.intent.abilityId
      const battleTargetIds: readonly ["enemy-1"] = battleSkill.intent.targetIds
      const mutableBattleTargets = ["enemy-1"]
      const battleWithMutableInput = world.actions.battle.useAbility(
        "hero",
        "spark",
        mutableBattleTargets
      )
      // @ts-expect-error action factoryの出力はmutable配列入力からもdeep readonlyになる
      battleWithMutableInput.intent.targetIds.push("enemy-2")
      const log = world.actions.addLog({
        key: "ENCOUNTER_MONSTERS",
        monsterIds: ["enemy-1"],
      })
      const logKey: "ENCOUNTER_MONSTERS" = log.message.key
      const loggedMonsterIds: readonly ["enemy-1"] = log.message.monsterIds
      const mutableLoggedMonsterIds = ["enemy-1"]
      const logWithMutableInput = world.actions.addLog({
        key: "ENCOUNTER_MONSTERS",
        monsterIds: mutableLoggedMonsterIds,
      })
      // @ts-expect-error semantic log payloadもmutable配列入力からdeep readonlyになる
      logWithMutableInput.message.monsterIds.push("enemy-2")
      void [
        areaId,
        npcId,
        recipeId,
        itemId,
        weaponEntryId,
        armorEntryId,
        questId,
        monsterId,
        foodItemId,
        dialogueOptionId,
        giftItemId,
        choiceIndex,
        villageAction,
        explorationAction,
        stayPlan,
        attribute,
        shopId,
        shopItemId,
        shopTopicId,
        battleActorId,
        battleSkillId,
        battleTargetIds,
        logKey,
        loggedMonsterIds,
      ]
    }
    void verifyExactActionPayloads

    const wideAreaId: string = "field"
    const wideNpcId: string = "sage"
    const wideEventId: string = "old_well"
    const wideRecipeId: string = "herb_bundle"
    const wideQuestId: string = "gather_herb"
    const wideShopId: string = "item"
    const wideMonsterId: string = "slime"
    const wideDialogueId: string = "greeting"
    const wideOptionId: string = "ask"
    const wideChoiceIndex: number = 0
    const wideShopItemId: string = "herb"
    const wideShopTopicId: string = "rumor"
    const wideBattleAbilityId: string = "spark"
    const wideBattleItemId: string = "tonic"
    const wideItemId: string = "herb"
    const wideFoodItemId: string = "ration"
    const wideEquipmentSlotId: string = "mainHand"
    const wideVillageAction: string = "explore"
    const wideExplorationAction: string = "gather"
    const wideStayPlan: string = "meal"
    const wideAttribute: string = "wisdom"
    const wideArea = world.actions.area(wideAreaId)
    const wideNpc = world.actions.npc(wideNpcId)
    const wideEvent = world.actions.event(wideEventId)
    const wideRecipe = world.actions.recipe(wideRecipeId)
    const wideQuest = world.actions.quest(wideQuestId)
    const wideShop = world.actions.shop(wideShopId)

    expectTypeOf(wideArea.areaId).toEqualTypeOf<"field">()
    expectTypeOf(wideNpc.npcId).toEqualTypeOf<"sage" | "merchant">()
    expectTypeOf(wideEvent.eventId).toEqualTypeOf<"old_well">()
    expectTypeOf(wideRecipe.recipeId).toEqualTypeOf<"herb_bundle">()
    expectTypeOf(wideQuest.questId).toEqualTypeOf<"gather_herb">()
    expectTypeOf(wideShop.shopId).toEqualTypeOf<
      "item" | "moonlit_apothecary" | "armory"
    >()
    expectTypeOf(
      wideArea.encounter(wideMonsterId).monsterId
    ).toEqualTypeOf<"slime">()
    expectTypeOf(
      wideNpc.dialogue(wideDialogueId).dialogueId
    ).toEqualTypeOf<"greeting">()
    expectTypeOf(
      wideNpc.dialogue("greeting").choose(wideOptionId).optionId
    ).toEqualTypeOf<"ask">()
    expectTypeOf(
      wideEvent.choose(wideChoiceIndex).choiceIndex
    ).toEqualTypeOf<0>()
    expectTypeOf(wideShop.selectItemToBuy(wideShopItemId).itemId).toEqualTypeOf<
      "herb" | "tonic"
    >()
    expectTypeOf(
      wideShop.startConversation(wideShopTopicId).topicId
    ).toEqualTypeOf<"rumor">()
    expectTypeOf(
      world.actions.battle.useAbility("hero", wideBattleAbilityId, ["enemy-1"])
        .intent.abilityId
    ).toEqualTypeOf<"spark">()
    expectTypeOf(
      world.actions.battle.useItem("hero", wideBattleItemId, ["enemy-1"]).intent
        .itemId
    ).toEqualTypeOf<"tonic" | "herb">()
    expectTypeOf(world.actions.sellItem(wideItemId).itemId).toEqualTypeOf<
      "herb" | "tonic" | "ration"
    >()
    expectTypeOf(
      world.actions.eatFood(wideFoodItemId).itemId
    ).toEqualTypeOf<"ration">()
    expectTypeOf(world.actions.selectGift(wideItemId).itemId).toEqualTypeOf<
      "herb" | "tonic" | "ration"
    >()
    expectTypeOf(world.actions.useItem(wideItemId).itemId).toEqualTypeOf<
      "herb" | "tonic" | "ration"
    >()
    expectTypeOf(
      world.actions.equip("entry-id", wideEquipmentSlotId).slotId
    ).toEqualTypeOf<"mainHand" | "body">()
    expectTypeOf(
      world.actions.selectVillageAction(wideVillageAction).action
    ).toEqualTypeOf<"explore" | "shop" | "quest" | "talk" | "home" | "inn">()
    expectTypeOf(
      world.actions.area("field").act(wideExplorationAction).action
    ).toEqualTypeOf<"explore" | "gather" | "hunt" | "rest">()
    expectTypeOf(world.actions.selectStayPlan(wideStayPlan).plan).toEqualTypeOf<
      "meal" | "moon-suite"
    >()
    expectTypeOf(
      world.actions.allocateAttribute(wideAttribute).attribute
    ).toEqualTypeOf<
      "strength" | "dexterity" | "agility" | "vitality" | "wisdom" | "charisma"
    >()

    expect(world.actions.area("field").enter()).toEqual({
      type: "GO_TO_EXPLORATION",
      areaId: "field",
    })
    expect(world.actions.npc("sage").talk()).toEqual({
      type: "TALK_TO_NPC",
      npcId: "sage",
    })
    expect(world.actions.recipe("herb_bundle").select()).toEqual({
      type: "SELECT_RECIPE",
      recipeId: "herb_bundle",
    })
    expect(world.actions.useItem("herb")).toEqual({
      type: "USE_ITEM",
      itemId: "herb",
    })
    expect(world.actions.equip("blade-entry", "mainHand")).toEqual({
      type: "EQUIP",
      slotId: "mainHand",
      entryId: "blade-entry",
    })
    expect(world.actions.equip("cloak-entry", "body")).toEqual({
      type: "EQUIP",
      slotId: "body",
      entryId: "cloak-entry",
    })
    expect(world.actions.quest("gather_herb").select()).toEqual({
      type: "SELECT_QUEST",
      questId: "gather_herb",
    })
    const itemShop = world.actions.shop("item")
    const moonlitShop = world.actions.shop("moonlit_apothecary")
    expect(itemShop).toBeInstanceOf(WizStandardShopActions)
    expect(world.actions.useItem("herb")).toBeInstanceOf(WizStandardActionValue)
    expect(itemShop.enter()).toEqual({ type: "GO_TO_SHOP", shopId: "item" })
    expect(itemShop.selectItemToBuy("herb")).toEqual({
      type: "SELECT_ITEM_TO_BUY",
      shopId: "item",
      itemId: "herb",
    })
    expect(itemShop.startConversation("rumor")).toEqual({
      type: "START_SHOP_CONVERSATION",
      shopId: "item",
      topicId: "rumor",
    })
    expect(moonlitShop.selectItemToBuy("tonic")).toEqual({
      type: "SELECT_ITEM_TO_BUY",
      shopId: "moonlit_apothecary",
      itemId: "tonic",
    })
    expect(Object.isFrozen(itemShop)).toBe(true)

    const skill = world.actions.battle.useAbility("hero", "spark", targetIds)
    const item = world.actions.battle.useItem("hero", "tonic", targetIds)
    const log = world.actions.addLog({
      key: "ENCOUNTER_MONSTERS",
      monsterIds: encounteredIds,
    })
    const effectEvents = [{ type: "hp_restored" as const, amount: 1 }]
    const effectLog = world.actions.addLog({
      key: "ITEM_EFFECT_APPLIED",
      itemId: "herb",
      events: effectEvents,
    })
    targetIds.push("enemy-2")
    encounteredIds.push("enemy-2")
    effectEvents[0].amount = 99
    effectEvents.push({ type: "hp_restored", amount: 2 })

    expect(skill.intent).toMatchObject({
      abilityId: "spark",
      targetIds: ["enemy-1"],
    })
    expect(item.intent).toMatchObject({
      itemId: "tonic",
      targetIds: ["enemy-1"],
    })
    expect(nextId).toBe(0)
    expect(log.message).toEqual({
      key: "ENCOUNTER_MONSTERS",
      monsterIds: ["enemy-1"],
    })
    expect(effectLog.message).toEqual({
      key: "ITEM_EFFECT_APPLIED",
      itemId: "herb",
      events: [{ type: "hp_restored", amount: 1 }],
    })
    expect(Object.isFrozen(skill)).toBe(true)
    expect(Object.isFrozen(skill.intent.targetIds)).toBe(true)
    expect(Object.isFrozen(log.message)).toBe(true)
    if (log.message.key !== "ENCOUNTER_MONSTERS") {
      throw new TypeError("Expected an encounter log action")
    }
    expect(Object.isFrozen(log.message.monsterIds)).toBe(true)
    if (effectLog.message.key !== "ITEM_EFFECT_APPLIED") {
      throw new TypeError("Expected an item effect log action")
    }
    expect(Object.isFrozen(effectLog.message.events)).toBe(true)
    expect(Object.isFrozen(effectLog.message.events[0])).toBe(true)

    const assertContentIds = () => {
      // @ts-expect-error contentにないarea IDは受け付けない
      world.actions.area("unknown-area").enter()
      // @ts-expect-error contentにないNPC IDは受け付けない
      world.actions.npc("unknown-npc").talk()
      // @ts-expect-error contentにないevent IDは受け付けない
      world.actions.event("unknown-event").roll()
      // @ts-expect-error contentにないrecipe IDは受け付けない
      world.actions.recipe("unknown-recipe").select()
      // @ts-expect-error contentにないquest IDは受け付けない
      world.actions.quest("unknown-quest").select()
      // @ts-expect-error contentにないbattle ability IDは受け付けない
      world.actions.battle.useAbility("hero", "unknown-skill", ["enemy-1"])
      // @ts-expect-error contentにないbattle item IDは受け付けない
      world.actions.battle.useItem("hero", "unknown-battle-item", ["enemy-1"])
      // @ts-expect-error battle abilityのtargetIdsは空tupleを受け付けない
      world.actions.battle.useAbility("hero", "spark", [])
      // @ts-expect-error battle itemのtargetIdsは空tupleを受け付けない
      world.actions.battle.useItem("hero", "tonic", [])
      // @ts-expect-error areaに属さないmonster IDは受け付けない
      world.actions.area("field").encounter("unknown-monster")
      // @ts-expect-error NPCに属さないdialogue IDは受け付けない
      world.actions.npc("sage").dialogue("unknown-dialogue")
      // @ts-expect-error dialogueに属さないoption IDは受け付けない
      world.actions.npc("sage").dialogue("greeting").choose("unknown-option")
      // @ts-expect-error event tupleにないchoice indexは受け付けない
      world.actions.event("old_well").choose(1)
      // @ts-expect-error item shopではweaponを販売していない
      itemShop.selectWeaponToBuy("blade")
      // @ts-expect-error moonlit shopではherbを販売していない
      moonlitShop.selectItemToBuy("herb")
      // @ts-expect-error rumor topicはitem shopだけに属する
      moonlitShop.startConversation("rumor")
      // @ts-expect-error contentにないshop IDはscopeを作れない
      world.actions.shop("unknown-shop")
      // @ts-expect-error contentにないitemは販売できない
      world.actions.sellItem("unknown-item")
      // @ts-expect-error food effectではないitemは食べられない
      world.actions.eatFood("tonic")
      // @ts-expect-error contentにないitemはgiftにできない
      world.actions.selectGift("unknown-item")
      // @ts-expect-error contentにないitemは使用できない
      world.actions.useItem("unknown-item")
      // @ts-expect-error contentにないslotへは装備できない
      world.actions.equip("entry-id", "unknown-slot")
      // @ts-expect-error 定義されていないvillage actionは選べない
      world.actions.selectVillageAction("unknown-action")
      // @ts-expect-error 定義されていないexploration actionは選べない
      world.actions.area("field").act("unknown-action")
      // @ts-expect-error 定義されていないstay planは選べない
      world.actions.selectStayPlan("unknown-plan")
      // @ts-expect-error 定義されていないattributeは選べない
      world.actions.allocateAttribute("unknown-attribute")
    }
    expect(assertContentIds).toBeTypeOf("function")
    const unknownId: string = "unknown"
    const unknownIndex: number = 1
    expect(() => world.actions.area(unknownId)).toThrow(RangeError)
    expect(() => world.actions.npc(unknownId)).toThrow(RangeError)
    expect(() => world.actions.event(unknownId)).toThrow(RangeError)
    expect(() => world.actions.recipe(unknownId)).toThrow(RangeError)
    expect(() => world.actions.quest(unknownId)).toThrow(RangeError)
    expect(() => world.actions.shop(unknownId)).toThrow(RangeError)
    expect(() => world.actions.area("field").encounter(unknownId)).toThrow(
      RangeError
    )
    expect(() => world.actions.npc("sage").dialogue(unknownId)).toThrow(
      RangeError
    )
    expect(() =>
      world.actions.npc("sage").dialogue("greeting").choose(unknownId)
    ).toThrow(RangeError)
    expect(() => world.actions.event("old_well").choose(unknownIndex)).toThrow(
      RangeError
    )
    expect(() => world.actions.shop("item").selectItemToBuy(unknownId)).toThrow(
      RangeError
    )
    expect(() =>
      world.actions.shop("item").startConversation(unknownId)
    ).toThrow(RangeError)
    expect(() =>
      world.actions.battle.useAbility("hero", unknownId, ["enemy-1"])
    ).toThrow(RangeError)
    expect(() =>
      world.actions.battle.useItem("hero", unknownId, ["enemy-1"])
    ).toThrow(RangeError)
    expect(() => world.actions.sellItem(unknownId)).toThrow(RangeError)
    expect(() => world.actions.eatFood(unknownId)).toThrow(RangeError)
    expect(() => world.actions.eatFood("tonic" as never)).toThrow(RangeError)
    expect(() => world.actions.selectGift(unknownId)).toThrow(RangeError)
    expect(() => world.actions.useItem(unknownId)).toThrow(RangeError)
    expect(() => world.actions.equip("entry-id", unknownId)).toThrow(RangeError)
    expect(() => world.actions.selectVillageAction(unknownId)).toThrow(
      RangeError
    )
    expect(() => world.actions.area("field").act(unknownId)).toThrow(RangeError)
    expect(() => world.actions.selectStayPlan(unknownId)).toThrow(RangeError)
    expect(() => world.actions.allocateAttribute(unknownId)).toThrow(RangeError)
    expect(() => world.actions.addLog({ key: "UNKNOWN_LOG" } as never)).toThrow(
      TypeError
    )
    expect(world.initialState).toBe(initialState)
    expect(nextId).toBe(0)
  })

  it("action originを観測・factory hookできずforeign built-in actionを拒否する", () => {
    const actionFactoryClasses = [
      WizStandardActionValue,
      WizStandardActions,
      WizStandardAreaActions,
      WizStandardBattleActions,
      WizStandardDialogueActions,
      WizStandardEventActions,
      WizStandardNpcActions,
      WizStandardQuestActions,
      WizStandardRecipeActions,
      WizStandardShopActions,
    ] as const
    for (const actionFactoryClass of actionFactoryClasses) {
      expect(Object.isFrozen(actionFactoryClass)).toBe(true)
      expect(Object.isFrozen(actionFactoryClass.prototype)).toBe(true)
    }

    const originalCreate = Reflect.get(WizStandardActionValue, "create")
    expect(originalCreate).toBeTypeOf("function")
    expect(
      Reflect.set(
        WizStandardActionValue,
        "create",
        (...parameters: unknown[]) => {
          void parameters
          throw new TypeError("hooked")
        }
      )
    ).toBe(false)

    const world = WizStandardSceneWorld.create({ content: CONTENT })
    expect(Reflect.get(world, "actionOrigin")).toBeUndefined()
    expect(Reflect.ownKeys(world)).not.toContain("actionOrigin")
    expect(world.actions.advanceTime()).toEqual({ type: "ADVANCE_TIME" })

    expect(() =>
      Reflect.apply(originalCreate, WizStandardActionValue, [
        Symbol("foreign-action-origin"),
        { type: "ADVANCE_TIME" },
      ])
    ).toThrow(
      "WizStandardActionValue must be created by a standard action factory"
    )

    const foreignWorld = WizStandardSceneWorld.create({ content: CONTENT })
    const foreignAction = foreignWorld.actions.advanceTime()
    const result = world.dispatch(world.initialState, foreignAction)

    expect(result).toMatchObject({
      accepted: false,
      error: {
        actionType: "ADVANCE_TIME",
        code: "UNHANDLED_ACTION",
      },
    })
  })

  it("prototypeだけを偽造したreserved actionをcanonical actionとして受理しない", () => {
    const world = WizStandardSceneWorld.create({ content: CONTENT })
    const forgedAction = Object.create(WizStandardActionValue.prototype) as {
      type: "ADVANCE_TIME"
    }
    Object.defineProperty(forgedAction, "type", {
      configurable: false,
      enumerable: true,
      value: "ADVANCE_TIME",
      writable: false,
    })
    Object.freeze(forgedAction)

    expect(forgedAction).toBeInstanceOf(WizStandardActionValue)
    const result = world.dispatch(
      world.initialState,
      forgedAction as Parameters<typeof world.dispatch>[1]
    )

    expect(result).toMatchObject({
      accepted: false,
      error: {
        actionType: "ADVANCE_TIME",
        code: "ACTION_VALIDATION_FAILED",
        diagnostics: [
          {
            kind: "ownership",
            moduleName: "standard-runtime",
          },
        ],
      },
    })
  })

  it("Proxy getterを呼ばずdescriptor所有した一つのactionだけでprovenanceを判定する", () => {
    let getterReads = 0
    let environmentReads = 0
    const world = WizStandardSceneWorld.create({
      content: CONTENT,
      environment: WizWorldEnvironment.create({
        nextId: () => {
          environmentReads += 1

          return "proxy-action-id"
        },
        now: () => {
          environmentReads += 1

          return 0
        },
        random: () => {
          environmentReads += 1

          return 0
        },
      }),
    })
    const proxyAction = new Proxy(
      { type: "ADVANCE_TIME" },
      {
        get: (target, property, receiver) => {
          getterReads += 1

          return property === "type"
            ? getterReads <= 2
              ? "NOT_REGISTERED"
              : "ADVANCE_TIME"
            : Reflect.get(target, property, receiver)
        },
      }
    )
    const proxyDispatch = world.dispatch(
      world.initialState,
      proxyAction as never
    )

    expect(proxyDispatch).toMatchObject({
      accepted: false,
      error: {
        actionType: "ADVANCE_TIME",
        code: "UNHANDLED_ACTION",
      },
    })
    expect(proxyDispatch.state).toBe(world.initialState)
    expect(getterReads).toBe(0)
    expect(environmentReads).toBe(0)

    const accessorAction = Object.create(null)
    Object.defineProperty(accessorAction, "type", {
      enumerable: true,
      get: () => {
        getterReads += 1

        return "ADVANCE_TIME"
      },
    })
    const accessorDispatch = world.dispatch(world.initialState, accessorAction)

    expect(accessorDispatch).toMatchObject({
      accepted: false,
      error: {
        code: "ACTION_VALIDATION_FAILED",
        diagnostics: [
          {
            kind: "ownership",
            moduleName: "standard-runtime",
            path: "$.type",
          },
        ],
      },
    })
    expect(accessorDispatch.state).toBe(world.initialState)
    expect(getterReads).toBe(0)
    expect(environmentReads).toBe(0)
  })

  it("別world由来のbuilt-in actionを処理せずIDも消費しない", () => {
    const sourceWorld = WizStandardSceneWorld.create({ content: CONTENT })
    let nextIdCalls = 0
    const targetWorld = WizStandardSceneWorld.create({
      content: CONTENT,
      environment: WizWorldEnvironment.create({
        nextId: () => `target-action-${++nextIdCalls}`,
      }),
    })
    const foreignIntent = sourceWorld.actions.battle.attack("player", "slime_0")

    expect(nextIdCalls).toBe(0)
    const result = targetWorld.dispatch(targetWorld.initialState, foreignIntent)

    expect(result).toMatchObject({
      accepted: false,
      error: {
        actionType: "BATTLE_EXECUTE_INTENT",
        code: "UNHANDLED_ACTION",
      },
    })
    expect(nextIdCalls).toBe(0)
  })

  it("scope IDと現在sceneの相関違反をstable reasonで拒否する", () => {
    const correlatedContent = WorldContent.create({
      ...CONTENT_INPUT,
      areas: [
        ...CONTENT_INPUT.areas,
        {
          id: "cave",
          name: "Cave",
          description: "A dark cave",
          dangerLevel: 2,
          apCost: 1,
          unlocked: true,
          availableGathering: ["herb"],
          monsterIds: ["slime"],
          eventIds: [],
        },
      ],
      npcs: [
        {
          ...CONTENT_INPUT.npcs[0],
          dialogues: [
            ...CONTENT_INPUT.npcs[0].dialogues,
            {
              id: "secret",
              minAffinity: 99,
              lines: [{ speaker: "Sage", text: "Not yet." }],
              options: [{ id: "leave", text: "Leave." }],
            },
          ],
        },
        {
          ...CONTENT_INPUT.npcs[1],
          dialogues: [
            {
              id: "trade",
              minAffinity: 0,
              lines: [{ speaker: "Merchant", text: "Browse my wares." }],
              options: [{ id: "browse", text: "Show me." }],
            },
          ],
        },
      ],
    } as const)
    const world = WizStandardSceneWorld.create({ content: correlatedContent })
    const exploration = world.dispatch(
      world.initialState,
      world.actions.area("field").enter()
    )

    expect(
      world.dispatch(
        exploration.state,
        world.actions.area("cave").act("gather")
      )
    ).toMatchObject({
      accepted: false,
      error: {
        actionType: "EXPLORATION_ACTION",
        code: "ACTION_REJECTED",
        reason: "AREA_SCOPE_MISMATCH",
      },
    })
    expect(
      world.dispatch(
        exploration.state,
        world.actions.event("old_well").choose(0)
      )
    ).toMatchObject({
      accepted: false,
      error: {
        actionType: "SELECT_EVENT_CHOICE",
        code: "ACTION_REJECTED",
        reason: "EVENT_SCOPE_MISMATCH",
      },
    })

    const conversation = world.dispatch(
      world.initialState,
      world.actions.npc("sage").talk()
    )
    expect(
      world.dispatch(
        conversation.state,
        world.actions.npc("merchant").dialogue("trade").choose("browse")
      )
    ).toMatchObject({
      accepted: false,
      error: {
        actionType: "SELECT_DIALOGUE_OPTION",
        code: "ACTION_REJECTED",
        reason: "NPC_SCOPE_MISMATCH",
      },
    })
    expect(
      world.dispatch(
        conversation.state,
        world.actions.npc("sage").dialogue("secret").choose("leave")
      )
    ).toMatchObject({
      accepted: false,
      error: {
        actionType: "SELECT_DIALOGUE_OPTION",
        code: "ACTION_REJECTED",
        reason: "DIALOGUE_SCOPE_MISMATCH",
      },
    })

    const shop = world.dispatch(
      world.initialState,
      world.actions.shop("item").enter()
    )
    expect(
      world.dispatch(
        shop.state,
        world.actions.shop("moonlit_apothecary").selectItemToBuy("tonic")
      )
    ).toMatchObject({
      accepted: false,
      error: {
        actionType: "SELECT_ITEM_TO_BUY",
        code: "ACTION_REJECTED",
        reason: "SHOP_SCOPE_MISMATCH",
      },
    })
  })

  it("全built-in sceneを手書きunionなしで操作できる", () => {
    const world = WizStandardSceneWorld.create({ content: CONTENT })
    const itemShop = world.actions.shop("item")
    const armory = world.actions.shop("armory")
    const actions = [
      world.actions.selectVillageAction("explore"),
      itemShop.enter(),
      world.actions.enterInn(),
      world.actions.openQuestBoard(),
      world.actions.enterCrafting(),
      itemShop.selectItemToBuy("herb"),
      armory.selectWeaponToBuy("blade"),
      armory.selectArmorToBuy("cloak"),
      world.actions.confirmPurchase(),
      world.actions.cancelPurchase(),
      world.actions.sellItem("herb"),
      itemShop.startConversation("rumor"),
      world.actions.advanceShopConversation(),
      world.actions.endShopConversation(),
      world.actions.leaveShop(),
      world.actions.selectStayPlan("meal"),
      world.actions.confirmStay(),
      world.actions.cancelStay(),
      world.actions.leaveInn(),
      world.actions.area("field").act("gather"),
      world.actions.event("old_well").choose(0),
      world.actions.event("old_well").roll(),
      world.actions.continueExploration(),
      world.actions.eatFood("ration"),
      world.actions.advanceDialogue(),
      world.actions.npc("sage").dialogue("greeting").choose("ask"),
      world.actions.selectGift("herb"),
      world.actions.confirmGift(),
      world.actions.cancelGift(),
      world.actions.endConversation(),
      world.actions.confirmCraft(),
      world.actions.cancelCraft(),
      world.actions.leaveCrafting(),
      world.actions.acceptQuest(),
      world.actions.completeQuest(),
      world.actions.clearQuestSelection(),
      world.actions.leaveQuestBoard(),
      world.actions.allocateAttribute("wisdom"),
      world.actions.resetPendingAttributes(),
      world.actions.confirmLevelUp(),
      world.actions.unequip("mainHand"),
      world.actions.unequip("body"),
      world.actions.area("field").encounter("slime"),
      world.actions.battle.requestFlee(),
      world.actions.battle.executeEnemyTurn(),
      world.actions.battle.end(),
      world.actions.startNewDay(),
      world.actions.endWorld(),
      world.actions.resetWorld(),
    ]
    const verifyFoodAction = () => {
      // @ts-expect-error food effectを持たないitemは食料actionに指定できない
      world.actions.eatFood("tonic")
    }
    void verifyFoodAction

    expect(actions.map((action) => action.type)).toEqual([
      "SELECT_VILLAGE_ACTION",
      "GO_TO_SHOP",
      "GO_TO_INN",
      "GO_TO_QUEST",
      "GO_TO_CRAFTING",
      "SELECT_ITEM_TO_BUY",
      "SELECT_WEAPON_TO_BUY",
      "SELECT_ARMOR_TO_BUY",
      "CONFIRM_PURCHASE",
      "CANCEL_PURCHASE",
      "SELL_ITEM",
      "START_SHOP_CONVERSATION",
      "ADVANCE_SHOP_CONVERSATION",
      "END_SHOP_CONVERSATION",
      "LEAVE_SHOP",
      "SELECT_STAY_PLAN",
      "CONFIRM_STAY",
      "CANCEL_STAY",
      "LEAVE_INN",
      "EXPLORATION_ACTION",
      "SELECT_EVENT_CHOICE",
      "ROLL_DICE",
      "CONTINUE_EXPLORATION",
      "EAT_FOOD",
      "ADVANCE_DIALOGUE",
      "SELECT_DIALOGUE_OPTION",
      "SELECT_GIFT",
      "CONFIRM_GIFT",
      "CANCEL_GIFT",
      "END_CONVERSATION",
      "CONFIRM_CRAFT",
      "CANCEL_CRAFT",
      "LEAVE_CRAFTING",
      "ACCEPT_QUEST",
      "COMPLETE_QUEST",
      "CLEAR_QUEST_SELECTION",
      "LEAVE_QUEST",
      "ALLOCATE_ATTRIBUTE",
      "RESET_PENDING_ATTRIBUTES",
      "CONFIRM_LEVEL_UP",
      "UNEQUIP",
      "UNEQUIP",
      "ENCOUNTER_MONSTER",
      "BATTLE_FLEE",
      "BATTLE_EXECUTE_ENEMY_TURN",
      "BATTLE_END",
      "NEW_DAY",
      "WORLD_ENDED",
      "WORLD_RESET",
    ])
    expect(actions.every((action) => Object.isFrozen(action))).toBe(true)

    const assertContentIds = () => {
      // @ts-expect-error contentにないshop topic IDは受け付けない
      itemShop.startConversation("unknown-topic")
      // @ts-expect-error contentにないgift item IDは受け付けない
      world.actions.selectGift("unknown-item")
      // @ts-expect-error contentにないdialogue option IDは受け付けない
      world.actions.npc("sage").dialogue("greeting").choose("unknown-option")
      // @ts-expect-error contentにないmonster IDは受け付けない
      world.actions.area("field").encounter("unknown-monster")
      // @ts-expect-error contentにないshop IDは受け付けない
      world.actions.shop("unknown-shop")
    }
    expect(assertContentIds).toBeTypeOf("function")
  })

  it("任意のscene stateから静的definitionを含まないsnapshotを生成する", () => {
    const world = WizStandardSceneWorld.create({ content: CONTENT })
    const result = world.dispatch(
      world.initialState,
      world.actions.addLog({ key: "SEASON_CHANGED", season: "summer" })
    )

    const snapshot = world.snapshot(result.state)

    expect(world.content).toBe(CONTENT)
    expect(snapshot.log.at(-1)).toEqual({
      key: "SEASON_CHANGED",
      season: "summer",
    })
    expect(snapshot.toPlain()).not.toHaveProperty("items")
    expect(Object.isFrozen(snapshot)).toBe(true)
    expect(Object.isFrozen(snapshot.log)).toBe(true)
  })

  it("standard item effectをclass一つで差し替えられる", () => {
    const initial = CONTENT.createInitialSnapshot().toPlain()
    const world = WizStandardSceneWorld.create({
      content: CONTENT,
      initialSnapshot: {
        ...initial,
        inventory: {
          ...initial.inventory,
          entries: [
            {
              entryId: "herb-stack",
              contentType: "item",
              contentId: "herb",
              quantity: 1,
            },
          ],
        },
      },
      itemEffect: new GoldItemEffectService(),
    })

    const result = world.dispatch(
      world.initialState,
      world.actions.useItem("herb")
    )

    expect(result.accepted).toBe(true)
    expect(result.state.vault.player.gold).toBe(initial.player.gold + 7)
    expect(result.state.vault.inventory.totalQuantity("item", "herb")).toBe(0)
  })

  it("contentと整合しないsnapshotをcomposition境界で拒否する", () => {
    const initial = CONTENT.createInitialSnapshot().toPlain()
    const invalidSnapshot = WorldSnapshot.create({
      ...initial,
      inventory: {
        ...initial.inventory,
        entries: [
          {
            entryId: "missing-item-entry",
            contentType: "item",
            contentId: "missing-item",
            quantity: 1,
          },
        ],
      },
    })

    expect(() =>
      WizStandardSceneWorld.create({
        content: CONTENT,
        // @ts-expect-error contentに存在しないitem IDはsnapshot型でも拒否する。
        initialSnapshot: invalidSnapshot,
      })
    ).toThrow(WorldSnapshotValidationError)
  })

  it("presetのaffinity範囲と全NPC snapshotを集約検証する", () => {
    const preset = WizPresetValue.create({
      conversation: {
        affinity: {
          minimum: 10,
          maximum: 20,
          levels: [{ id: "bounded", minimum: 10 }],
        },
      },
    })

    try {
      WizStandardSceneWorld.create({ content: CONTENT, preset })
      throw new TypeError("Expected standard configuration validation to fail")
    } catch (error) {
      expect(error).toBeInstanceOf(WizStandardConfigurationError)
      const configurationError = error as WizStandardConfigurationError
      expect(configurationError.diagnostics).toEqual([
        expect.objectContaining({
          code: "NPC_AFFINITY_REJECTED",
          npcId: "sage",
          affinity: 3,
          path: "npcs[0].affinity",
        }),
        expect.objectContaining({
          code: "NPC_AFFINITY_REJECTED",
          npcId: "merchant",
          affinity: 30,
          path: "npcs[1].affinity",
        }),
      ])
      expect(Object.isFrozen(configurationError)).toBe(true)
      expect(Object.isFrozen(configurationError.diagnostics)).toBe(true)
      expect(Object.isFrozen(configurationError.diagnostics[0])).toBe(true)
    }
  })

  it.each([
    {
      affinity: {
        minimum: Number.NaN,
        maximum: 10,
        levels: [{ id: "invalid", minimum: 0 }],
      },
      expectedPath: "conversation.affinity.minimum",
    },
    {
      affinity: {
        minimum: 0,
        maximum: Number.POSITIVE_INFINITY,
        levels: [{ id: "invalid", minimum: 0 }],
      },
      expectedPath: "conversation.affinity.maximum",
    },
    {
      affinity: {
        minimum: 20,
        maximum: 10,
        levels: [{ id: "invalid", minimum: 20 }],
      },
      expectedPath: "conversation.affinity",
    },
  ])(
    "有限かつ昇順でないaffinity範囲を拒否する: %o",
    ({ affinity, expectedPath }) => {
      const baseline = WizPresetValue.create()
      const preset = {
        damage: baseline.damage,
        reward: baseline.reward,
        flee: baseline.flee,
        effect: baseline.effect,
        statusConversion: baseline.statusConversion,
        levelUp: baseline.levelUp,
        conversation: {
          ...baseline.conversation,
          affinity,
        },
        exploration: baseline.exploration,
        time: baseline.time,
      }

      try {
        WizStandardSceneWorld.create({ content: CONTENT, preset })
        throw new TypeError(
          "Expected standard configuration validation to fail"
        )
      } catch (error) {
        expect(error).toBeInstanceOf(WizPresetValidationError)
        expect((error as WizPresetValidationError).diagnostics).toEqual([
          expect.objectContaining({
            path: expectedPath,
          }),
        ])
      }
    }
  )

  it("registry navigationとschema actionで型付きplugin sceneを利用できる", () => {
    const world = WizStandardSceneWorld.create({
      content: CONTENT,
      initialTransition: CAMP_MODULE.enter({}),
      pluginScenes: CAMP_SCENES,
    })

    const firstRest = world.dispatch(world.initialState, {
      type: "REST_AT_CAMP",
    })
    const secondRest = world.dispatch(firstRest.state, { type: "REST_AT_CAMP" })

    expect(firstRest.accepted).toBe(true)
    expect(secondRest.accepted).toBe(true)
    expect(world.initialState).toMatchObject({ type: "camp", rests: 0 })
    expect(firstRest.state).toMatchObject({ type: "camp", rests: 1 })
    expect(secondRest.state).toMatchObject({ type: "camp", rests: 2 })
  })

  it("Object prototypeと同名のplugin sceneでもbuilt-in action表を安全に参照する", () => {
    class PrototypeNamedScene {
      declare readonly [WIZ_IMMUTABLE_VALUE]: true
      readonly type = "toString"

      constructor(
        readonly vault: WizVaultValue,
        readonly visits: number
      ) {
        WizImmutableValue.freeze(this)
      }

      withVault(vault: WizVaultValue): PrototypeNamedScene {
        return new PrototypeNamedScene(vault, this.visits)
      }

      updateVault(
        update: (vault: WizVaultValue) => WizVaultValue
      ): PrototypeNamedScene {
        return this.withVault(update(this.vault))
      }
    }

    const module = WizPluginSceneModule.define({
      type: "toString",
      action: z
        .object({ type: z.literal("VISIT_PROTOTYPE_NAMED_SCENE") })
        .strict(),
      navigation: {
        from: ["village"],
        schema: z.object({}).strict(),
        create: (vault): PrototypeNamedScene =>
          new PrototypeNamedScene(vault, 0),
      },
      reduce: (state: PrototypeNamedScene) =>
        WizPluginSceneResultFactory.accept(
          new PrototypeNamedScene(state.vault, state.visits + 1)
        ),
    })
    const world = WizStandardSceneWorld.create({
      content: CONTENT,
      initialTransition: module.enter({}),
      pluginScenes: WizPluginSceneRegistry.define([module]),
    })

    const result = world.dispatch(world.initialState, {
      type: "VISIT_PROTOTYPE_NAMED_SCENE",
    })

    expect(result.accepted).toBe(true)
    expect(result.state).toMatchObject({ type: "toString", visits: 1 })
  })

  it("plugin inputを一度だけcanonicalizeしてstateとaction eventへ同じoutputを渡す", () => {
    type SetRestsInput =
      | string
      | Readonly<{
          type: "SET_CAMP_RESTS"
          rests: string
        }>
    type SetRestsAction = Readonly<{
      type: "SET_CAMP_RESTS"
      rests: number
    }>
    let validations = 0
    const actionSchema: WizStandardSchemaDefinition<
      SetRestsInput,
      SetRestsAction
    > = {
      "~standard": {
        version: 1,
        vendor: "standard-transform-test",
        types: undefined,
        validate: (input) => {
          validations += 1
          const rests =
            typeof input === "string"
              ? Number(input)
              : typeof input === "object" &&
                  input !== null &&
                  "type" in input &&
                  input.type === "SET_CAMP_RESTS" &&
                  "rests" in input
                ? Number(input.rests)
                : Number.NaN

          return Number.isSafeInteger(rests) && rests >= 0
            ? { value: { type: "SET_CAMP_RESTS", rests } }
            : { issues: [{ message: "invalid rest count" }] }
        },
      },
    }
    const module = WizPluginSceneModule.define({
      type: "camp",
      action: actionSchema,
      navigation: {
        from: ["village"],
        schema: z.object({}).strict(),
        create: (vault): CampState => new CampState(vault, 0),
      },
      reduce: (state: CampState, action) =>
        WizPluginSceneResultFactory.accept(
          new CampState(state.vault, action.rests)
        ),
    })
    const world = WizStandardSceneWorld.create({
      content: CONTENT,
      initialTransition: module.enter({}),
      pluginScenes: WizPluginSceneRegistry.define([module]),
    })
    const stringDispatch = world.dispatch(world.initialState, "4")

    expect(validations).toBe(1)
    expect(stringDispatch.state).toMatchObject({ rests: 4 })
    expect(stringDispatch.events[0]).toBeInstanceOf(
      WizStandardActionAppliedEvent
    )
    expect(stringDispatch.events[0]).toMatchObject({
      type: "STANDARD_ACTION_APPLIED",
      action: { type: "SET_CAMP_RESTS", rests: 4 },
    })

    const objectDispatch = world.dispatch(stringDispatch.state, {
      type: "SET_CAMP_RESTS",
      rests: "6",
    })

    expect(validations).toBe(2)
    expect(objectDispatch.state).toMatchObject({ rests: 6 })
    expect(objectDispatch.events[0]).toMatchObject({
      type: "STANDARD_ACTION_APPLIED",
      action: { type: "SET_CAMP_RESTS", rests: 6 },
    })
    if (!(objectDispatch.events[0] instanceof WizStandardActionAppliedEvent)) {
      throw new TypeError("Expected canonical action event")
    }
    expect(Object.isFrozen(objectDispatch.events[0].action)).toBe(true)
  })

  it("plugin event/reason unionをdispatchとnavigateへliteralのまま伝播する", () => {
    const campModule = WizPluginSceneModule.define({
      type: "camp",
      action: z.discriminatedUnion("type", [
        z.object({ type: z.literal("REST_AT_TYPED_CAMP") }).strict(),
        z
          .object({
            type: z.literal("RING_TYPED_CAMP_BELL"),
            tags: z.array(z.string()),
          })
          .strict(),
        z.object({ type: z.literal("IDLE_AT_TYPED_CAMP") }).strict(),
        z.object({ type: z.literal("CLOSE_TYPED_CAMP") }).strict(),
        z.object({ type: z.literal("LEAVE_TYPED_CAMP") }).strict(),
      ]),
      navigation: {
        from: ["village"],
        schema: z.object({}).strict(),
        create: (vault): CampState => new CampState(vault, 0),
      },
      reduce: (state: CampState, action) => {
        if (action.type === "REST_AT_TYPED_CAMP") {
          const nextState = state.withRest()
          return WizPluginSceneResultFactory.accept(nextState, undefined, [
            { type: "TYPED_CAMP_RESTED", rests: nextState.rests },
          ])
        }
        if (action.type === "RING_TYPED_CAMP_BELL") {
          return WizPluginSceneResultFactory.accept(state, undefined, [
            { type: "TYPED_CAMP_BELL_RUNG", tags: action.tags },
          ])
        }
        if (action.type === "CLOSE_TYPED_CAMP") {
          return WizPluginSceneResultFactory.reject(state, "TYPED_CAMP_CLOSED")
        }
        if (action.type === "LEAVE_TYPED_CAMP") {
          return WizPluginSceneResultFactory.accept(
            state,
            { type: "GO_TO_VILLAGE" },
            [{ type: "TYPED_CAMP_LEFT" }]
          )
        }

        return WizPluginSceneResultFactory.accept(state)
      },
    })
    const shrineModule = WizPluginSceneModule.define({
      type: "shrine",
      action: z.discriminatedUnion("type", [
        z.object({ type: z.literal("RECEIVE_SHRINE_BLESSING") }).strict(),
        z.object({ type: z.literal("CLOSE_SHRINE") }).strict(),
      ]),
      navigation: {
        from: ["village"],
        schema: z.object({}).strict(),
        create: (vault): ShrineState => new ShrineState(vault, 0),
      },
      reduce: (state: ShrineState, action) =>
        action.type === "RECEIVE_SHRINE_BLESSING"
          ? WizPluginSceneResultFactory.accept(
              state.withBlessing(),
              undefined,
              [{ type: "SHRINE_BLESSING_RECEIVED" }]
            )
          : WizPluginSceneResultFactory.reject(state, "SHRINE_CLOSED"),
    })
    const pluginScenes = WizPluginSceneRegistry.define([
      campModule,
      shrineModule,
    ])
    const world = WizStandardSceneWorld.create({
      content: CONTENT,
      initialTransition: campModule.enter({}),
      pluginScenes,
    })
    const bellAction = {
      type: "RING_TYPED_CAMP_BELL" as const,
      tags: ["bell"],
    }
    const bell = world.dispatch(world.initialState, bellAction)

    expect(bell.accepted).toBe(true)
    expect(bell.state).toBe(world.initialState)
    expect(bell.events).toHaveLength(2)
    expect(bell.events[0]).toBeInstanceOf(WizStandardActionAppliedEvent)
    expect(bell.events[1]).toEqual({
      type: "TYPED_CAMP_BELL_RUNG",
      tags: ["bell"],
    })
    expect(Object.isFrozen(bell.events[0])).toBe(true)
    if (bell.events[0]?.type === "STANDARD_ACTION_APPLIED") {
      expect(bell.events[0].action).not.toBe(bellAction)
      expect(Object.isFrozen(bell.events[0].action)).toBe(true)
      if (bell.events[0].action.type === "RING_TYPED_CAMP_BELL") {
        expect(Object.isFrozen(bell.events[0].action.tags)).toBe(true)
      }
    }
    expect(Object.isFrozen(bellAction)).toBe(false)
    expect(Object.isFrozen(bellAction.tags)).toBe(false)

    for (const event of bell.events) {
      if (event.type === "TYPED_CAMP_BELL_RUNG") {
        expectTypeOf(event.type).toEqualTypeOf<"TYPED_CAMP_BELL_RUNG">()
        expectTypeOf(event.tags).toEqualTypeOf<readonly string[]>()
      }
      if (event.type === "SHRINE_BLESSING_RECEIVED") {
        expectTypeOf(event.type).toEqualTypeOf<"SHRINE_BLESSING_RECEIVED">()
      }
    }

    const idle = world.dispatch(world.initialState, {
      type: "IDLE_AT_TYPED_CAMP",
    })
    expect(idle).toMatchObject({
      accepted: false,
      error: {
        code: "ACTION_REJECTED",
        reason: "NO_STATE_CHANGE",
      },
    })

    const closed = world.dispatch(world.initialState, {
      type: "CLOSE_TYPED_CAMP",
    })
    expect(closed).toMatchObject({
      accepted: false,
      error: {
        code: "ACTION_REJECTED",
        reason: "TYPED_CAMP_CLOSED",
      },
    })
    if (closed.isRejected() && closed.error.code === "ACTION_REJECTED") {
      expectTypeOf(closed.error.reason).toEqualTypeOf<
        WizStandardRejectionReason<"TYPED_CAMP_CLOSED" | "SHRINE_CLOSED">
      >()
    }

    const left = world.dispatch(world.initialState, {
      type: "LEAVE_TYPED_CAMP",
    })
    expect(left.accepted).toBe(true)
    expect(left.state.type).toBe("village")
    expect(left.events.map((event) => event.type)).toEqual([
      "STANDARD_ACTION_APPLIED",
      "TYPED_CAMP_LEFT",
      "STANDARD_SCENE_CHANGED",
    ])
    expect(left.events[2]).toBeInstanceOf(WizStandardSceneChangedEvent)
    expect(left.events[2]).toMatchObject({
      previousSceneType: "camp",
      sceneType: "village",
    })

    const navigated = world.navigate(left.state, campModule.enter({}))
    expect(navigated.accepted).toBe(true)
    if (navigated.accepted) {
      expect(navigated.events).toHaveLength(1)
      expect(navigated.events[0]).toBeInstanceOf(WizStandardSceneChangedEvent)
      expect(navigated.events[0]).toMatchObject({
        previousSceneType: "village",
        sceneType: "camp",
      })
      for (const event of navigated.events) {
        if (event.type === "SHRINE_BLESSING_RECEIVED") {
          expectTypeOf(event.type).toEqualTypeOf<"SHRINE_BLESSING_RECEIVED">()
        }
      }
    }

    const verifyImmutablePluginEvent = (
      event: WizDeepReadonly<{ readonly type: "TYPED_CAMP_BELL_RUNG" }>
    ): void => {
      expect(event.type).toBe("TYPED_CAMP_BELL_RUNG")
    }
    if (bell.events[1]?.type === "TYPED_CAMP_BELL_RUNG") {
      verifyImmutablePluginEvent(bell.events[1])
    }
  })

  it("malformed plugin payloadをschema境界で拒否する", () => {
    let reduceCalls = 0
    const module = WizPluginSceneModule.define({
      type: "camp",
      action: z
        .object({
          type: z.literal("ADD_RESTS"),
          rests: z.number().int().positive(),
        })
        .strict(),
      navigation: {
        from: ["village"],
        schema: z.object({}).strict(),
        create: (vault): CampState => new CampState(vault, 0),
      },
      reduce: (state: CampState, action) => {
        reduceCalls += 1

        return WizPluginSceneResultFactory.accept(
          new CampState(state.vault, state.rests + action.rests)
        )
      },
    })
    const pluginScenes = WizPluginSceneRegistry.define([module])
    const world = WizStandardSceneWorld.create({
      content: CONTENT,
      initialTransition: module.enter({}),
      pluginScenes,
    })
    const rejected = world.dispatch(world.initialState, {
      type: "ADD_RESTS",
      rests: "oops",
    } as never)

    expect(rejected).toMatchObject({
      accepted: false,
      error: {
        code: "ACTION_REJECTED",
        reason: "PLUGIN_ACTION_INVALID",
      },
    })
    expect(reduceCalls).toBe(0)
    expect(rejected.state).toBe(world.initialState)
  })

  it("initialTransitionのcontent違反をconfiguration errorへ変換する", () => {
    try {
      WizStandardSceneWorld.create({
        content: CONTENT,
        initialTransition: { type: "GO_TO_EXPLORATION", areaId: "missing" },
      })
      throw new TypeError("Expected initial transition validation to fail")
    } catch (error) {
      expect(error).toBeInstanceOf(WizStandardConfigurationError)
      expect((error as WizStandardConfigurationError).diagnostics).toEqual([
        {
          code: "INITIAL_TRANSITION_REJECTED",
          path: "initialTransition",
          message: "initialTransition was rejected: TRANSITION_AREA_NOT_FOUND",
        },
      ])
    }
  })

  it("plugin transitionのcontent違反をrollbackする", () => {
    const module = WizPluginSceneModule.define({
      type: "camp",
      action: z.object({ type: z.literal("FIND_MISSING_AREA") }).strict(),
      navigation: {
        from: ["village"],
        schema: z.object({}).strict(),
        create: (vault): CampState => new CampState(vault, 0),
      },
      reduce: (state: CampState) =>
        WizPluginSceneResultFactory.accept(state.withRest(), {
          type: "GO_TO_EXPLORATION",
          areaId: "missing",
        }),
    })
    const pluginScenes = WizPluginSceneRegistry.define([module])
    const world = WizStandardSceneWorld.create({
      content: CONTENT,
      initialTransition: module.enter({}),
      pluginScenes,
    })
    const rejected = world.dispatch(world.initialState, {
      type: "FIND_MISSING_AREA",
    })

    expect(rejected).toMatchObject({
      accepted: false,
      error: {
        code: "ACTION_REJECTED",
        reason: "TRANSITION_AREA_NOT_FOUND",
      },
    })
    expect(rejected.state).toBe(world.initialState)
  })

  it("存在しないareaを持つbuilt-in initial stateを作成できない", () => {
    expect(() =>
      WizStandardSceneWorld.create({
        content: CONTENT,
        initialTransition: { type: "GO_TO_EXPLORATION", areaId: "missing" },
      })
    ).toThrow(/TRANSITION_AREA_NOT_FOUND/)
  })

  it("registry/module/navigationを不変値として所有する", () => {
    expect(Object.isFrozen(CAMP_MODULE)).toBe(true)
    expect(Object.isFrozen(CAMP_SCENES)).toBe(true)
    expect(Object.isFrozen(CAMP_SCENES.sceneTypes)).toBe(true)
    expect(Object.isFrozen(CAMP_MODULE.enter({}))).toBe(true)
  })

  it("registryに存在しないplugin navigation sourceを構成時に拒否する", () => {
    const module = WizPluginSceneModule.define({
      type: "camp",
      action: z.object({ type: z.literal("REST_AT_CAMP") }).strict(),
      navigation: {
        from: ["missing_scene"],
        schema: z.object({}).strict(),
        create: (vault): CampState => new CampState(vault, 0),
      },
      reduce: (state: CampState) =>
        WizPluginSceneResultFactory.accept(state.withRest()),
    })

    expect(() =>
      WizStandardSceneWorld.create({
        content: CONTENT,
        pluginScenes: WizPluginSceneRegistry.define([module]),
      })
    ).toThrow('unknown navigation source "missing_scene"')
  })
})
