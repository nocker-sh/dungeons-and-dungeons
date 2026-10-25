import { describe, expect, it } from "vite-plus/test"
import { z } from "zod"
import { WorldContent } from "@/lib/wiz/core/content/world-content"
import { WizEngineBattleReward } from "@/lib/wiz/core/engine/reward/battle-reward"
import { WIZ_IMMUTABLE_VALUE, WizImmutableValue } from "@/lib/wiz/core/immutable-value"
import { WizRpgBattleModel } from "@/lib/wiz/core/rpg/battle-model"
import { WizRpgComponentIdentity } from "@/lib/wiz/core/rpg/component-identity"
import { WizRpgEquipmentRules } from "@/lib/wiz/core/rpg/equipment-rules"
import { WizRpgScenes } from "@/lib/wiz/core/rpg/scenes"
import { WizRpgWorldDefinition } from "@/lib/wiz/core/rpg/standard-world"
import { WizRpgMechanics } from "@/lib/wiz/core/presets/rpg-mechanics"
import { WizPresetValue } from "@/lib/wiz/core/presets/wiz-preset"
import {
  WizStandardPluginSceneCodec,
  WizStandardRewardCustomCodec,
} from "@/lib/wiz/core/presets/standard-session"
import { WizSceneBattleMonsterAdapter } from "@/lib/wiz/core/runtime/converters/battle-monster-adapter"
import { WizPluginSceneModule } from "@/lib/wiz/core/runtime/plugin/plugin-scene-module"
import { WizPluginSceneRegistry } from "@/lib/wiz/core/runtime/plugin/plugin-scene-registry"
import { WizPluginSceneResultFactory } from "@/lib/wiz/core/runtime/plugin/plugin-scene-result"
import { WizSceneResultFactory } from "@/lib/wiz/core/runtime/scene-result"
import { WizWorldSaveContentVersionError } from "@/lib/wiz/core/save/world-save-codec"
import type {
  WizDefaultBattleStatus,
  WizDefaultTypes,
  WizTypes,
} from "@/lib/wiz/core/types/wiz-types"
import type { WizVaultValue } from "@/lib/wiz/core/vault/value"
import { WizWorldEnvironment } from "@/lib/wiz/core/world/world"

class CampState {
  declare readonly [WIZ_IMMUTABLE_VALUE]: true
  readonly type = "camp"

  constructor(
    readonly vault: WizVaultValue,
    readonly rests: number,
  ) {
    WizImmutableValue.freeze(this)
  }

  withVault(vault: WizVaultValue): CampState {
    return new CampState(vault, this.rests)
  }

  updateVault(update: (vault: WizVaultValue) => WizVaultValue): CampState {
    return this.withVault(update(this.vault))
  }

  rest(): CampState {
    return new CampState(this.vault, this.rests + 1)
  }
}

Object.freeze(CampState.prototype)
Object.freeze(CampState)

const CAMP_MODULE = WizPluginSceneModule.define({
  action: z.strictObject({ type: z.literal("REST_AT_CAMP") }),
  navigation: {
    create: (vault): CampState => new CampState(vault, 0),
    from: ["village"],
    schema: z.strictObject({}),
  },
  reduce: (state: CampState) => WizPluginSceneResultFactory.accept(state.rest()),
  type: "camp",
})

const CAMP_CODEC = WizStandardPluginSceneCodec.define({
  capture: (state: CampState) => ({ rests: state.rests }),
  restore: (data, context): CampState => new CampState(context.vault, data.rests),
  schema: z.strictObject({ rests: z.number().int().nonnegative() }),
  type: "camp",
})

const CAMP_SCENES = WizRpgScenes.define(WizPluginSceneRegistry.define([CAMP_MODULE]), [CAMP_CODEC])
const CAMP_SCENES_IDENTITY = WizRpgComponentIdentity.create(
  "1",
  Object.freeze({ sceneTypes: Object.freeze(["camp"]) }),
)

describe("WizRpgWorldDefinition", () => {
  it("追加sceneの遷移・action・保存を一つのcompositionで接続する", () => {
    const world = WizRpgWorldDefinition.forContent(
      WorldContent.create({}),
      "standard-plugin-test-1",
    )
      .withScenes(CAMP_SCENES, CAMP_SCENES_IDENTITY)
      .build()
    const entered = world.dispatch(world.initialState, CAMP_MODULE.enter({}))
    const rested = world.dispatch(entered.state, { type: "REST_AT_CAMP" })
    const restored = world.restore(JSON.parse(JSON.stringify(world.save(rested.state))))

    expect(entered).toMatchObject({
      accepted: true,
      state: { scene: { rests: 0, type: "camp" } },
    })
    expect(rested).toMatchObject({
      accepted: true,
      state: { scene: { rests: 1, type: "camp" } },
    })
    expect(restored.scene).toMatchObject({ rests: 1, type: "camp" })
  })

  it("scene moduleとcodecの重複をcomposition時に拒否する", () => {
    expect(() =>
      WizRpgScenes.define(WizPluginSceneRegistry.define([CAMP_MODULE]), [CAMP_CODEC, CAMP_CODEC]),
    ).toThrow('Duplicate RPG scene codec "camp"')
  })

  it("prototypeだけを偽装したscene registryとcodecを拒否する", () => {
    const forgedRegistry = Object.freeze(Object.create(WizPluginSceneRegistry.prototype))
    const forgedCodec = Object.freeze(Object.create(WizStandardPluginSceneCodec.prototype))

    expect(() => WizRpgScenes.define(forgedRegistry, [], undefined as never)).toThrow(
      "RPG scene registry must be created with WizPluginSceneRegistry.define()",
    )
    expect(() => WizStandardPluginSceneCodec.require(forgedCodec, "RPG scene codec")).toThrow(
      "RPG scene codec must be created with WizStandardPluginSceneCodec.define()",
    )
  })

  it("world構成に渡されたclassのprototype偽装を境界で拒否する", () => {
    const content = WorldContent.create({})
    const definition = WizRpgWorldDefinition.forContent(content, "authenticity-test-1")
    const mechanics = WizRpgMechanics.defineForContent(content)
    const identity = WizRpgComponentIdentity.create("1", Object.freeze({}))
    const forgedContent: typeof content = Object.freeze(Object.create(WorldContent.prototype))
    const forgedEnvironment: WizWorldEnvironment = Object.freeze(
      Object.create(WizWorldEnvironment.prototype),
    )
    const forgedMechanics: WizRpgMechanics = Object.freeze(Object.create(WizRpgMechanics.prototype))
    const forgedBattleModel: WizRpgBattleModel<
      WizDefaultTypes,
      undefined,
      undefined,
      typeof content.arrays,
      never
    > = Object.freeze(Object.create(WizRpgBattleModel.prototype))
    const forgedScenes = Object.freeze(Object.create(WizRpgScenes.prototype))
    const forgedRewardCodec: WizStandardRewardCustomCodec<undefined> = Object.freeze(
      Object.create(WizStandardRewardCustomCodec.prototype),
    )

    expect(() => WizRpgWorldDefinition.forContent(forgedContent, "authenticity-test-1")).toThrow(
      "RPG world content must be created with WorldContent.create() or parse()",
    )
    expect(() => WizRpgMechanics.defineForContent(forgedContent)).toThrow(
      "RPG mechanics content must be created with WorldContent.create() or parse()",
    )
    expect(() =>
      WizRpgBattleModel.defineForContent(forgedContent, {
        mechanics,
        monsterAdapter: WizSceneBattleMonsterAdapter.createDefault(),
        preset: WizPresetValue.create(),
      }),
    ).toThrow("RPG battle model content must be created with WorldContent.create() or parse()")
    expect(() =>
      WizRpgBattleModel.defineForContent(content, {
        mechanics: forgedMechanics,
        monsterAdapter: WizSceneBattleMonsterAdapter.createDefault(),
        preset: WizPresetValue.create(),
      }),
    ).toThrow(
      "RPG battle model mechanics must be created with WizRpgMechanics.define() or defineForContent()",
    )
    expect(() =>
      WizStandardRewardCustomCodec.require(forgedRewardCodec, "RPG battle model reward codec"),
    ).toThrow(
      "RPG battle model reward codec must be created with WizStandardRewardCustomCodec.define()",
    )
    expect(() => definition.withEnvironment(forgedEnvironment, identity)).toThrow(
      "RPG world environment must be created with WizWorldEnvironment.create()",
    )
    expect(() => definition.withMechanics(forgedMechanics, identity)).toThrow(
      "RPG mechanics must be created with WizRpgMechanics.define() or defineForContent()",
    )
    expect(() => definition.withBattleModel(forgedBattleModel, identity)).toThrow(
      "RPG battle model must be created with WizRpgBattleModel.defineForContent()",
    )
    expect(() => definition.withScenes(forgedScenes, identity)).toThrow(
      "RPG scenes must be created with WizRpgScenes.define()",
    )
  })

  it("withPreset時点で設定を検証・所有し、後続の外部変更を観測しない", () => {
    const source = WizPresetValue.create()
    const damage = { ...source.damage }
    const mutablePreset = {
      conversation: source.conversation,
      damage,
      exploration: source.exploration,
      flee: source.flee,
      levelUp: source.levelUp,
      reward: source.reward,
      statusConversion: source.statusConversion,
      effect: source.effect,
      time: source.time,
    }
    const definition = WizRpgWorldDefinition.forContent(
      WorldContent.create({}),
      "preset-capture-test-1",
    ).withPreset(
      mutablePreset,
      WizRpgComponentIdentity.create("1", Object.freeze({ criticalChance: 0.05 })),
    )

    damage.criticalChance = 2

    expect(() => definition.build()).not.toThrow()
  })

  it("任意の組み込みactionだけをcustom reducerへ差し替え、残りを標準処理へ委譲する", () => {
    const content = WorldContent.create({})
    const mechanics = WizRpgMechanics.defineForContent(content, {
      standardActionReducer: () => ({
        reduce: (state, action) =>
          action.type === "SELECT_VILLAGE_ACTION"
            ? WizSceneResultFactory.accept(
                state.updateVault((vault) => vault.addFlag("custom-village-action")),
              )
            : null,
      }),
    })
    const world = WizRpgWorldDefinition.forContent(content, "standard-action-override-test-1")
      .withMechanics(
        mechanics,
        WizRpgComponentIdentity.create(
          "1",
          Object.freeze({ standardActionReducer: "custom-village-action" }),
        ),
      )
      .build()

    const selected = world.dispatch(
      world.initialState,
      world.commands.scene.selectVillageAction("explore"),
    )

    expect(selected).toMatchObject({
      accepted: true,
      state: {
        scene: {
          selectedAction: null,
          type: "village",
        },
      },
    })
    expect(selected.state.scene.vault.hasFlag("custom-village-action")).toBe(true)
  })

  it("同じworld revisionでもruntime構成データ差を保存identityへ反映する", () => {
    const content = WorldContent.create({})
    const mechanics = WizRpgMechanics.defineForContent(content)
    const sourceIdentity = WizRpgComponentIdentity.create("1", Object.freeze({ rewardScale: 1 }))
    const targetIdentity = WizRpgComponentIdentity.create("1", Object.freeze({ rewardScale: 2 }))
    const source = WizRpgWorldDefinition.forContent(content, "runtime-identity-test-1")
      .withMechanics(mechanics, sourceIdentity)
      .build()
    const target = WizRpgWorldDefinition.forContent(content, "runtime-identity-test-1")
      .withMechanics(mechanics, targetIdentity)
      .build()
    const component = source.manifest.find("mechanics", "mechanics")

    expect(source.identity).not.toBe(target.identity)
    expect(component?.dataIdentity).toBe(sourceIdentity.digest)
    expect(component).toMatchObject({
      key: "mechanics",
      kind: "mechanics",
      revision: "1",
    })
    expect(() => target.restore(source.save(source.initialState))).toThrow(
      WizWorldSaveContentVersionError,
    )
  })

  it("独立runtime構成の呼び順と上書き履歴を最終identityへ残さない", () => {
    const content = WorldContent.create({})
    const mechanics = WizRpgMechanics.defineForContent(content)
    const preset = WizPresetValue.create()
    const mechanicsIdentity = WizRpgComponentIdentity.create(
      "2",
      Object.freeze({ mechanics: "current" }),
    )
    const presetIdentity = WizRpgComponentIdentity.create("3", Object.freeze({ preset: "current" }))
    const obsoleteIdentity = WizRpgComponentIdentity.create(
      "1",
      Object.freeze({ mechanics: "obsolete" }),
    )
    const mechanicsFirst = WizRpgWorldDefinition.forContent(content, "ordering-test-1")
      .withMechanics(mechanics, mechanicsIdentity)
      .withPreset(preset, presetIdentity)
      .build()
    const presetFirst = WizRpgWorldDefinition.forContent(content, "ordering-test-1")
      .withPreset(preset, presetIdentity)
      .withMechanics(mechanics, mechanicsIdentity)
      .build()
    const overwritten = WizRpgWorldDefinition.forContent(content, "ordering-test-1")
      .withMechanics(mechanics, obsoleteIdentity)
      .withMechanics(mechanics, mechanicsIdentity)
      .withPreset(preset, presetIdentity)
      .build()

    expect(mechanicsFirst.identity).toBe(presetFirst.identity)
    expect(overwritten.identity).toBe(mechanicsFirst.identity)
    expect(mechanicsFirst.manifest.components.map((component) => component.kind)).toEqual([
      "mechanics",
      "preset",
    ])
  })

  it("custom battle型とreward codecを一つのmodelとして高水準worldへ接続する", () => {
    type SoulReward = Readonly<{ souls: number }>
    type ArcaneTypes = WizTypes & {
      readonly BattleStatus: WizDefaultBattleStatus & Readonly<{ arcane: number }>
      readonly BattleMonsterCustom: Readonly<{ essence: number }>
    }

    const content = WorldContent.create({})
    const preset = WizPresetValue.create<ArcaneTypes>({
      statusConversion: {
        customStatusFormula: () => ({ arcane: 7 }),
      },
    })
    const mechanics = WizRpgMechanics.defineForContent<
      typeof content.arrays,
      SoulReward,
      ArcaneTypes
    >(content, {
      rewardCalculator: () => ({
        calculate: () =>
          new WizEngineBattleReward({
            custom: { souls: 3 },
            experience: 0,
            gold: 0,
          }),
      }),
    })
    const rewardCodec = WizStandardRewardCustomCodec.define({
      capture: (custom: SoulReward) => ({ storedSouls: custom.souls }),
      schema: z
        .strictObject({ storedSouls: z.number().nonnegative() })
        .transform((input): SoulReward => ({ souls: input.storedSouls })),
    })
    const model = WizRpgBattleModel.defineForContent(content, {
      mechanics,
      monsterAdapter: WizSceneBattleMonsterAdapter.defineWithMonsterCustom({
        monsterCustom: (_monster, standard) => ({ essence: standard.expReward }),
        statusCustom: () => ({ arcane: 0 }),
      }),
      preset,
      rewardCodec,
    })
    const world = WizRpgWorldDefinition.forContent(content, "custom-battle-model-test-1")
      .withBattleModel(
        model,
        WizRpgComponentIdentity.create(
          "1",
          Object.freeze({
            battleStatus: Object.freeze(["arcane"]),
            monsterCustom: Object.freeze(["essence"]),
            reward: Object.freeze(["souls"]),
          }),
        ),
      )
      .build()
    const restored = world.restore(JSON.parse(JSON.stringify(world.save(world.initialState))))

    expect(restored.scene.type).toBe("village")
    expect(world.identity).toMatch(/^rpg-/)
  })

  it("custom装備rulesで任意slotと複数slot占有を表現する", () => {
    const content = WorldContent.create({
      weapons: [
        {
          attack: 5,
          description: "two handed",
          dexterityBonus: 0,
          id: "great_sword",
          name: "Great sword",
          price: 10,
          sellPrice: 5,
          slotId: "mainHand",
        },
        {
          attack: 1,
          description: "off hand slot declaration",
          dexterityBonus: 0,
          id: "dagger",
          name: "Dagger",
          price: 5,
          sellPrice: 2,
          slotId: "offHand",
        },
      ],
    })
    const initialSnapshot = content.createInitialSnapshot({
      inventory: {
        capacity: 20,
        entries: [
          {
            entryId: "great-sword-entry",
            contentType: "weapon",
            contentId: "great_sword",
            quantity: 1,
          },
        ],
      },
    })
    const mechanics = WizRpgMechanics.defineForContent(content, {
      equipmentRules: () =>
        WizRpgEquipmentRules.define({
          equip: ({ entry, equipment, inventory }) =>
            entry.contentId === "great_sword"
              ? WizRpgEquipmentRules.accept(
                  equipment
                    .equip("mainHand", entry.entryId, inventory)
                    .equip("offHand", entry.entryId, inventory),
                )
              : WizRpgEquipmentRules.reject("CUSTOM_EQUIPMENT_REJECTED"),
          unequip: ({ equipment, slotId }) => {
            const entryId = equipment.entryAt(slotId)
            const nextEquipment = equipment.slotIds.reduce(
              (current, currentSlotId) =>
                current.entryAt(currentSlotId) === entryId
                  ? current.unequip(currentSlotId)
                  : current,
              equipment,
            )
            return WizRpgEquipmentRules.accept(nextEquipment)
          },
        }),
    })
    const world = WizRpgWorldDefinition.forContent(content, "custom-equipment-rules-test-1")
      .withInitialSnapshot(initialSnapshot)
      .withMechanics(
        mechanics,
        WizRpgComponentIdentity.create(
          "1",
          Object.freeze({
            equipmentRules: "two-handed-great-sword",
            occupiedSlots: Object.freeze(["mainHand", "offHand"]),
          }),
        ),
      )
      .build()
    const equipped = world.dispatch(
      world.initialState,
      world.commands.scene.equip("great-sword-entry", "offHand"),
    )

    expect(equipped.accepted).toBe(true)
    expect(equipped.state.scene.vault.equippedAt("mainHand")).toBe("great-sword-entry")
    expect(equipped.state.scene.vault.equippedAt("offHand")).toBe("great-sword-entry")

    const unequipped = world.dispatch(equipped.state, world.commands.scene.unequip("offHand"))
    expect(unequipped.state.scene.vault.equippedAt("mainHand")).toBeNull()
    expect(unequipped.state.scene.vault.equippedAt("offHand")).toBeNull()
  })
})
