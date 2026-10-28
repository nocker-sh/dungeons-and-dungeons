import { describe, expect, it } from "vite-plus/test"
import type { WorldContentArrays } from "@/lib/wiz/core/content/schema"
import { WorldContent } from "@/lib/wiz/core/content/world-content"
import { WizEngineBattleSimpleEnemyAI } from "@/lib/wiz/core/engine/battle-ai/simple-enemy-ai"
import { WizEngineBattleContent } from "@/lib/wiz/core/engine/battle/content"
import type { WizEngineBattleExecutionOptions } from "@/lib/wiz/core/engine/battle/execution/action-executor"
import { WizEngineBattleTurnActionExecutor } from "@/lib/wiz/core/engine/battle/execution/action-executor"
import { WizEngineBattleExecutionResult } from "@/lib/wiz/core/engine/battle/execution/execution-result"
import { createWizStandardConversationAffinitySystem } from "@/lib/wiz/core/engine/conversation/create-wiz-standard-conversation-affinity-system"
import { WizEngineBattleDefaultTurnOrderPolicy } from "@/lib/wiz/core/engine/battle/phases/turn-order-policy"
import type { WizEngineBattleExecutor } from "@/lib/wiz/core/engine/battle/phases/turn-order"
import type { WizEngineBattleTurnAction } from "@/lib/wiz/core/engine/battle/turn-action"
import { WizEngineBattleActionBuilder } from "@/lib/wiz/core/engine/battle/turn-action-builder"
import type { WizEngineBattleDamageCalculator } from "@/lib/wiz/core/engine/damage/default-damage-calculator"
import {
  WizEnginePartyLevelUp,
  WizPartyMemberGrowthTable,
} from "@/lib/wiz/core/engine/level-up/party-level-up"
import { WizEngineInn } from "@/lib/wiz/core/engine/inn"
import { WizEngineInnPlanCatalog } from "@/lib/wiz/core/engine/inn/plan-catalog"
import { WizEngineBattleReward } from "@/lib/wiz/core/engine/reward/battle-reward"
import { WizEngineBattleDefaultRewardCalculator } from "@/lib/wiz/core/engine/reward/default-reward-calculator"
import type { WizBattleEnemyParty } from "@/lib/wiz/core/engine/battle/actors/enemy-party"
import type { WizBattleParty } from "@/lib/wiz/core/engine/battle/actors/party"
import { wizMockSoloParty } from "@/lib/wiz/core/mocks/wiz-mock-solo-party"
import { MOCK_INITIAL_STATE, MOCK_VAULT } from "@/lib/wiz/core/mocks/mock-vault"
import { WizRpgEquipmentRules } from "@/lib/wiz/core/rpg/equipment-rules"
import {
  type WizStandardInventoryEntry,
  WizStandardInventoryService,
} from "@/lib/wiz/core/rpg/standard-inventory"
import {
  WizRpgMechanics,
  type WizRpgMechanicsContext,
  type WizRpgMechanicsDefinition,
  type WizRpgMechanicsFactoryContext,
} from "@/lib/wiz/core/presets/rpg-mechanics"
import { WizPresetValue } from "@/lib/wiz/core/presets/wiz-preset"
import { WizStandardRuntimeEnvironment } from "@/lib/wiz/core/presets/runtime-environment"
import { WizSceneBattleMonsterAdapter } from "@/lib/wiz/core/runtime/converters/battle-monster-adapter"
import {
  WizSceneBattleDefaultRewardSettlement,
  type WizSceneBattleRewardSettlement,
  WizSceneBattleRewardSettlementResult,
} from "@/lib/wiz/core/runtime/scenes/battle/reward-settlement"
import { WizSceneBattleService } from "@/lib/wiz/core/runtime/scenes/battle/wiz-battle-service"
import { WizSceneExplorationReducer } from "@/lib/wiz/core/runtime/scenes/exploration/reducer"
import { WizRuntimeDefeatService } from "@/lib/wiz/core/runtime/services/defeat-service"
import type { WizDefaultTypes } from "@/lib/wiz/core/types/wiz-types"
import { createWizStandardHungerService } from "@/lib/wiz/core/vault/states/player/services/wiz-hunger-service"

const content = WorldContent.create({})
const battleContent = new WizEngineBattleContent()
const preset = WizPresetValue.create()
const environment = WizStandardRuntimeEnvironment.create({
  clock: () => 42,
  nextId: () => "mechanics-id",
})
const mechanicsContext = {
  preset,
  content,
  battleContent,
  environment,
} satisfies WizRpgMechanicsContext
const actionBuilder = new WizEngineBattleActionBuilder({
  nextId: () => "action-id",
})
const createDefaultWeakEnemies = () =>
  WizSceneBattleMonsterAdapter.createDefault().enemiesFromMonsters([
    {
      id: "goblin",
      name: "Goblin",
      hp: 20,
      maxHp: 20,
      attack: 5,
      defense: 2,
      agility: 3,
      expReward: 10,
      goldReward: 5,
      drops: [],
    },
    {
      id: "goblin",
      name: "Goblin",
      hp: 20,
      maxHp: 20,
      attack: 5,
      defense: 2,
      agility: 3,
      expReward: 10,
      goldReward: 5,
      drops: [],
    },
  ])

const verifyRewardSettlementVariance = (): void => {
  type Reward = Readonly<{ souls: number }>
  type NarrowReward = Readonly<{ souls: 1 }>
  const narrowSettlement: WizSceneBattleRewardSettlement<
    unknown,
    unknown,
    NarrowReward
  > = {
    settle: ({ vault }) => WizSceneBattleRewardSettlementResult.accept(vault),
  }

  // @ts-expect-error narrower reward consumers cannot satisfy a wider settlement port.
  const unsafeSettlement: WizSceneBattleRewardSettlement<
    unknown,
    unknown,
    Reward
  > = narrowSettlement
  void unsafeSettlement
}

const verifyBattlePortVariance = (): void => {
  type WideStatus = Readonly<{ stance: string }>
  type NarrowStatus = Readonly<{ stance: "focused" }>
  const narrowExecutor: WizEngineBattleExecutor<NarrowStatus> = {
    execute: () => {
      throw new Error("compile-only")
    },
  }
  const narrowDamageCalculator: WizEngineBattleDamageCalculator<NarrowStatus> =
    {
      calculate: () => {
        throw new Error("compile-only")
      },
    }

  // @ts-expect-error narrower status consumers cannot satisfy a wider executor port.
  const unsafeExecutor: WizEngineBattleExecutor<WideStatus> = narrowExecutor
  // @ts-expect-error narrower status consumers cannot satisfy a wider calculator port.
  const unsafeDamageCalculator: WizEngineBattleDamageCalculator<WideStatus> =
    narrowDamageCalculator
  void unsafeExecutor
  void unsafeDamageCalculator
}

const acceptedExecution = <TStatus, TCustom>(
  action: WizEngineBattleTurnAction,
  party: WizBattleParty<TStatus>,
  enemies: WizBattleEnemyParty<TStatus, TCustom>
) =>
  WizEngineBattleExecutionResult.accept({
    party,
    enemies,
    logs: [],
    success: true,
    action,
  })

const resolveMechanicsForContent = <const TArrays extends WorldContentArrays>(
  currentContent: WorldContent<TArrays>,
  mechanics: WizRpgMechanics<WizDefaultTypes, undefined, TArrays>
) =>
  mechanics.resolve({
    preset,
    content: currentContent,
    battleContent,
    environment,
  })

describe("WizRpgMechanics", () => {
  it("definition変更からfactoryを隔離し、withは新しいdefinitionを返す", () => {
    const firstFactory = () => ({
      execute: acceptedExecution,
    })
    const definition = {
      battleExecutor: firstFactory,
    } satisfies WizRpgMechanicsDefinition
    const base = WizRpgMechanics.define(definition)
    Reflect.set(definition, "battleExecutor", () => ({
      execute: (
        action: WizEngineBattleTurnAction,
        party: WizBattleParty,
        enemies: WizBattleEnemyParty
      ) => ({
        party,
        enemies,
        logs: [],
        success: false,
        accepted: false,
        action,
      }),
    }))
    const extended = base.with({
      turnOrderPolicy: () => ({
        order: (context) => [
          ...context.enemies.getAllAliveMonsters().map((monster) => monster.id),
          ...context.party.getActableMembers().map((character) => character.id),
        ],
      }),
    })

    const basePorts = base.resolve(mechanicsContext)
    const extendedPorts = extended.resolve(mechanicsContext)
    const party = wizMockSoloParty()
    const enemies = createDefaultWeakEnemies()
    const action = actionBuilder.attack(
      party.members[0].id,
      enemies.getAllMonsters()[0].id
    )

    expect(
      basePorts.battleExecutor?.execute(action, party, enemies).accepted
    ).toBe(true)
    expect(basePorts.turnOrderPolicy).toBeUndefined()
    expect(
      extendedPorts.battleExecutor?.execute(action, party, enemies).accepted
    ).toBe(true)
    expect(extendedPorts.turnOrderPolicy).toBeDefined()
  })

  it("factoryへ同一のfrozen contextを渡し、全port wrapperをfreezeする", () => {
    const contexts: WizRpgMechanicsFactoryContext[] = []
    const mechanics = WizRpgMechanics.define({
      battleExecutor: (context) => {
        contexts.push(context)
        return new WizEngineBattleTurnActionExecutor()
      },
      turnOrderPolicy: (context) => {
        contexts.push(context)
        return new WizEngineBattleDefaultTurnOrderPolicy()
      },
      enemyAI: (context) => {
        contexts.push(context)
        return new WizEngineBattleSimpleEnemyAI()
      },
      rewardCalculator: (context) => {
        contexts.push(context)
        return new WizEngineBattleDefaultRewardCalculator()
      },
      rewardSettlement: (context) => {
        contexts.push(context)
        return new WizSceneBattleDefaultRewardSettlement({
          content: context.content,
          inventoryService: new WizStandardInventoryService(
            context.environment.nextId
          ),
        })
      },
      explorationReducer: (context) => {
        contexts.push(context)
        return new WizSceneExplorationReducer({
          content: context.content,
          inventoryService: new WizStandardInventoryService(
            context.environment.nextId
          ),
        })
      },
      defeatPolicy: (context) => {
        contexts.push(context)
        return new WizRuntimeDefeatService()
      },
      hungerService: (context) => {
        contexts.push(context)
        return createWizStandardHungerService()
      },
      affinitySystem: (context) => {
        contexts.push(context)
        return createWizStandardConversationAffinitySystem()
      },
      innService: (context) => {
        contexts.push(context)
        return new WizEngineInn(new WizEngineInnPlanCatalog([]))
      },
      standardActionReducer: (context) => {
        contexts.push(context)
        return { reduce: () => null }
      },
      equipmentRules: (context) => {
        contexts.push(context)
        return WizRpgEquipmentRules.standard()
      },
      partyLevelUp: (context) => {
        contexts.push(context)
        return new WizEnginePartyLevelUp(
          new WizPartyMemberGrowthTable({
            classes: {},
            fallback: { hp: 0, mp: 0 },
          })
        )
      },
    })

    const ports = mechanics.resolve(mechanicsContext)

    expect(contexts).toHaveLength(13)
    expect(new Set(contexts).size).toBe(1)
    expect(contexts[0]?.preset).toBe(preset)
    expect(contexts[0]?.content).toBe(content)
    expect(contexts[0]?.battleContent).toBe(battleContent)
    expect(contexts[0]?.environment).toBe(environment)
    expect(Object.isFrozen(contexts[0])).toBe(true)
    expect(Object.isFrozen(mechanics)).toBe(true)
    expect(Object.isFrozen(WizRpgMechanics)).toBe(true)
    expect(Object.isFrozen(WizRpgMechanics.prototype)).toBe(true)
    expect(Object.isFrozen(ports)).toBe(true)
    for (const port of Object.values(ports)) {
      if (port === undefined) {
        throw new TypeError("Expected every mechanics port to be resolved")
      }
      expect(Object.isFrozen(port)).toBe(true)
      for (const method of Object.values(port)) {
        expect(Object.isFrozen(method)).toBe(true)
      }
    }
  })

  it("resolve時にmethodを捕捉し、元objectとprototypeの変更を受けない", () => {
    class MutableExecutor {
      execute<TStatus, TCustom>(
        action: WizEngineBattleTurnAction,
        party: WizBattleParty<TStatus>,
        enemies: WizBattleEnemyParty<TStatus, TCustom>,
        _options?: WizEngineBattleExecutionOptions
      ) {
        return acceptedExecution(action, party, enemies)
      }
    }
    const executor = new MutableExecutor()
    const originalDescriptor = Object.getOwnPropertyDescriptor(
      MutableExecutor.prototype,
      "execute"
    )
    if (originalDescriptor === undefined) {
      throw new TypeError("Expected executor prototype method")
    }
    const mechanics = WizRpgMechanics.define({
      battleExecutor: () => executor,
    })
    const ports = mechanics.resolve(mechanicsContext)
    Reflect.set(MutableExecutor.prototype, "execute", () => {
      throw new Error("mutated prototype")
    })
    Reflect.set(executor, "execute", () => {
      throw new Error("mutated object")
    })
    const party = wizMockSoloParty()
    const enemies = createDefaultWeakEnemies()
    const action = actionBuilder.attack(
      party.members[0].id,
      enemies.getAllMonsters()[0].id
    )

    try {
      expect(
        ports.battleExecutor?.execute(action, party, enemies).accepted
      ).toBe(true)
    } finally {
      Object.defineProperty(
        MutableExecutor.prototype,
        "execute",
        originalDescriptor
      )
    }
  })

  it("custom executorが共有environmentを実行時に利用できる", () => {
    const mechanics = WizRpgMechanics.define({
      battleExecutor: (context) => ({
        execute: (action, party, enemies) =>
          context.environment.clock() === 42
            ? WizEngineBattleExecutionResult.accept({
                party,
                enemies,
                logs: [],
                success: true,
                action,
              })
            : WizEngineBattleExecutionResult.reject({
                party,
                enemies,
                reason: "BATTLE_ACTION_REJECTED",
              }),
      }),
    })
    const ports = mechanics.resolve(mechanicsContext)
    const service = new WizSceneBattleService({
      executor: ports.battleExecutor,
      rewardCalculator: new WizEngineBattleDefaultRewardCalculator(),
    })
    const { encounterScene } = service.startBattle(
      wizMockSoloParty(),
      createDefaultWeakEnemies()
    )
    const turn = service.createTurnOrderScene(encounterScene)
    if (turn.phase !== "turnOrder") return
    const actor = turn.getCurrentActor()
    if (!actor) return
    const targetId = actor.isEnemy
      ? turn.context.party.members[0].id
      : turn.context.enemies.getAllMonsters()[0].id

    const result = service.executeAction(
      turn,
      actionBuilder.attack(actor.id, targetId)
    )

    expect(result.accepted).toBe(true)
  })

  it("reward custom型をcalculatorからsettlementまで相関させる", () => {
    type SoulReward = Readonly<{ souls: number }>
    const mechanics = WizRpgMechanics.define<WizDefaultTypes, SoulReward>({
      rewardCalculator: () => ({
        calculate: () =>
          new WizEngineBattleReward({
            experience: 0,
            gold: 0,
            custom: { souls: 3 },
          }),
      }),
      rewardSettlement: () => ({
        settle: ({ vault, reward }) =>
          WizSceneBattleRewardSettlementResult.accept(
            vault.addFlag(`souls:${reward.custom.souls}`)
          ),
      }),
    })
    const extended = mechanics.with({
      turnOrderPolicy: () => new WizEngineBattleDefaultTurnOrderPolicy(),
    })
    const ports = extended.resolve(mechanicsContext)
    const enemies = createDefaultWeakEnemies()
    if (
      ports.rewardCalculator === undefined ||
      ports.rewardSettlement === undefined
    ) {
      throw new TypeError("Expected correlated reward ports")
    }
    const reward = ports.rewardCalculator.calculate({ enemies })

    const settled = ports.rewardSettlement.settle({
      vault: MOCK_VAULT,
      reward,
      returnAreaId: "forest",
      enemies,
    })

    expect(reward.custom.souls).toBe(3)
    expect(settled.isAccepted()).toBe(true)
    expect(settled.vault.hasFlag("souls:3")).toBe(true)
    expect(ports.turnOrderPolicy).toBeDefined()
  })

  it("外側で確定したcontent literal型をnested defineのfactoryへ保つ", () => {
    const literalContent = WorldContent.create({
      items: [
        {
          id: "single_item",
          name: "Single item",
          description: "Only one category is needed",
          itemType: "material",
          price: 1,
          sellPrice: 1,
        },
      ],
    })

    const ports = resolveMechanicsForContent(
      literalContent,
      WizRpgMechanics.define({
        battleExecutor: (context) => {
          const literalName: "Single item" =
            context.content.items.single_item.name
          expect(literalName).toBe("Single item")
          return { execute: acceptedExecution }
        },
      })
    )

    expect(ports.battleExecutor).toBeDefined()
  })

  it("未指定portをundefinedに保ち、不正constructorとforged instanceを拒否する", () => {
    const mechanics = WizRpgMechanics.define()
    const ports = mechanics.resolve(mechanicsContext)

    expect(ports).toEqual({
      battleExecutor: undefined,
      turnOrderPolicy: undefined,
      enemyAI: undefined,
      rewardCalculator: undefined,
      rewardSettlement: undefined,
      explorationReducer: undefined,
      defeatPolicy: undefined,
      hungerService: undefined,
      affinitySystem: undefined,
      innService: undefined,
      standardActionReducer: undefined,
      equipmentRules: undefined,
      partyLevelUp: undefined,
    })
    expect(() =>
      Reflect.construct(WizRpgMechanics, [Symbol("forged"), {}])
    ).toThrow("WizRpgMechanics must be created with WizRpgMechanics.define()")

    const forged = Object.create(WizRpgMechanics.prototype) as WizRpgMechanics
    expect(() => forged.resolve(mechanicsContext)).toThrow(
      "WizRpgMechanics instance was not created by define()"
    )
  })

  it("equipment rules factoryがprototype偽装classを返したら拒否する", () => {
    const forgedRules: WizRpgEquipmentRules<WizStandardInventoryEntry, never> =
      Object.freeze(Object.create(WizRpgEquipmentRules.prototype))
    const mechanics = WizRpgMechanics.define({
      equipmentRules: () => forgedRules,
    })

    expect(() => mechanics.resolve(mechanicsContext)).toThrow(
      "WizRpgMechanics equipmentRules factory result must be created with WizRpgEquipmentRules.define() or standard()"
    )
  })

  it("defeat policyの不正なcheck resultを境界で拒否する", () => {
    const mechanics = WizRpgMechanics.define({
      defeatPolicy: () => ({
        check: (state) => ({ defeated: "truthy", state }) as never,
      }),
    })
    const policy = mechanics.resolve(mechanicsContext).defeatPolicy
    if (policy === undefined) {
      throw new Error("Expected defeat policy")
    }

    expect(() => policy.check(MOCK_INITIAL_STATE)).toThrow(
      "WizRpgMechanics defeatPolicy check must return state and an optional boolean defeated"
    )
  })

  it("reward calculatorなしのsettlementをruntimeでも拒否する", () => {
    expect(() =>
      WizRpgMechanics.define({
        rewardSettlement: () =>
          new WizSceneBattleDefaultRewardSettlement({
            content,
            inventoryService: new WizStandardInventoryService(
              environment.nextId
            ),
          }),
      } as never)
    ).toThrow("WizRpgMechanics reward settlement requires a reward calculator")
  })
})

void verifyRewardSettlementVariance
void verifyBattlePortVariance
