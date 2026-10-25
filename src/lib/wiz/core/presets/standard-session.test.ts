import { describe, expect, it } from "vite-plus/test"
import { z } from "zod"
import type { WorldContentArrays } from "@/lib/wiz/core/content/schema"
import { WorldContent } from "@/lib/wiz/core/content/world-content"
import { WizRpgSceneState } from "@/lib/wiz/core/rpg/scene-state"
import {
  type WizStandardState,
  WizStandardSceneWorld,
} from "@/lib/wiz/core/presets/standard-scene-world"
import {
  type WizStandardPluginSceneRestoreContext,
  WizStandardPluginSceneCodec,
  WizStandardSessionCodec,
  WizStandardSessionError,
  WizStandardSessionSnapshot,
} from "@/lib/wiz/core/presets/standard-session"
import { WizPresetValue } from "@/lib/wiz/core/presets/wiz-preset"
import { WizPluginSceneRegistry } from "@/lib/wiz/core/runtime/plugin/plugin-scene-registry"
import { WizPluginSceneModule } from "@/lib/wiz/core/runtime/plugin/plugin-scene-module"
import { WizPluginSceneResultFactory } from "@/lib/wiz/core/runtime/plugin/plugin-scene-result"
import { WizSceneBattleMonsterAdapter } from "@/lib/wiz/core/runtime/converters/battle-monster-adapter"
import { WizStateConversation } from "@/lib/wiz/core/runtime/scenes/conversation/state"
import { presentWizConversationTranscript } from "@/lib/wiz/core/runtime/scenes/conversation/types"
import {
  WizWorldSaveSchemaVersionError,
  WizWorldSaveSerializationError,
} from "@/lib/wiz/core/save/world-save-codec"
import { WorldSnapshot } from "@/lib/wiz/core/save/world-snapshot"
import type { WizDefaultBattleStatus, WizTypes } from "@/lib/wiz/core/types/wiz-types"
import { WizVaultEventStateSchema } from "@/lib/wiz/core/vault/states/event/schema"
import { WizWorldEnvironment } from "@/lib/wiz/core/world/world"

type Exact<TActual, TExpected> =
  (<T>() => T extends TActual ? 1 : 2) extends <T>() => T extends TExpected ? 1 : 2 ? true : false

type Expect<T extends true> = T

const presentHistory = (state: WizStateConversation) =>
  presentWizConversationTranscript(state.transcript, state.vault.findNpc(state.npcId))

const CONTENT = WorldContent.parse({
  items: [
    {
      id: "herb",
      name: "Herb",
      description: "A useful herb",
      itemType: "material",
      price: 5,
      sellPrice: 2,
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
  armors: [],
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
      hp: 3,
      attack: 0,
      defense: 0,
      agility: 0,
      expReward: 1,
      goldReward: 1,
      drops: [{ itemId: "herb", chance: 100 }],
    },
  ],
  events: [
    {
      id: "spring",
      description: "A clear spring",
      choices: [
        {
          label: "Drink",
          successText: "Refreshed",
          failText: "Nothing happened",
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
      eventIds: ["spring"],
    },
    {
      id: "locked_cave",
      name: "Locked cave",
      description: "A sealed cave",
      dangerLevel: 2,
      apCost: 2,
      unlocked: false,
      availableGathering: [],
      monsterIds: [],
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
      likeBonus: 17,
      dialogues: [
        {
          id: "greeting",
          minAffinity: 0,
          lines: [
            { speaker: "Sage", text: "Welcome." },
            { speaker: "Sage", text: "Travel safely." },
          ],
        },
      ],
    },
  ],
  quests: [
    {
      id: "gather_herb",
      name: "Gather herb",
      description: "Gather herbs",
      giverNpcId: "sage",
      objective: { type: "gather", itemId: "herb", count: 1 },
      reward: { gold: 5, exp: 2, affinityBonus: 0 },
    },
  ],
  facilities: [],
  abilities: [
    {
      id: "focus",
      name: "Focus",
      description: "Raise attack",
      tags: [],
      costs: { mana: 0 },
      effect: {
        type: "effect",
        side: "allies",
        target: "self",
        element: "physical",
        power: 4,
        effectId: "attackUp",
        modifier: { attack: 4 },
      },
      custom: {},
    },
  ],
  shopDialogues: [
    {
      shopId: "item_shop",
      shopkeeperName: "Keeper",
      greeting: "Welcome.",
      buyPriceModifier: 0.5,
      products: {
        itemIds: ["herb", "tonic"],
        weaponIds: [],
        armorIds: [],
      },
      topics: [],
    },
    {
      shopId: "weapon_shop",
      shopkeeperName: "Smith",
      greeting: "Need a blade?",
      products: {
        itemIds: [],
        weaponIds: ["blade"],
        armorIds: [],
      },
      topics: [],
    },
  ],
  abilityTable: [],
  innPlans: [
    {
      id: "moon-rest",
      price: 25,
      hpRecovery: { percent: 50 },
      apRecovery: "full",
    },
  ],
} as const)

const createWorld = (content: WorldContent = CONTENT, initialSnapshot?: WorldSnapshot) =>
  WizStandardSceneWorld.create({
    content,
    ...(initialSnapshot === undefined ? {} : { initialSnapshot }),
    environment: WizWorldEnvironment.create({
      nextId: () => "session-action",
      now: () => 100,
      random: () => 0.5,
    }),
  })

const createStockedWorld = (content: WorldContent = CONTENT) => {
  const initial = content.createInitialSnapshot().toPlain()
  return createWorld(
    content,
    WorldSnapshot.create({
      ...initial,
      inventory: {
        ...initial.inventory,
        entries: [
          ...initial.inventory.entries.filter(
            (entry) => entry.contentType !== "item" || entry.contentId !== "herb",
          ),
          {
            entryId: "herb-stack",
            contentType: "item",
            contentId: "herb",
            quantity: 1,
          },
        ],
      },
    }),
  )
}

type MutableBattleActionData = {
  id: string
  type: "attack" | "ability" | "defend" | "item" | "flee"
  actorId: string
  targetIds: string[]
  abilityId: string | null
  itemId: string | null
}

type MutableBattleEffectData = {
  instanceId: string
  effectId: string
  sourceId: string
  tags: string[]
  stacks: number
  maximumStacks: number
  lifetime: { type: "permanent" } | { type: "turns"; remaining: number }
  payload: unknown
}

type MutableBattleActorData = {
  id: string
  name: string
  custom?: unknown
  status: {
    attributes: {
      attack: number
      defense: number
      speed: number
    }
    resources: {
      health: {
        current: number
        maximum: number
      }
      mana: {
        current: number
        maximum: number
      }
    }
    custom?: unknown
  }
  effects: MutableBattleEffectData[]
}

type MutableBattleEnvelope = {
  snapshot: {
    scene: {
      type: "battle"
      phase: {
        phase: "turnOrder"
        context: {
          party: {
            id: string
            members: MutableBattleActorData[]
          }
          enemies: {
            id: string
            groups: Array<{
              id: string
              name: string
              members: Array<MutableBattleActorData & { groupId: string }>
            }>
          }
          executedActions: MutableBattleActionData[]
          initiative: "party" | "enemies" | "none"
        }
        turnOrder: Array<{ actorId: string; speed: number }>
        currentActorIndex: number
      }
    }
  }
}

const expectStandardSessionError = (
  operation: () => unknown,
  expected: Readonly<Record<string, unknown>>,
) => {
  let caught: unknown
  try {
    operation()
  } catch (error) {
    caught = error
  }
  expect(caught).toBeInstanceOf(WizStandardSessionError)
  expect(caught).toMatchObject(expected)
}

describe("WizStandardSessionCodec", () => {
  it("探索sceneをevent definitionの複製なしでJSON往復する", () => {
    const world = createWorld()
    const codec = WizStandardSessionCodec.create({ contentVersion: "content-v1" })
    const entered = world.dispatch(world.initialState, world.actions.area("field").enter())
    expect(entered.state.type).toBe("exploration")
    if (entered.state.type !== "exploration") throw new TypeError("Expected exploration")

    const event = WizVaultEventStateSchema.parse(entered.state.vault.areas[0]!.events[0]!)
    const restoredFixture = JSON.parse(JSON.stringify(world.save(entered.state, codec))) as {
      snapshot: {
        scene: {
          eventProgress: unknown
          message: unknown
        }
      }
    }
    restoredFixture.snapshot.scene.eventProgress = {
      status: "result",
      eventId: "spring",
      choiceIndex: 0,
      diceResult: {
        dice: [3, 4],
        total: 7,
        modifier: 0,
        targetNumber: 6,
        success: true,
        critical: false,
        fumble: false,
      },
    }
    restoredFixture.snapshot.scene.message = {
      type: "event_encountered",
      eventId: "spring",
    }
    const state = world.restore(restoredFixture, codec)
    if (state.type !== "exploration") throw new TypeError("Expected exploration")

    const envelope = world.save(state, codec)
    expect(envelope).toMatchObject({
      schemaVersion: 1,
      contentVersion: "content-v1",
      snapshot: {
        scene: {
          type: "exploration",
          areaId: "field",
          eventProgress: { status: "result", eventId: "spring" },
        },
      },
    })
    expect("event" in (envelope.snapshot.scene as { eventProgress: object }).eventProgress).toBe(
      false,
    )

    const restored = world.restore(JSON.parse(JSON.stringify(envelope)), codec)
    expect(restored.type).toBe("exploration")
    if (restored.type !== "exploration") throw new TypeError("Expected exploration")
    expect(restored.eventProgress).toEqual({
      status: "result",
      event,
      choiceIndex: 0,
      diceResult: {
        dice: [3, 4],
        total: 7,
        modifier: 0,
        targetNumber: 6,
        success: true,
        critical: false,
        fumble: false,
      },
      resultText: "Refreshed",
    })
    expect(restored.vault).not.toBe(state.vault)
    expect(Object.isFrozen(restored)).toBe(true)
    expect(Object.isFrozen(restored.eventProgress)).toBe(true)
  })

  it("schemaVersionが異なるsessionを拒否する", () => {
    const world = createWorld()
    const codec = WizStandardSessionCodec.create({ contentVersion: "content-v1" })
    const envelope = JSON.parse(JSON.stringify(world.save(world.initialState, codec))) as {
      schemaVersion: number
    }
    envelope.schemaVersion = 2

    expect(() => codec.parse(envelope)).toThrow(WizWorldSaveSchemaVersionError)
    expect(() => world.restore(envelope, codec)).toThrow(WizWorldSaveSchemaVersionError)
  })

  it("探索encounter・rollingを再報酬化できない一時状態としてcapture/restoreで拒否する", () => {
    const world = createWorld()
    const codec = WizStandardSessionCodec.create({ contentVersion: "content-v1" })
    const exploration = world.dispatch(
      world.initialState,
      world.actions.area("field").enter(),
    ).state
    if (exploration.type !== "exploration") throw new TypeError("Expected exploration")
    const event = WizVaultEventStateSchema.parse(exploration.vault.areas[0]!.events[0]!)
    const expected = {
      code: "UNSUPPORTED_SCENE_STATE",
      path: "$.scene.eventProgress.status",
    }

    for (const eventProgress of [
      { status: "encounter" as const, event, choiceIndex: null },
      { status: "rolling" as const, event, choiceIndex: 0 },
    ]) {
      expectStandardSessionError(
        () =>
          codec.capture(exploration.withEventProgress(eventProgress), world.snapshot(exploration)),
        expected,
      )
    }

    const safeEnvelope = world.save(exploration, codec)
    expect(world.restore(safeEnvelope, codec)).toMatchObject({
      type: "exploration",
      eventProgress: { status: "none" },
    })

    for (const eventProgress of [
      { status: "encounter" as const, eventId: "spring", choiceIndex: null },
      { status: "rolling" as const, eventId: "spring", choiceIndex: 0 },
    ]) {
      const transientEnvelope = {
        ...safeEnvelope,
        snapshot: {
          ...safeEnvelope.snapshot,
          scene: {
            type: "exploration" as const,
            areaId: "field",
            eventProgress,
            message: null,
          },
        },
      }
      expectStandardSessionError(() => world.restore(transientEnvelope, codec), expected)
    }
  })

  it("探索sceneはcurrent vaultで存在しunlockedなareaだけ復元する", () => {
    const world = createWorld()
    const codec = WizStandardSessionCodec.create({ contentVersion: "content-v1" })
    const envelope = world.save(world.initialState, codec)
    const lockedAreaEnvelope = {
      ...envelope,
      snapshot: {
        ...envelope.snapshot,
        scene: {
          type: "exploration" as const,
          areaId: "locked_cave",
          eventProgress: { status: "none" as const },
          message: null,
        },
      },
    }

    expectStandardSessionError(() => world.restore(lockedAreaEnvelope, codec), {
      code: "SCENE_REFERENCE_INVALID",
      path: "$.scene.areaId",
      referenceId: "locked_cave",
    })
  })

  it("宿泊sceneはcontent定義のIDだけをJSON往復する", () => {
    const world = createWorld()
    const codec = WizStandardSessionCodec.create({ contentVersion: "content-v1" })
    const inn = world.dispatch(world.initialState, world.actions.enterInn())
    const selected = world.dispatch(inn.state, world.actions.selectStayPlan("moon-rest"))
    expect(selected.state.type).toBe("inn")
    if (selected.state.type !== "inn") throw new TypeError("Expected inn")

    const envelope = world.save(selected.state, codec)
    const restored = world.restore(JSON.parse(JSON.stringify(envelope)), codec)
    expect(restored.type).toBe("inn")
    if (restored.type !== "inn") throw new TypeError("Expected restored inn")
    expect(restored.selectedPlan).toBe("moon-rest")
    expect(restored.confirmingStay).toBe(true)

    const tampered = JSON.parse(JSON.stringify(envelope)) as {
      snapshot: { scene: { selectedPlan: string } }
    }
    tampered.snapshot.scene.selectedPlan = "retired-plan"
    expectStandardSessionError(() => world.restore(tampered, codec), {
      code: "SCENE_REFERENCE_NOT_FOUND",
      path: "$.scene.selectedPlan",
      referenceId: "retired-plan",
    })
  })

  it("conversationとbattle phaseをclass instanceとして復元する", () => {
    const world = createWorld()
    const codec = WizStandardSessionCodec.create({ contentVersion: "content-v1" })
    const conversation = world.dispatch(world.initialState, world.actions.npc("sage").talk())
    expect(conversation.state.type).toBe("conversation")
    const restoredConversation = world.restore(world.save(conversation.state, codec), codec)
    expect(restoredConversation.type).toBe("conversation")
    if (restoredConversation.type !== "conversation") {
      throw new TypeError("Expected conversation")
    }
    expect(restoredConversation.npcId).toBe("sage")
    expect(presentHistory(restoredConversation)).toEqual([
      {
        type: "content",
        speaker: "npc",
        sourceSpeaker: "Sage",
        text: "Welcome.",
      },
    ])
    expect(restoredConversation.getCurrentDialogue()?.id).toBe("greeting")

    const exploration = world.dispatch(world.initialState, world.actions.area("field").enter())
    const encounter = world.dispatch(
      exploration.state,
      world.actions.area("field").encounter("slime"),
    )
    expect(encounter.state.type).toBe("battle")
    const started = world.dispatch(encounter.state, world.actions.battle.start())
    expect(started.state.type).toBe("battle")
    if (started.state.type !== "battle") throw new TypeError("Expected battle")

    const battleEnvelope = world.save(started.state, codec)
    expect(battleEnvelope.snapshot.scene).toMatchObject({
      type: "battle",
      runtimeFormat: "standard-battle",
      phase: { phase: "turnOrder" },
    })
    const restoredBattle = world.restore(JSON.parse(JSON.stringify(battleEnvelope)), codec)
    expect(restoredBattle.type).toBe("battle")
    if (restoredBattle.type !== "battle" || restoredBattle.phase.phase !== "turnOrder") {
      throw new TypeError("Expected turn-order battle")
    }
    expect(restoredBattle.phase.context.enemies.getAllMonsters()[0]).toMatchObject({
      id: "slime_0",
      groupId: "slime",
    })
    if (started.state.phase.phase !== "turnOrder") throw new TypeError("Expected turn order")
    expect(restoredBattle.phase.getCurrentActor()).toEqual(started.state.phase.getCurrentActor())

    const lockedReturnAreaTamper = JSON.parse(JSON.stringify(battleEnvelope)) as {
      snapshot: { scene: { returnAreaId: string } }
    }
    lockedReturnAreaTamper.snapshot.scene.returnAreaId = "locked_cave"
    expectStandardSessionError(() => world.restore(lockedReturnAreaTamper, codec), {
      code: "SCENE_REFERENCE_INVALID",
      path: "$.scene.returnAreaId",
      referenceId: "locked_cave",
    })
  })

  it("battle actorを実行時と同じcustom preset・装備補正から復元する", () => {
    type ArcaneTypes = WizTypes & {
      readonly BattleStatus: WizDefaultBattleStatus & {
        readonly arcane: number
      }
    }

    const initial = CONTENT.createInitialSnapshot().toPlain()
    const snapshot = WorldSnapshot.create({
      ...initial,
      player: {
        ...initial.player,
        abilityIds: ["focus"],
      },
      partyMembers: [
        {
          id: "companion",
          name: "Companion",
          classId: "warrior",
          level: 1,
          hp: 10,
          maxHp: 10,
          mp: 0,
          maxMp: 0,
          attributes: {
            strength: 1,
            dexterity: 1,
            agility: 1,
            vitality: 1,
            wisdom: 1,
            charisma: 1,
          },
          abilityIds: [],
        },
      ],
      inventory: {
        ...initial.inventory,
        entries: [
          ...initial.inventory.entries,
          {
            entryId: "blade-entry",
            contentType: "weapon",
            contentId: "blade",
            quantity: 1,
          },
        ],
      },
      equipment: {
        ...initial.equipment,
        mainHand: "blade-entry",
      },
    })
    const preset = WizPresetValue.create<ArcaneTypes>({
      effect: { defaultBuffTurns: 8 },
      statusConversion: {
        attackFormula: () => 40,
        customStatusFormula: () => ({ arcane: 73 }),
      },
    })
    const verifyMonsterAuthorityRequirement = () => {
      // @ts-expect-error custom BattleStatusは全monsterの必須fieldを生成するauthorityが必要。
      WizStandardSceneWorld.create({ content: CONTENT, preset })
    }
    const world = WizStandardSceneWorld.create<
      typeof CONTENT.arrays,
      never,
      never,
      never,
      ArcaneTypes
    >({
      battleMonsterAdapter: WizSceneBattleMonsterAdapter.define({
        statusCustom: () => ({ arcane: 73 }),
      }),
      content: CONTENT,
      initialSnapshot: snapshot,
      preset,
    })
    expect(typeof verifyMonsterAuthorityRequirement).toBe("function")
    const codec = WizStandardSessionCodec.create({ contentVersion: "content-v1" })
    const exploration = world.dispatch(world.initialState, world.actions.area("field").enter())
    const encounter = world.dispatch(
      exploration.state,
      world.actions.area("field").encounter("slime"),
    )
    const started = world.dispatch(encounter.state, world.actions.battle.start())
    expect(started.state.type).toBe("battle")
    if (started.state.type !== "battle") throw new TypeError("Expected battle")
    const startedStatus = started.state.phase.context.party
      .requireMemberById("player")
      .status.toFormulaView()
    const startedArcaneIsExactlyNumber: Expect<Exact<typeof startedStatus.arcane, number>> = true
    expect(startedArcaneIsExactlyNumber).toBe(true)
    expect(startedStatus.arcane).toBe(73)
    expect(
      started.state.phase.context.party.getMemberById("player")?.status.toFormulaView(),
    ).toMatchObject({
      attack: 45,
      arcane: 73,
    })
    expect(
      started.state.phase.context.enemies.getAllMonsters()[0].status.toFormulaView().arcane,
    ).toBe(73)

    const focused = world.dispatch(
      started.state,
      world.actions.battle.useAbility("player", "focus", ["player"]),
    )
    expect(focused.accepted).toBe(true)
    expect(focused.state.type).toBe("battle")
    if (focused.state.type !== "battle") throw new TypeError("Expected battle")
    expect(
      focused.state.phase.context.party.getMemberById("player")?.effects.effects[0]?.payload,
    ).toMatchObject({
      name: "Focus",
      modifier: { attack: 4 },
      source: { kind: "ability", id: "focus" },
    })

    const envelope = world.save(focused.state, codec)
    const restorableEnvelope = JSON.parse(JSON.stringify(envelope)) as MutableBattleEnvelope
    const restored = world.restore(restorableEnvelope, codec)
    expect(restored.type).toBe("battle")
    if (restored.type !== "battle") throw new TypeError("Expected battle")
    const restoredStatus = restored.phase.context.party
      .requireMemberById("player")
      .status.toFormulaView()
    const restoredArcaneIsExactlyNumber: Expect<Exact<typeof restoredStatus.arcane, number>> = true
    expect(restoredArcaneIsExactlyNumber).toBe(true)
    expect(restored.phase.context.enemies.getAllMonsters()[0].status.toFormulaView().arcane).toBe(
      73,
    )
    expect(restoredStatus.arcane).toBe(73)
    expect(
      restored.phase.context.party.getMemberById("player")?.status.toFormulaView(),
    ).toMatchObject({
      attack: 45,
      arcane: 73,
    })
    expect(
      restored.phase.context.party.getMemberById("player")?.effects.effects[0]?.lifetime,
    ).toEqual({ type: "turns", remaining: 8 })

    const defeatedCompanionEnvelope = JSON.parse(
      JSON.stringify(restorableEnvelope),
    ) as MutableBattleEnvelope & {
      snapshot: {
        world: {
          partyMembers: Array<{ id: string; hp: number }>
        }
      }
    }
    defeatedCompanionEnvelope.snapshot.world.partyMembers[0]!.hp = 0
    const companion = defeatedCompanionEnvelope.snapshot.scene.phase.context.party.members.find(
      (member) => member.id === "companion",
    )
    if (!companion) throw new TypeError("Expected companion")
    companion.status.resources.health.current = 0
    const restoredDefeatedCompanion = world.restore(defeatedCompanionEnvelope, codec)
    expect(restoredDefeatedCompanion.type).toBe("battle")
    if (restoredDefeatedCompanion.type !== "battle") throw new TypeError("Expected battle")
    expect(
      restoredDefeatedCompanion.phase.context.party
        .getMemberById("companion")
        ?.status.resources.current("health"),
    ).toBe(0)

    const tampered = JSON.parse(JSON.stringify(restorableEnvelope)) as MutableBattleEnvelope
    tampered.snapshot.scene.phase.context.party.members[0]!.status.attributes.attack = 40
    try {
      world.restore(tampered, codec)
      throw new TypeError("Expected canonical custom battle actor rejection")
    } catch (error) {
      expect(error).toBeInstanceOf(WizStandardSessionError)
      expect(error).toMatchObject({
        code: "SCENE_REFERENCE_INVALID",
        path: "$.scene.phase.context.party.members[0].status.attributes",
      })
    }
  })

  it("battle参照をcanonical content・actor graph・turn orderへ相関検証する", () => {
    const world = createWorld()
    const codec = WizStandardSessionCodec.create({ contentVersion: "content-v1" })
    const exploration = world.dispatch(world.initialState, world.actions.area("field").enter())
    const encounter = world.dispatch(
      exploration.state,
      world.actions.area("field").encounter("slime"),
    )
    const started = world.dispatch(encounter.state, world.actions.battle.start())
    expect(started.state.type).toBe("battle")
    if (started.state.type !== "battle" || started.state.phase.phase !== "turnOrder") {
      throw new TypeError("Expected turn-order battle")
    }
    const sourceEnvelope = world.save(started.state, codec)
    const canonicalActionEnvelope = JSON.parse(
      JSON.stringify(sourceEnvelope),
    ) as MutableBattleEnvelope
    canonicalActionEnvelope.snapshot.scene.phase.context.executedActions.push({
      id: "canonical-item-action",
      type: "item",
      actorId: "player",
      targetIds: ["player"],
      abilityId: null,
      itemId: "tonic",
    })
    const playerTurnOrderIndex = canonicalActionEnvelope.snapshot.scene.phase.turnOrder.findIndex(
      (actor) => actor.actorId === "player",
    )
    if (playerTurnOrderIndex < 0) throw new TypeError("Expected player turn-order entry")
    canonicalActionEnvelope.snapshot.scene.phase.currentActorIndex = playerTurnOrderIndex + 1
    const restoredCanonicalAction = world.restore(canonicalActionEnvelope, codec)
    expect(restoredCanonicalAction.type).toBe("battle")
    if (
      restoredCanonicalAction.type !== "battle" ||
      restoredCanonicalAction.phase.phase !== "turnOrder"
    ) {
      throw new TypeError("Expected restored turn-order battle")
    }
    expect(restoredCanonicalAction.phase.context.executedActions[0]).toMatchObject({
      id: "canonical-item-action",
      itemId: "tonic",
    })

    const expectRejected = (
      mutate: (scene: MutableBattleEnvelope["snapshot"]["scene"]) => void,
      path: string,
    ): void => {
      const envelope = JSON.parse(JSON.stringify(sourceEnvelope)) as MutableBattleEnvelope
      mutate(envelope.snapshot.scene)
      try {
        world.restore(envelope, codec)
        throw new TypeError(`Expected battle correlation rejection at ${path}`)
      } catch (error) {
        expect(error).toBeInstanceOf(WizStandardSessionError)
        expect(error).toMatchObject({
          code: expect.stringMatching(/^SCENE_REFERENCE_/),
          path,
        })
      }
    }

    expectRejected((scene) => {
      scene.phase.context.enemies.groups[0]!.id = "missing-monster"
    }, "$.scene.phase.context.enemies.groups[0].id")

    expectRejected((scene) => {
      scene.phase.context.enemies.groups[0]!.members[0]!.groupId = "different-group"
    }, "$.scene.phase.context.enemies.groups[0].members[0].groupId")

    expectRejected((scene) => {
      const first = scene.phase.context.enemies.groups[0]!.members[0]!
      scene.phase.context.enemies.groups[0]!.members.push({
        ...JSON.parse(JSON.stringify(first)),
        id: "slime_1",
      })
    }, "$.scene.phase.context.enemies.groups[0].members")

    expectRejected((scene) => {
      scene.phase.context.initiative = "party"
    }, "$.scene.phase.context.initiative")

    expectRejected((scene) => {
      scene.phase.context.party.members[0]!.name = "Forged hero"
    }, "$.scene.phase.context.party.members[0].name")

    expectRejected((scene) => {
      scene.phase.context.party.members[0]!.custom = { abilityIds: ["forged-skill"] }
    }, "$.scene.phase.context.party.members[0].custom")

    for (const field of ["attack", "defense", "speed"] as const) {
      expectRejected((scene) => {
        scene.phase.context.party.members[0]!.status.attributes[field] += 1
      }, "$.scene.phase.context.party.members[0].status.attributes")
    }

    for (const resourceId of ["health", "mana"] as const) {
      expectRejected((scene) => {
        scene.phase.context.party.members[0]!.status.resources[resourceId].maximum += 1
      }, `$.scene.phase.context.party.members[0].status.resources.${resourceId}.maximum`)
    }

    expectRejected((scene) => {
      scene.phase.context.party.members[0]!.status.resources.health.current -= 1
    }, "$.scene.phase.context.party.members[0].status.resources.health.current")

    expectRejected((scene) => {
      scene.phase.context.party.members[0]!.status.resources.mana.current =
        scene.phase.context.party.members[0]!.status.resources.mana.current === 0 ? 1 : 0
    }, "$.scene.phase.context.party.members[0].status.resources.mana.current")

    expectRejected((scene) => {
      scene.phase.context.party.members[0]!.status.custom = { forged: 999 }
    }, "$.scene.phase.context.party.members[0].status.custom")

    expectRejected((scene) => {
      scene.phase.context.enemies.groups[0]!.members[0]!.custom = {
        expReward: 999,
        goldReward: 999,
        drops: [],
      }
    }, "$.scene.phase.context.enemies.groups[0].members[0].custom")

    for (const field of ["attack", "defense", "speed"] as const) {
      expectRejected((scene) => {
        scene.phase.context.enemies.groups[0]!.members[0]!.status.attributes[field] += 1
      }, "$.scene.phase.context.enemies.groups[0].members[0].status.attributes")
    }

    for (const resourceId of ["health", "mana"] as const) {
      expectRejected((scene) => {
        scene.phase.context.enemies.groups[0]!.members[0]!.status.resources[resourceId].maximum += 1
      }, `$.scene.phase.context.enemies.groups[0].members[0].status.resources.${resourceId}.maximum`)
    }

    expectRejected((scene) => {
      scene.phase.context.enemies.groups[0]!.members[0]!.status.custom = {
        expReward: 999,
        goldReward: 999,
        drops: [],
      }
    }, "$.scene.phase.context.enemies.groups[0].members[0].status.custom")

    expectRejected((scene) => {
      const monster = scene.phase.context.enemies.groups[0]!.members[0]!
      monster.status.resources.health.current = monster.status.resources.health.maximum + 1
    }, "$.scene.phase.context.enemies.groups[0].members[0].status.resources.health.current")

    expectRejected((scene) => {
      scene.phase.context.enemies.groups[0]!.members[0]!.status.resources.mana.current = 1
    }, "$.scene.phase.context.enemies.groups[0].members[0].status.resources.mana.current")

    const damagedEnemyEnvelope = JSON.parse(JSON.stringify(sourceEnvelope)) as MutableBattleEnvelope
    damagedEnemyEnvelope.snapshot.scene.phase.context.enemies.groups[0]!.members[0]!.status.resources.health.current = 1
    const restoredDamagedEnemy = world.restore(damagedEnemyEnvelope, codec)
    expect(restoredDamagedEnemy.type).toBe("battle")
    if (restoredDamagedEnemy.type !== "battle") throw new TypeError("Expected battle")
    const restoredSlime = restoredDamagedEnemy.phase.context.enemies.getMonsterById("slime_0")
    expect(restoredSlime).toMatchObject({
      name: "Slime",
      custom: {
        expReward: 1,
        goldReward: 1,
        drops: [{ itemId: "herb", chance: 100 }],
      },
    })
    expect(restoredSlime?.status.toFormulaView()).toMatchObject({
      hp: 1,
      maxHp: 3,
      attack: 0,
      defense: 0,
      speed: 0,
    })

    const canonicalEffectEnvelope = JSON.parse(
      JSON.stringify(sourceEnvelope),
    ) as MutableBattleEnvelope
    canonicalEffectEnvelope.snapshot.scene.phase.context.party.members[0]!.effects.push({
      instanceId: "focus-player-effect",
      effectId: "attackUp",
      sourceId: "focus",
      tags: [],
      stacks: 1,
      maximumStacks: 1,
      lifetime: { type: "turns", remaining: 3 },
      payload: {
        name: "Focus",
        modifier: { attack: 4 },
        source: { kind: "ability", id: "focus" },
        custom: {},
      },
    })
    const restoredCanonicalEffect = world.restore(canonicalEffectEnvelope, codec)
    expect(restoredCanonicalEffect.type).toBe("battle")
    if (restoredCanonicalEffect.type !== "battle") throw new TypeError("Expected battle")
    expect(
      restoredCanonicalEffect.phase.context.party.getMemberById("player")?.effects.effects[0],
    ).toMatchObject({
      instanceId: "focus-player-effect",
      effectId: "attackUp",
      lifetime: { type: "turns", remaining: 3 },
      payload: {
        name: "Focus",
        modifier: { attack: 4 },
        source: { kind: "ability", id: "focus" },
        custom: {},
      },
    })

    expectRejected((scene) => {
      scene.phase.context.party.members[0]!.effects.push({
        instanceId: "focus-player-effect",
        effectId: "attackUp",
        sourceId: "focus",
        tags: [],
        stacks: 1,
        maximumStacks: 1,
        lifetime: { type: "turns", remaining: 3 },
        payload: {
          name: "Focus",
          modifier: { attack: 999 },
          source: { kind: "ability", id: "focus" },
          custom: {},
        },
      })
    }, "$.scene.phase.context.party.members[0].effects[0]")

    expectRejected((scene) => {
      scene.phase.context.party.members[0]!.effects.push({
        instanceId: "focus-player-effect",
        effectId: "attackUp",
        sourceId: "focus",
        tags: [],
        stacks: 1,
        maximumStacks: 1,
        lifetime: { type: "turns", remaining: 4 },
        payload: {
          name: "Focus",
          modifier: { attack: 4 },
          source: { kind: "ability", id: "focus" },
          custom: {},
        },
      })
    }, "$.scene.phase.context.party.members[0].effects[0].lifetime")

    expectRejected((scene) => {
      const effect: MutableBattleEffectData = {
        instanceId: "defend-player-effect",
        effectId: "defending",
        sourceId: "defend-action",
        tags: ["battle.defending"],
        stacks: 1,
        maximumStacks: 1,
        lifetime: { type: "turns", remaining: 1 },
        payload: {
          name: "Defending",
          modifier: {},
          source: { kind: "system", id: "defend-action" },
        },
      }
      scene.phase.context.party.members[0]!.effects.push(effect, JSON.parse(JSON.stringify(effect)))
    }, "$.scene.phase.context.party.members[0].effects[1].instanceId")

    expectRejected((scene) => {
      scene.phase.context.executedActions.push({
        id: "missing-item-action",
        type: "item",
        actorId: "player",
        targetIds: ["player"],
        abilityId: null,
        itemId: "missing-item",
      })
    }, "$.scene.phase.context.executedActions[0].itemId")

    expectRejected((scene) => {
      scene.phase.context.executedActions.push({
        id: "missing-skill-action",
        type: "ability",
        actorId: "player",
        targetIds: ["slime_0"],
        abilityId: "missing-skill",
        itemId: null,
      })
    }, "$.scene.phase.context.executedActions[0].abilityId")

    expectRejected((scene) => {
      scene.phase.context.executedActions.push({
        id: "unknown-actor-action",
        type: "attack",
        actorId: "unknown-actor",
        targetIds: ["slime_0"],
        abilityId: null,
        itemId: null,
      })
    }, "$.scene.phase.context.executedActions[0].actorId")

    expectRejected((scene) => {
      scene.phase.context.party.members.push(
        JSON.parse(JSON.stringify(scene.phase.context.party.members[0]!)),
      )
    }, "$.scene.phase.context.party.members[1].id")

    expectRejected((scene) => {
      scene.phase.context.executedActions.push({
        id: "unknown-target-action",
        type: "attack",
        actorId: "player",
        targetIds: ["unknown-target"],
        abilityId: null,
        itemId: null,
      })
    }, "$.scene.phase.context.executedActions[0].targetIds[0]")

    expectRejected((scene) => {
      scene.phase.context.executedActions.push({
        id: "duplicate-target-action",
        type: "attack",
        actorId: "player",
        targetIds: ["slime_0", "slime_0"],
        abilityId: null,
        itemId: null,
      })
    }, "$.scene.phase.context.executedActions[0].targetIds[1]")

    expectRejected((scene) => {
      scene.phase.turnOrder.push({ ...scene.phase.turnOrder[0]! })
    }, "$.scene.phase.turnOrder[2].actorId")

    expectRejected((scene) => {
      scene.phase.turnOrder[0]!.actorId = "unknown-turn-actor"
    }, "$.scene.phase.turnOrder[0].actorId")

    const speedTamper = JSON.parse(JSON.stringify(sourceEnvelope)) as MutableBattleEnvelope
    speedTamper.snapshot.scene.phase.turnOrder[0]!.speed = 999
    const restoredSpeedTamper = world.restore(speedTamper, codec)
    expect(restoredSpeedTamper.type).toBe("battle")
    if (restoredSpeedTamper.type !== "battle" || restoredSpeedTamper.phase.phase !== "turnOrder") {
      throw new TypeError("Expected turn-order battle")
    }
    expect(restoredSpeedTamper.phase.turnOrder[0]!.speed).not.toBe(999)
    expect(restoredSpeedTamper.phase.turnOrder[0]!.speed).toBe(
      restoredSpeedTamper.phase.context.getActorSpeed(restoredSpeedTamper.phase.turnOrder[0]!.id),
    )

    expectRejected((scene) => {
      scene.phase.context.executedActions.push({
        id: "unprocessed-action",
        type: "attack",
        actorId: "player",
        targetIds: ["slime_0"],
        abilityId: null,
        itemId: null,
      })
      scene.phase.currentActorIndex = 0
    }, "$.scene.phase.context.executedActions[0].actorId")

    expectRejected((scene) => {
      scene.phase.context.executedActions.push(
        {
          id: "first-player-action",
          type: "attack",
          actorId: "player",
          targetIds: ["slime_0"],
          abilityId: null,
          itemId: null,
        },
        {
          id: "second-player-action",
          type: "defend",
          actorId: "player",
          targetIds: ["player"],
          abilityId: null,
          itemId: null,
        },
      )
    }, "$.scene.phase.context.executedActions[1].actorId")
  })

  it("plugin scene codecをstate/data両側で推論し、methodを保存しない", () => {
    type CampState = WizRpgSceneState<"camp", { readonly rests: number }>
    let schemaValidationCount = 0
    const campSchema = z
      .strictObject({ storedRests: z.number().int().nonnegative() })
      .transform((input) => {
        schemaValidationCount += 1
        return { rests: input.storedRests + 1 }
      })
    let restoreContext: WizStandardPluginSceneRestoreContext<typeof CONTENT.arrays> | undefined
    const campCodec = WizStandardPluginSceneCodec.define<
      CampState,
      { readonly storedRests: number },
      { readonly rests: number },
      typeof CONTENT.arrays
    >({
      type: "camp",
      schema: campSchema,
      capture: (state) => ({ storedRests: state.data.rests - 1 }),
      restore: (data, context) => {
        restoreContext = context
        return WizRpgSceneState.create("camp", context.vault, data)
      },
    })
    const codec = WizStandardSessionCodec.create({
      contentVersion: "content-v1",
      pluginScenes: [campCodec] as const,
    })
    const privateRegistryView = codec as unknown as {
      pluginScenes: Map<string, unknown>
    }
    expect(Reflect.ownKeys(codec)).not.toContain("pluginScenes")
    expect(() => privateRegistryView.pluginScenes.clear()).toThrow(TypeError)
    expect(() =>
      WizStandardSessionCodec.create({
        contentVersion: "content-v1",
        pluginScenes: [campCodec, campCodec] as const,
      }),
    ).toThrow('Duplicate plugin scene codec "camp"')
    const campModule = WizPluginSceneModule.define({
      type: "camp",
      action: z.object({ type: z.literal("REST_AT_CAMP") }).strict(),
      navigation: {
        from: ["village"],
        schema: z.object({ rests: z.number().int().nonnegative() }).strict(),
        create: (vault, payload): CampState =>
          WizRpgSceneState.create("camp", vault, { rests: payload.rests }),
      },
      reduce: (state: CampState) => WizPluginSceneResultFactory.accept(state),
    })
    const pluginScenes = WizPluginSceneRegistry.define([campModule])
    const world = WizStandardSceneWorld.create({
      content: CONTENT,
      initialTransition: campModule.enter({ rests: 2 }),
      pluginScenes,
    })

    const envelope = world.save(world.initialState, codec)
    expect(schemaValidationCount).toBe(1)
    if (world.initialState.type !== "camp") throw new TypeError("Expected camp")
    const captured = campCodec.capture(world.initialState)
    expect(schemaValidationCount).toBe(2)
    expect(envelope.snapshot.scene).toEqual({
      type: "plugin",
      sceneType: "camp",
      data: { storedRests: 1 },
    })
    expect(captured).toEqual({ storedRests: 1 })
    expect(Object.isFrozen(captured)).toBe(true)
    if (envelope.snapshot.scene.type !== "plugin") throw new TypeError("Expected plugin scene")
    expect("withVault" in envelope.snapshot.scene.data).toBe(false)

    const parsed = codec.parse(JSON.parse(JSON.stringify(envelope)))
    expect(schemaValidationCount).toBe(3)
    const restored = world.restore(parsed, codec)
    expect(restored).toBeInstanceOf(WizRpgSceneState)
    expect(restored.type).toBe("camp")
    if (restored.type !== "camp") throw new TypeError("Expected camp")
    expect(restored.data).toEqual({ rests: 2 })
    expect(restored.mapData((data) => ({ rests: data.rests + 1 })).data.rests).toBe(3)
    expect(schemaValidationCount).toBe(3)
    expect(restoreContext?.vault).toBe(restored.vault)
    expect(restoreContext?.content).toBe(CONTENT)
    expect(restoreContext?.content?.getItem("herb")?.name).toBe("Herb")
    expect(restoreContext?.content?.getRecipe("herb_bundle")?.id).toBe("herb_bundle")
    expect(Object.isFrozen(restoreContext)).toBe(true)

    const directSnapshot = world.session(world.initialState, codec)
    expect(schemaValidationCount).toBe(4)
    const directlyRestored = world.restore(directSnapshot, codec)
    expect(directlyRestored.type).toBe("camp")
    expect(schemaValidationCount).toBe(4)

    expect(() =>
      codec.parse({
        ...envelope,
        snapshot: {
          ...envelope.snapshot,
          scene: { type: "plugin", sceneType: "camp", data: { rests: "invalid" } },
        },
      }),
    ).toThrow()
    expect(Reflect.set(campSchema, "parse", () => ({ rests: "forged" }))).toBe(true)
    expect(() => campCodec.parse({ rests: "invalid" })).toThrow()

    const refinedCaptureCodec = WizStandardPluginSceneCodec.define<
      CampState,
      { readonly storedRests: number }
    >({
      type: "camp",
      schema: z.strictObject({ storedRests: z.number().int().nonnegative() }),
      capture: (state) => ({ storedRests: state.data.rests - 1 }),
      restore: (data, context) =>
        WizRpgSceneState.create("camp", context.vault, { rests: data.storedRests + 1 }),
    })
    const invalidCaptureState = WizRpgSceneState.create("camp", world.initialState.vault, {
      rests: 0,
    })
    expect(() => refinedCaptureCodec.capture(invalidCaptureState)).toThrow()

    const unsafeCaptureCodec = WizStandardPluginSceneCodec.define<
      CampState,
      { readonly payload: unknown }
    >({
      type: "camp",
      schema: z.strictObject({ payload: z.unknown() }),
      capture: () => ({ payload: new Date(0) }),
      restore: (_data, context) => WizRpgSceneState.create("camp", context.vault, { rests: 0 }),
    })
    expect(() => unsafeCaptureCodec.capture(invalidCaptureState)).toThrow(
      WizWorldSaveSerializationError,
    )

    let accessorReads = 0
    const accessorPayload = {}
    Object.defineProperty(accessorPayload, "value", {
      enumerable: true,
      get: () => {
        accessorReads += 1
        return 1
      },
    })
    const accessorCaptureCodec = WizStandardPluginSceneCodec.define<
      CampState,
      { readonly payload: unknown }
    >({
      type: "camp",
      schema: z.strictObject({ payload: z.unknown() }),
      capture: () => ({ payload: accessorPayload }),
      restore: (_data, context) => WizRpgSceneState.create("camp", context.vault, { rests: 0 }),
    })
    expect(() => accessorCaptureCodec.capture(invalidCaptureState)).toThrow(
      WizWorldSaveSerializationError,
    )
    expect(accessorReads).toBe(0)

    const sharedPayload = { value: 1 }
    const sharedCaptureCodec = WizStandardPluginSceneCodec.define<
      CampState,
      {
        readonly first: { readonly value: number }
        readonly second: { readonly value: number }
      }
    >({
      type: "camp",
      schema: z.strictObject({
        first: z.strictObject({ value: z.number() }),
        second: z.strictObject({ value: z.number() }),
      }),
      capture: () => ({ first: sharedPayload, second: sharedPayload }),
      restore: (_data, context) => WizRpgSceneState.create("camp", context.vault, { rests: 0 }),
    })
    expect(() => sharedCaptureCodec.capture(invalidCaptureState)).toThrow(
      WizWorldSaveSerializationError,
    )
  })

  it("plugin sceneTypeとdataをcodec tupleから相関unionとして推論する", () => {
    type CampState = WizRpgSceneState<"camp", { readonly rests: number }>
    type JournalState = WizRpgSceneState<"journal", { readonly entries: readonly string[] }>
    type AlternateCampState = WizRpgSceneState<"alternate-camp", { readonly rests: number }>
    type BroadCampState = WizRpgSceneState<string, { readonly rests: number }>

    const campCodec = WizStandardPluginSceneCodec.define<CampState, { readonly rests: number }>({
      type: "camp",
      schema: z.strictObject({ rests: z.number().int().nonnegative() }),
      capture: (state) => state.data,
      restore: (data, context) => WizRpgSceneState.create("camp", context.vault, data),
    })
    const journalCodec = WizStandardPluginSceneCodec.define<
      JournalState,
      { readonly entries: readonly string[] }
    >({
      type: "journal",
      schema: z.strictObject({ entries: z.array(z.string()) }),
      capture: (state) => state.data,
      restore: (data, context) => WizRpgSceneState.create("journal", context.vault, data),
    })
    const codec = WizStandardSessionCodec.create({
      contentVersion: "content-v1",
      pluginScenes: [campCodec, journalCodec] as const,
    })
    type ForeignItem = WorldContentArrays["items"][number] & Readonly<{ id: "foreign-item" }>
    type ForeignArrays = Omit<typeof CONTENT.arrays, "items"> &
      Readonly<{ items: readonly ForeignItem[] }>
    const foreignJournalCodec = journalCodec as unknown as WizStandardPluginSceneCodec<
      JournalState,
      { readonly entries: readonly string[] },
      { readonly entries: readonly string[] },
      ForeignArrays
    >
    const mismatchedContentCodec = WizStandardSessionCodec.create({
      contentVersion: "content-v1",
      pluginScenes: [campCodec, foreignJournalCodec] as const,
    })
    const world = createWorld()
    const envelope = codec.encode(
      WizRpgSceneState.create("camp", world.initialState.vault, { rests: 3 }),
    )
    const parsed = codec.parse(envelope)

    if (parsed.scene.type !== "plugin") throw new TypeError("Expected plugin scene")
    if (parsed.scene.sceneType === "camp") {
      expect(parsed.scene.data.rests).toBe(3)
      // @ts-expect-error camp data cannot expose journal fields.
      void parsed.scene.data.entries
    } else {
      expect(parsed.scene.data.entries).toEqual([])
      // @ts-expect-error journal data cannot expose camp fields.
      void parsed.scene.data.rests
    }

    const builtInCodec = WizStandardSessionCodec.create({ contentVersion: "content-v1" })
    const builtInSnapshot = builtInCodec.capture(world.initialState)
    const assertNever = <T extends never>(_value?: T): void => {}
    assertNever<Extract<typeof builtInSnapshot.scene, { readonly type: "plugin" }>>()

    const verifyPluginCodecTypes = (): void => {
      const typedWorld = world as unknown as WizStandardSceneWorld<
        typeof CONTENT.arrays,
        CampState | JournalState
      >
      const typedState = typedWorld.initialState as WizStandardState<CampState | JournalState>
      typedWorld.session(typedState, codec)
      // @ts-expect-error every plugin codec content requirement must accept the world content.
      typedWorld.session(typedState, mismatchedContentCodec)

      const unionStateDefinition = {
        type: "camp" as const,
        schema: z.strictObject({ rests: z.number() }),
        capture: (state: CampState | AlternateCampState) => state.data,
        restore: (
          data: { readonly rests: number },
          context: WizStandardPluginSceneRestoreContext,
        ) => WizRpgSceneState.create("camp", context.vault, data),
      }
      type UnionCampState = CampState | AlternateCampState
      WizStandardPluginSceneCodec.define<UnionCampState, { readonly rests: number }>(
        // @ts-expect-error one scene codec cannot claim a union of scene discriminants.
        unionStateDefinition,
      )

      const broadStateDefinition = {
        type: "camp",
        schema: z.strictObject({ rests: z.number() }),
        capture: (state: BroadCampState) => state.data,
        restore: (
          data: { readonly rests: number },
          context: WizStandardPluginSceneRestoreContext,
        ) => WizRpgSceneState.create("camp", context.vault, data),
      } as const
      WizStandardPluginSceneCodec.define<BroadCampState, { readonly rests: number }>(
        // @ts-expect-error one scene codec requires a single literal scene discriminant.
        broadStateDefinition,
      )
    }
    void verifyPluginCodecTypes
  })

  it("plugin codecはmarkerなし・mutableなscene stateをruntimeでも拒否する", () => {
    type CampState = WizRpgSceneState<"camp", { readonly rests: number }>
    const world = createWorld()
    const codec = WizStandardPluginSceneCodec.define<CampState, { readonly rests: number }>({
      type: "camp",
      schema: z.strictObject({ rests: z.number() }),
      capture: (state) => state.data,
      restore: (data, context) =>
        Object.freeze({
          type: "camp",
          vault: context.vault,
          data: Object.freeze({ ...data }),
        }) as unknown as CampState,
    })

    expectStandardSessionError(
      () =>
        codec.restore(
          { rests: 1 },
          {
            vault: world.initialState.vault,
            content: world.content,
          },
        ),
      {
        code: "PLUGIN_SCENE_IMMUTABLE_CONTRACT_MISMATCH",
        path: "$.scene",
      },
    )

    const forged = {
      type: "camp",
      vault: world.initialState.vault,
      data: { rests: 1 },
    } as unknown as CampState
    expectStandardSessionError(() => codec.capture(forged), {
      code: "PLUGIN_SCENE_IMMUTABLE_CONTRACT_MISMATCH",
      path: "$.scene",
    })

    const wrongTypeCodec = WizStandardPluginSceneCodec.define<
      CampState,
      { readonly rests: number }
    >({
      type: "camp",
      schema: z.strictObject({ rests: z.number() }),
      capture: (state) => state.data,
      restore: (data, context) =>
        WizRpgSceneState.create("journal", context.vault, data) as unknown as CampState,
    })
    expectStandardSessionError(
      () =>
        wrongTypeCodec.restore(
          { rests: 1 },
          {
            vault: world.initialState.vault,
            content: world.content,
          },
        ),
      {
        code: "PLUGIN_SCENE_TYPE_MISMATCH",
        path: "$.scene.type",
      },
    )
  })

  it("plugin codecは所有前のsceneからtypeやvaultを読まない", () => {
    type CampState = WizRpgSceneState<"camp", { readonly rests: number }>
    const world = createWorld()
    let propertyReads = 0
    const hostileState = new Proxy(
      {
        type: "camp",
        vault: world.initialState.vault,
        data: { rests: 1 },
      },
      {
        get: (target, property, receiver) => {
          if (property === "type" || property === "vault") {
            propertyReads += 1
          }
          return Reflect.get(target, property, receiver)
        },
      },
    ) as unknown as CampState
    const codec = WizStandardPluginSceneCodec.define<CampState, { readonly rests: number }>({
      type: "camp",
      schema: z.strictObject({ rests: z.number() }),
      capture: (state) => state.data,
      restore: () => hostileState,
    })

    expectStandardSessionError(() => codec.capture(hostileState), {
      code: "PLUGIN_SCENE_IMMUTABLE_CONTRACT_MISMATCH",
      path: "$.scene",
    })
    expectStandardSessionError(
      () =>
        codec.restore(
          { rests: 1 },
          {
            vault: world.initialState.vault,
            content: world.content,
          },
        ),
      {
        code: "PLUGIN_SCENE_IMMUTABLE_CONTRACT_MISMATCH",
        path: "$.scene",
      },
    )
    expect(propertyReads).toBe(0)
  })

  it("壊れたunknown・非JSON値・未登録pluginを拒否する", () => {
    const world = createWorld()
    const codec = WizStandardSessionCodec.create({ contentVersion: "content-v1" })
    const valid = world.save(world.initialState, codec)

    expect(() =>
      world.restore(
        {
          ...valid,
          snapshot: {
            ...valid.snapshot,
            scene: { type: "exploration", areaId: 42 },
          },
        },
        codec,
      ),
    ).toThrow()

    expect(() =>
      codec.parse({
        ...valid,
        snapshot: {
          ...valid.snapshot,
          scene: {
            type: "plugin",
            sceneType: "camp",
            data: { createdAt: new Date() },
          },
        },
      }),
    ).toThrow(WizWorldSaveSerializationError)

    expect(() =>
      world.restore(
        {
          ...valid,
          snapshot: {
            ...valid.snapshot,
            scene: { type: "plugin", sceneType: "camp", data: {} },
          },
        },
        codec,
      ),
    ).toThrow(WizStandardSessionError)
  })

  it("built-in scene messageをdiscriminated unionの必須fieldまで検証する", () => {
    const world = createWorld()
    const codec = WizStandardSessionCodec.create({ contentVersion: "content-v1" })
    const shop = world.dispatch(world.initialState, world.actions.shop("item_shop").enter()).state
    const inn = world.dispatch(world.initialState, world.actions.enterInn()).state
    const exploration = world.dispatch(
      world.initialState,
      world.actions.area("field").enter(),
    ).state
    const crafting = world.dispatch(world.initialState, world.actions.enterCrafting()).state
    const quest = world.dispatch(world.initialState, world.actions.openQuestBoard()).state

    if (
      shop.type !== "shop" ||
      inn.type !== "inn" ||
      exploration.type !== "exploration" ||
      crafting.type !== "crafting" ||
      quest.type !== "quest"
    ) {
      throw new TypeError("Expected built-in scenes")
    }

    const invalidScenes = [
      {
        label: "shop",
        scene: {
          ...world.save(shop, codec).snapshot.scene,
          message: { type: "purchase_prompt" },
        },
      },
      {
        label: "inn",
        scene: {
          ...world.save(inn, codec).snapshot.scene,
          message: { type: "stay_rejected" },
        },
      },
      {
        label: "exploration",
        scene: {
          ...world.save(exploration, codec).snapshot.scene,
          message: { type: "items_gathered", areaId: "field" },
        },
      },
      {
        label: "crafting",
        scene: {
          ...world.save(crafting, codec).snapshot.scene,
          message: { type: "missing_facility", recipeId: "herb_bundle" },
        },
      },
      {
        label: "quest",
        scene: {
          ...world.save(quest, codec).snapshot.scene,
          message: { type: "quest_completed", questId: "gather_herb" },
        },
      },
    ]
    const base = world.save(world.initialState, codec)

    for (const { label, scene } of invalidScenes) {
      expect(
        () =>
          codec.parse({
            ...base,
            snapshot: {
              ...base.snapshot,
              scene,
            },
          }),
        label,
      ).toThrow()
    }
  })

  it("shopの価格権限をcontentから再構築しsave内のmodifier・pending price改ざんを拒否する", () => {
    const world = createWorld()
    const codec = WizStandardSessionCodec.create({ contentVersion: "content-v1" })
    const itemShop = world.actions.shop("item_shop")
    const entered = world.dispatch(world.initialState, itemShop.enter())
    const selected = world.dispatch(entered.state, itemShop.selectItemToBuy("herb"))

    expect(selected.state.type).toBe("shop")
    if (selected.state.type !== "shop") throw new TypeError("Expected shop")
    expect(selected.state.buyPriceModifier).toBe(0.5)
    expect(selected.state.pendingPurchase).toEqual({
      type: "item",
      itemId: "herb",
      price: 2,
    })

    const envelope = world.save(selected.state, codec)
    const restored = world.restore(JSON.parse(JSON.stringify(envelope)), codec)
    expect(restored.type).toBe("shop")
    if (restored.type !== "shop") throw new TypeError("Expected shop")
    expect(restored.buyPriceModifier).toBe(0.5)
    expect(restored.pendingPurchase?.price).toBe(2)

    const modifierTamper = JSON.parse(JSON.stringify(envelope)) as {
      snapshot: { scene: { buyPriceModifier: number } }
    }
    modifierTamper.snapshot.scene.buyPriceModifier = 0
    expect(() => world.restore(modifierTamper, codec)).toThrow(WizStandardSessionError)

    const priceTamper = JSON.parse(JSON.stringify(envelope)) as {
      snapshot: {
        scene: {
          pendingPurchase: { price: number }
          message: { price: number }
        }
      }
    }
    priceTamper.snapshot.scene.pendingPurchase.price = 0
    priceTamper.snapshot.scene.message.price = 0
    expect(() => world.restore(priceTamper, codec)).toThrow(WizStandardSessionError)

    const crossShopTamper = JSON.parse(JSON.stringify(envelope)) as {
      snapshot: {
        scene: {
          shopId: string
          buyPriceModifier: number
        }
      }
    }
    crossShopTamper.snapshot.scene.shopId = "weapon_shop"
    crossShopTamper.snapshot.scene.buyPriceModifier = 1
    try {
      world.restore(crossShopTamper, codec)
      throw new TypeError("Expected cross-shop product rejection")
    } catch (error) {
      expect(error).toBeInstanceOf(WizStandardSessionError)
      expect(error).toMatchObject({
        code: "SCENE_REFERENCE_INVALID",
        path: "$.scene.pendingPurchase.itemId",
        referenceId: "herb",
      })
    }

    const shopIdTamper = JSON.parse(JSON.stringify(envelope)) as {
      snapshot: {
        scene: {
          shopId: string
          buyPriceModifier: number
          pendingPurchase: unknown
          message: unknown
          conversation: unknown
          lastConversation: unknown
        }
      }
    }
    Object.assign(shopIdTamper.snapshot.scene, {
      shopId: "missing-shop",
      buyPriceModifier: 1,
      pendingPurchase: null,
      message: null,
      conversation: null,
      lastConversation: null,
    })
    try {
      world.restore(shopIdTamper, codec)
      throw new TypeError("Expected unknown shop rejection")
    } catch (error) {
      expect(error).toBeInstanceOf(WizStandardSessionError)
      expect(error).toMatchObject({
        code: "SCENE_REFERENCE_NOT_FOUND",
        path: "$.scene.shopId",
        referenceId: "missing-shop",
      })
    }
    const purchased = world.dispatch(restored, world.actions.confirmPurchase())
    expect(purchased.accepted).toBe(true)
    expect(purchased.state.vault.player.gold).toBe(restored.vault.player.gold - 2)
  })

  it("level-upの残ポイントをpreset budgetとpending配分から検証・再構築する", () => {
    const initial = CONTENT.createInitialSnapshot().toPlain()
    const world = WizStandardSceneWorld.create({
      content: CONTENT,
      initialSnapshot: WorldSnapshot.create({
        ...initial,
        player: {
          ...initial.player,
          exp: initial.player.expToNextLevel,
        },
      }),
      initialTransition: { type: "GO_TO_LEVEL_UP", returnAreaId: null },
      environment: WizWorldEnvironment.create({
        nextId: () => "session-action",
        now: () => 100,
        random: () => 0.5,
      }),
    })
    const codec = WizStandardSessionCodec.create({ contentVersion: "content-v1" })
    const strength = world.dispatch(world.initialState, world.actions.allocateAttribute("strength"))
    const charisma = world.dispatch(strength.state, world.actions.allocateAttribute("charisma"))
    const envelope = world.save(charisma.state, codec)
    const restored = world.restore(JSON.parse(JSON.stringify(envelope)), codec)

    expect(restored.type).toBe("level_up")
    if (restored.type !== "level_up") throw new TypeError("Expected level-up")
    expect(restored.availablePoints).toBe(1)
    expect(restored.pendingAttributes).toEqual({ strength: 1, charisma: 1 })

    const insufficientExpTamper = JSON.parse(JSON.stringify(envelope)) as {
      snapshot: { world: { player: { exp: number } } }
    }
    insufficientExpTamper.snapshot.world.player.exp = 0
    expectStandardSessionError(() => world.restore(insufficientExpTamper, codec), {
      code: "SCENE_REFERENCE_INVALID",
      path: "$.scene.type",
    })

    const lockedReturnAreaTamper = JSON.parse(JSON.stringify(envelope)) as {
      snapshot: { scene: { returnAreaId: string | null } }
    }
    lockedReturnAreaTamper.snapshot.scene.returnAreaId = "locked_cave"
    expectStandardSessionError(() => world.restore(lockedReturnAreaTamper, codec), {
      code: "SCENE_REFERENCE_INVALID",
      path: "$.scene.returnAreaId",
      referenceId: "locked_cave",
    })

    const availablePointsTamper = JSON.parse(JSON.stringify(envelope)) as {
      snapshot: { scene: { availablePoints: number } }
    }
    availablePointsTamper.snapshot.scene.availablePoints = 999
    expect(() => world.restore(availablePointsTamper, codec)).toThrow(WizStandardSessionError)

    const pendingAttributesTamper = JSON.parse(JSON.stringify(envelope)) as {
      snapshot: {
        scene: {
          availablePoints: number
          pendingAttributes: { strength: number }
        }
      }
    }
    pendingAttributesTamper.snapshot.scene.availablePoints = 0
    pendingAttributesTamper.snapshot.scene.pendingAttributes.strength = 999
    expect(() => world.restore(pendingAttributesTamper, codec)).toThrow(WizStandardSessionError)
  })

  it("pending giftはitem IDだけを保存してcurrent contentで解決し、committed giftは当時のreceiptを保つ", () => {
    const world = createStockedWorld()
    const codec = WizStandardSessionCodec.create({ contentVersion: "content-v1" })
    const entered = world.dispatch(world.initialState, world.actions.npc("sage").talk())
    expect(entered.state.type).toBe("conversation")
    if (entered.state.type !== "conversation") throw new TypeError("Expected conversation")
    const selected = world.dispatch(entered.state, world.actions.selectGift("herb"))
    expect(selected.state.type).toBe("conversation")
    if (selected.state.type !== "conversation") throw new TypeError("Expected conversation")
    expect(selected.state.pendingGiftItemId).toBe("herb")

    const pendingEnvelope = world.save(selected.state, codec)
    expect(pendingEnvelope.snapshot.scene).toMatchObject({
      type: "conversation",
      pendingGiftItemId: "herb",
    })
    const changedContent = WorldContent.parse({
      ...CONTENT.arrays,
      npcs: CONTENT.arrays.npcs.map((npc) =>
        npc.id === "sage"
          ? {
              ...npc,
              likes: [],
              dislikes: ["herb"],
            }
          : npc,
      ),
    })
    const changedWorld = createWorld(changedContent)
    const restored = changedWorld.restore(pendingEnvelope, codec)

    expect(restored.type).toBe("conversation")
    if (restored.type !== "conversation") throw new TypeError("Expected conversation")
    expect(restored.pendingGiftItemId).toBe("herb")
    const confirmedWithCurrentContent = changedWorld.dispatch(
      restored,
      changedWorld.actions.confirmGift(),
    )
    expect(confirmedWithCurrentContent.accepted).toBe(true)
    expect(confirmedWithCurrentContent.state.vault.findNpc("sage")?.affinity).toBe(0)

    const committed = world.dispatch(selected.state, world.actions.confirmGift())
    expect(committed.state.type).toBe("conversation")
    if (committed.state.type !== "conversation") throw new TypeError("Expected conversation")
    const committedEnvelope = world.save(committed.state, codec)
    const restoredCommitted = changedWorld.restore(committedEnvelope, codec)

    expect(restoredCommitted.type).toBe("conversation")
    if (restoredCommitted.type !== "conversation") throw new TypeError("Expected conversation")
    expect(restoredCommitted.pendingGiftItemId).toBeNull()
    expect(restoredCommitted.affinityGained).toBe(17)
    expect(restoredCommitted.transcript.at(-1)).toEqual({
      type: "gift_applied",
      itemId: "herb",
      reaction: "love",
      affinityDelta: 17,
    })
    expect(presentHistory(restoredCommitted).at(-1)).toEqual({
      type: "gift_reaction",
      reaction: "love",
    })

    const reactionTamper = JSON.parse(JSON.stringify(committedEnvelope)) as {
      snapshot: {
        scene: {
          transcript: Array<{
            type: string
            reaction?: string
            affinityDelta?: number
          }>
        }
      }
    }
    const giftReceipt = reactionTamper.snapshot.scene.transcript.find(
      (entry) => entry.type === "gift_applied",
    )
    if (!giftReceipt) throw new Error("Gift receipt fixture is required")
    giftReceipt.reaction = "like"
    expect(() => changedWorld.restore(reactionTamper, codec)).toThrow()
    giftReceipt.reaction = "love"
    giftReceipt.affinityDelta = Number.NaN
    expect(() => changedWorld.restore(reactionTamper, codec)).toThrow()
  })

  it("completion receiptはtext変更・line追加後も完了を保持してbonus再適用を防ぐ", () => {
    const world = createWorld()
    const codec = WizStandardSessionCodec.create({ contentVersion: "content-v1" })
    const entered = world.dispatch(world.initialState, world.actions.npc("sage").talk())
    const completed = world.dispatch(entered.state, world.actions.advanceDialogue())

    expect(completed.state.type).toBe("conversation")
    if (completed.state.type !== "conversation") throw new TypeError("Expected conversation")
    expect(completed.state.dialogueCompleted).toBe(true)
    const affinityAfterCompletion = completed.state.vault.findNpc("sage")!.affinity

    const envelope = world.save(completed.state, codec)
    expect(JSON.stringify(envelope.snapshot.scene)).not.toContain("Welcome.")
    expect(JSON.stringify(envelope.snapshot.scene)).not.toContain("Travel safely.")

    const changedContent = WorldContent.parse({
      ...CONTENT.arrays,
      npcs: CONTENT.arrays.npcs.map((npc) =>
        npc.id === "sage"
          ? {
              ...npc,
              dialogues: npc.dialogues.map((dialogue) =>
                dialogue.id === "greeting"
                  ? {
                      ...dialogue,
                      lines: [
                        { speaker: "Sage", text: "Welcome back." },
                        { speaker: "Sage", text: "Travel very safely." },
                        { speaker: "Sage", text: "A newly added line." },
                      ],
                    }
                  : dialogue,
              ),
            }
          : npc,
      ),
    })
    const changedWorld = createWorld(changedContent)
    const restored = changedWorld.restore(envelope, codec)

    expect(restored.type).toBe("conversation")
    if (restored.type !== "conversation") throw new TypeError("Expected conversation")
    expect(restored.dialogueCompleted).toBe(true)
    expect(restored.progress.completion).toEqual({
      transcriptIndex: restored.transcript.length - 1,
    })
    expect(
      presentHistory(restored).map((entry) => ("text" in entry ? entry.text : entry.type)),
    ).toEqual(["Welcome back.", "Travel very safely."])
    const ended = changedWorld.dispatch(restored, changedWorld.actions.endConversation())
    expect(ended.state.vault.findNpc("sage")?.affinity).toBe(affinityAfterCompletion)

    const removedDialogueContent = WorldContent.parse({
      ...CONTENT.arrays,
      npcs: CONTENT.arrays.npcs.map((npc) =>
        npc.id === "sage"
          ? {
              ...npc,
              dialogues: [],
            }
          : npc,
      ),
    })
    const removedDialogueWorld = createWorld(removedDialogueContent)
    const restoredWithoutDialogue = removedDialogueWorld.restore(envelope, codec)

    expect(restoredWithoutDialogue.type).toBe("conversation")
    if (restoredWithoutDialogue.type !== "conversation") {
      throw new TypeError("Expected conversation")
    }
    expect(restoredWithoutDialogue.dialogueCompleted).toBe(true)
    expect(
      presentHistory(restoredWithoutDialogue).map((entry) =>
        "text" in entry ? entry.text : entry.type,
      ),
    ).toEqual(["[greeting#0]", "[greeting#1]"])
    const endedWithoutDialogue = removedDialogueWorld.dispatch(
      restoredWithoutDialogue,
      removedDialogueWorld.actions.endConversation(),
    )
    expect(endedWithoutDialogue.state.vault.findNpc("sage")?.affinity).toBe(affinityAfterCompletion)

    const activeEnvelope = world.save(entered.state, codec)
    expectStandardSessionError(() => removedDialogueWorld.restore(activeEnvelope, codec), {
      code: "SCENE_REFERENCE_INVALID",
      path: "$.scene.transcript[0]",
      referenceId: "greeting",
    })

    const receiptTamper = JSON.parse(JSON.stringify(envelope)) as {
      snapshot: {
        scene: {
          progress: {
            completion: { transcriptIndex: number }
          }
        }
      }
    }
    receiptTamper.snapshot.scene.progress.completion.transcriptIndex = 1
    expect(() => changedWorld.restore(receiptTamper, codec)).toThrow()

    const progressTamper = JSON.parse(JSON.stringify(envelope)) as {
      snapshot: {
        scene: {
          progress: { nextLineIndex: number }
        }
      }
    }
    progressTamper.snapshot.scene.progress.nextLineIndex = 1
    expectStandardSessionError(() => changedWorld.restore(progressTamper, codec), {
      code: "SCENE_REFERENCE_INVALID",
      path: "$.scene.progress",
    })
  })

  it("完了済みoption receiptは現在contentからoptionとdialogueが消えても復元できる", () => {
    const optionContent = WorldContent.parse({
      ...CONTENT.arrays,
      npcs: CONTENT.arrays.npcs.map((npc) =>
        npc.id === "sage"
          ? {
              ...npc,
              dialogues: [
                {
                  id: "choice",
                  minAffinity: 0,
                  lines: [{ speaker: "Sage", text: "Choose." }],
                  options: [
                    {
                      id: "accept",
                      text: "Accept",
                      affinityChange: 4,
                    },
                  ],
                },
              ],
            }
          : npc,
      ),
    })
    const world = createWorld(optionContent)
    const codec = WizStandardSessionCodec.create({ contentVersion: "content-v1" })
    const entered = world.dispatch(world.initialState, world.actions.npc("sage").talk())
    expect(entered.state.type).toBe("conversation")
    if (entered.state.type !== "conversation") throw new TypeError("Expected conversation")
    expect(entered.state.progress.phase).toBe("choosing")

    const completed = world.dispatch(
      entered.state,
      world.actions.npc("sage").dialogue("choice").choose("accept"),
    )
    expect(completed.state.type).toBe("conversation")
    if (completed.state.type !== "conversation") throw new TypeError("Expected conversation")
    expect(completed.state.dialogueCompleted).toBe(true)
    const affinityAfterOption = completed.state.vault.findNpc("sage")!.affinity
    const envelope = world.save(completed.state, codec)

    const removedContent = WorldContent.parse({
      ...optionContent.arrays,
      npcs: optionContent.arrays.npcs.map((npc) =>
        npc.id === "sage" ? { ...npc, dialogues: [] } : npc,
      ),
    })
    const removedWorld = createWorld(removedContent)
    const restored = removedWorld.restore(envelope, codec)

    expect(restored.type).toBe("conversation")
    if (restored.type !== "conversation") throw new TypeError("Expected conversation")
    expect(restored.dialogueCompleted).toBe(true)
    expect(
      presentHistory(restored).map((entry) => ("text" in entry ? entry.text : entry.type)),
    ).toEqual(["[choice#0]", "accept"])
    const ended = removedWorld.dispatch(restored, removedWorld.actions.endConversation())
    expect(ended.state.vault.findNpc("sage")?.affinity).toBe(affinityAfterOption)
  })

  it("同じprefixの高優先dialogueが追加されても保存済みdialogueIdを再選択しない", () => {
    const world = createWorld()
    const codec = WizStandardSessionCodec.create({ contentVersion: "content-v1" })
    const entered = world.dispatch(world.initialState, world.actions.npc("sage").talk())
    if (entered.state.type !== "conversation") throw new TypeError("Expected conversation")
    const envelope = world.save(entered.state, codec)

    const changedContent = WorldContent.parse({
      ...CONTENT.arrays,
      npcs: CONTENT.arrays.npcs.map((npc) =>
        npc.id === "sage"
          ? {
              ...npc,
              dialogues: [
                ...npc.dialogues,
                {
                  id: "morning-priority",
                  minAffinity: 0,
                  triggers: { timeOfDay: ["morning"] },
                  lines: [
                    { speaker: "Sage", text: "Welcome." },
                    { speaker: "Sage", text: "A different continuation." },
                  ],
                },
              ],
            }
          : npc,
      ),
    })
    const changedWorld = createWorld(changedContent)
    const newlyEntered = changedWorld.dispatch(
      changedWorld.initialState,
      changedWorld.actions.npc("sage").talk(),
    )
    expect(newlyEntered.state.type).toBe("conversation")
    if (newlyEntered.state.type !== "conversation") throw new TypeError("Expected conversation")
    expect(newlyEntered.state.dialogueId).toBe("morning-priority")

    const restored = changedWorld.restore(envelope, codec)
    expect(restored.type).toBe("conversation")
    if (restored.type !== "conversation") throw new TypeError("Expected conversation")
    expect(restored.dialogueId).toBe("greeting")
    expect(presentHistory(restored).at(-1)).toMatchObject({ text: "Welcome." })
  })

  it("giftでaffinity thresholdを跨いだ後に保存しても開始時dialogueIdを維持する", () => {
    const thresholdContent = WorldContent.parse({
      ...CONTENT.arrays,
      npcs: CONTENT.arrays.npcs.map((npc) =>
        npc.id === "sage"
          ? {
              ...npc,
              initialAffinity: 19,
              dialogues: [
                {
                  id: "before-threshold",
                  minAffinity: 0,
                  maxAffinity: 19,
                  lines: [
                    { speaker: "Sage", text: "Before one." },
                    { speaker: "Sage", text: "Before two." },
                  ],
                },
                {
                  id: "after-threshold",
                  minAffinity: 20,
                  lines: [{ speaker: "Sage", text: "After." }],
                },
              ],
            }
          : npc,
      ),
    })
    const world = createStockedWorld(thresholdContent)
    const codec = WizStandardSessionCodec.create({ contentVersion: "content-v1" })
    const entered = world.dispatch(world.initialState, world.actions.npc("sage").talk())
    if (entered.state.type !== "conversation") throw new TypeError("Expected conversation")
    expect(entered.state.dialogueId).toBe("before-threshold")

    const pending = world.dispatch(entered.state, world.actions.selectGift("herb"))
    const committed = world.dispatch(pending.state, world.actions.confirmGift())
    if (committed.state.type !== "conversation") throw new TypeError("Expected conversation")
    expect(committed.state.vault.findNpc("sage")?.affinity).toBe(36)

    const restored = world.restore(world.save(committed.state, codec), codec)
    expect(restored.type).toBe("conversation")
    if (restored.type !== "conversation") throw new TypeError("Expected conversation")
    expect(restored.dialogueId).toBe("before-threshold")

    const advanced = world.dispatch(restored, world.actions.advanceDialogue())
    expect(advanced.state.type).toBe("conversation")
    if (advanced.state.type !== "conversation") throw new TypeError("Expected conversation")
    expect(presentHistory(advanced.state).at(-1)).toMatchObject({ text: "Before two." })
  })

  it("crafting sceneの未知fieldを拒否する", () => {
    const world = createWorld()
    const codec = WizStandardSessionCodec.create({ contentVersion: "content-v1" })
    const entered = world.dispatch(world.initialState, world.actions.enterCrafting())
    expect(entered.state.type).toBe("crafting")
    if (entered.state.type !== "crafting") throw new TypeError("Expected crafting")

    const envelope = world.save(entered.state, codec)
    const invalidEnvelope = JSON.parse(JSON.stringify(envelope)) as {
      snapshot: {
        scene: Record<string, unknown>
      }
    }
    invalidEnvelope.snapshot.scene.unexpectedField = ["forged-facility"]

    expect(() => codec.parse(invalidEnvelope)).toThrow()
    expect(() => world.restore(invalidEnvelope, codec)).toThrow()
  })

  it("plugin codecはbuilt-in予約scene名を構成時に拒否する", () => {
    type ReservedState = WizRpgSceneState<"village", { readonly visits: number }>

    expect(() =>
      WizStandardPluginSceneCodec.define<ReservedState, { readonly visits: number }>({
        type: "village",
        schema: z.strictObject({ visits: z.number() }),
        capture: (state) => state.data,
        restore: (data, context) =>
          // create自体も同じvalidatorで拒否するが、codec構成時点で先に失敗する。
          WizRpgSceneState.create("village", context.vault, data),
      }),
    ).toThrow(/reserved by standard runtime/)
  })

  it("内部scene復元を公開せずcontent version境界をWorld.restoreに集約する", () => {
    const world = createWorld()
    const sourceCodec = WizStandardSessionCodec.create({ contentVersion: "content-a" })
    const mismatchedCodec = WizStandardSessionCodec.create({ contentVersion: "content-b" })
    const snapshot = sourceCodec.capture(world.initialState)

    expect("restoreScene" in mismatchedCodec).toBe(false)
    expect("fromEnvelope" in WizStandardSessionSnapshot).toBe(false)
    expect("create" in WizStandardSessionSnapshot).toBe(false)
    const verifyInternalSceneRestore = () => {
      // @ts-expect-error scene restore is an internal StandardWorld capability.
      mismatchedCodec.restoreScene(snapshot, { vault: world.initialState.vault })
    }
    const verifyInternalSnapshotConstruction = () => {
      // @ts-expect-error snapshot construction is an internal session codec capability.
      WizStandardSessionSnapshot.fromEnvelope(snapshot.toEnvelope())
    }
    void verifyInternalSceneRestore
    void verifyInternalSnapshotConstruction
    expect(() => world.restore(snapshot, mismatchedCodec)).toThrow()
  })

  it("session codecを通らないsnapshotのprototype偽造とconstructor呼び出しを拒否する", () => {
    const world = createWorld()
    const codec = WizStandardSessionCodec.create({ contentVersion: "content-v1" })
    const snapshot = codec.capture(world.initialState)
    const forgedSnapshot = Object.create(WizStandardSessionSnapshot.prototype)

    expect(() => forgedSnapshot.toEnvelope()).toThrow(
      "Standard session snapshot was not created by its session codec",
    )
    expect(() => codec.encode(forgedSnapshot)).toThrow(
      "Standard session snapshot was not created by its session codec",
    )
    expect(() =>
      Reflect.construct(WizStandardSessionSnapshot, [Symbol("forged"), snapshot.toEnvelope()]),
    ).toThrow("Standard session values must be created by their public factories")

    expect(Object.isFrozen(WizStandardPluginSceneCodec)).toBe(true)
    expect(Object.isFrozen(WizStandardPluginSceneCodec.prototype)).toBe(true)
    expect(
      Reflect.set(WizStandardPluginSceneCodec.prototype, "parse", () => ({ forged: true })),
    ).toBe(false)
    expect(Object.isFrozen(WizStandardSessionSnapshot)).toBe(true)
    expect(Object.isFrozen(WizStandardSessionSnapshot.prototype)).toBe(true)
    expect(Object.isFrozen(Object.getPrototypeOf(snapshot))).toBe(true)
    expect(Object.isFrozen(WizStandardSessionCodec)).toBe(true)
    expect(Object.isFrozen(WizStandardSessionCodec.prototype)).toBe(true)
    expect(Reflect.set(WizStandardSessionCodec.prototype, "parse", () => ({ forged: true }))).toBe(
      false,
    )
    expect(
      Reflect.set(Object.getPrototypeOf(snapshot), "toEnvelope", () => ({ forged: true })),
    ).toBe(false)
    expect(codec.encode(snapshot)).toEqual(snapshot.toEnvelope())
  })

  it("parse元・capture元とのaliasを隔離したversioned snapshotを返す", () => {
    const world = createWorld()
    const codec = WizStandardSessionCodec.create({ contentVersion: "content-v1" })
    const conversation = world.dispatch(world.initialState, world.actions.npc("sage").talk())
    const mutableEnvelope = JSON.parse(JSON.stringify(world.save(conversation.state, codec))) as {
      snapshot: {
        world: { flags: string[] }
        scene: { transcript: Array<{ lineIndex?: number }> }
      }
    }

    const session = codec.parse(mutableEnvelope)
    const restored = world.restore(session, codec)
    mutableEnvelope.snapshot.world.flags.push("changed")
    mutableEnvelope.snapshot.scene.transcript[1]!.lineIndex = 999

    expect(session).toBeInstanceOf(WizStandardSessionSnapshot)
    expect(session.schemaVersion).toBe(1)
    expect(session.world.flags).toEqual([])
    expect(session.scene).toMatchObject({
      type: "conversation",
      transcript: [
        { type: "dialogue_started", dialogueId: "greeting" },
        { type: "dialogue_line", dialogueId: "greeting", lineIndex: 0 },
      ],
    })
    expect(restored.vault.flags).toEqual([])
    expect(restored.type).toBe("conversation")
    if (restored.type !== "conversation") throw new TypeError("Expected conversation")
    expect(presentHistory(restored)[0]).toMatchObject({ text: "Welcome." })
    expect(Object.isFrozen(session)).toBe(true)
    expect(Object.isFrozen(session.scene)).toBe(true)
    expect(Object.isFrozen(session.world.flags)).toBe(true)
  })
})
