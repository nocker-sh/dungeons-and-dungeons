import { describe, expect, it } from "vite-plus/test"
import { z } from "zod"
import { WIZ_IMMUTABLE_VALUE, WizImmutableValue } from "@/lib/wiz/core/immutable-value"
import { MOCK_CONTENT, MOCK_VAULT } from "@/lib/wiz/core/mocks/mock-vault"
import { WizEngineShopDialogueService } from "@/lib/wiz/core/engine/shop/wiz-shop-scene-dialogue-service"
import { WizEngineBattleTurnAction } from "@/lib/wiz/core/engine/battle/turn-action"
import { WizStandardSceneWorld } from "@/lib/wiz/core/presets/standard-scene-world"
import { WizStandardRuntimeEnvironment, WizRootReducer } from "@/lib/wiz/core/presets/default"
import { WizPresetValue } from "@/lib/wiz/core/presets/wiz-preset"
import { toExplorationScene, toVillageScene } from "@/lib/wiz/core/runtime/scene-transitions"
import { WizPluginSceneRegistry } from "@/lib/wiz/core/runtime/plugin/plugin-scene-registry"
import { WizPluginSceneModule } from "@/lib/wiz/core/runtime/plugin/plugin-scene-module"
import { WizPluginSceneResultFactory } from "@/lib/wiz/core/runtime/plugin/plugin-scene-result"
import { WizSceneBattleMonsterAdapter } from "@/lib/wiz/core/runtime/converters/battle-monster-adapter"
import { WizDice } from "@/lib/wiz/core/services/wiz-dice"
import type { WizVaultValue } from "@/lib/wiz/core/vault/value"
import { WizVaultPlayer } from "@/lib/wiz/core/vault/states/player/value"
import type { WizDefaultBattleStatus, WizTypes } from "@/lib/wiz/core/types/wiz-types"

type Exact<TActual, TExpected> =
  (<T>() => T extends TActual ? 1 : 2) extends <T>() => T extends TExpected ? 1 : 2 ? true : false

type Expect<T extends true> = T

/**
 * E2E 統合テスト: プラグインシーン + カスタム属性 + シード乱数 + formula override の組み合わせ。
 *
 * このテストは「最強のヘッドレスゲームエンジン」としての主要拡張ポイントが
 * 同時に機能することを検証する:
 *
 * 1. WizRootReducer のジェネリクスでプラグインシーンを登録
 * 2. WizVaultPlayer.customAttributes に独自属性 (luck) を持たせる
 * 3. statusConversion で luck 由来の必須 `magic` を生成
 * 4. WizDice をシード固定で決定論的に動かす
 * 5. Root の実戦闘経路で typed damage formula が `magic` を受け取る
 */
describe("E2E: plugin scene + custom attributes + seed dice + formula override", () => {
  type MagicTypes = WizTypes & {
    readonly BattleStatus: WizDefaultBattleStatus & {
      readonly magic: number
    }
  }

  type EssenceMonsterCustom = Readonly<{ essence: number }>

  type EssenceMagicTypes = WizTypes & {
    readonly BattleStatus: WizDefaultBattleStatus & {
      readonly magic: number
    }
    readonly BattleMonsterCustom: EssenceMonsterCustom
  }

  class TrainingArenaState {
    declare readonly [WIZ_IMMUTABLE_VALUE]: true
    readonly type = "training_arena"

    constructor(
      readonly vault: WizVaultValue,
      readonly battlesWon: number,
    ) {
      WizImmutableValue.freeze(this)
    }

    withVault(vault: WizVaultValue): TrainingArenaState {
      return new TrainingArenaState(vault, this.battlesWon)
    }

    updateVault(update: (vault: WizVaultValue) => WizVaultValue): TrainingArenaState {
      return this.withVault(update(this.vault))
    }
  }

  const createArena = (vault: WizVaultValue, battlesWon: number): TrainingArenaState =>
    new TrainingArenaState(vault, battlesWon)

  const zArenaAction = z.discriminatedUnion("type", [
    z.object({ type: z.literal("TRAIN") }).strict(),
    z.object({ type: z.literal("GAIN_LUCK"), amount: z.number() }).strict(),
  ])
  type ArenaAction = z.output<typeof zArenaAction>
  const arenaModule = WizPluginSceneModule.define({
    type: "training_arena",
    action: zArenaAction,
    navigation: {
      from: ["village"],
      schema: z.object({ battlesWon: z.number().int().nonnegative() }).strict(),
      create: (vault, payload): TrainingArenaState => createArena(vault, payload.battlesWon),
    },
    reduce: (state: TrainingArenaState, action) => {
      if (action.type === "TRAIN") {
        return WizPluginSceneResultFactory.accept(createArena(state.vault, state.battlesWon + 1))
      }

      return WizPluginSceneResultFactory.accept(
        state.updateVault((vault) =>
          vault.updatePlayer((player) => player.addCustomAttribute("luck", action.amount)),
        ),
      )
    },
  })
  const pluginScenes = WizPluginSceneRegistry.define([arenaModule])

  it("プラグインで蓄積したluckがRoot経由で必須magicとなりdamage formulaへ届く", () => {
    const preset = WizPresetValue.create<MagicTypes>({
      statusConversion: {
        customStatusFormula: (input) => ({
          magic: input.customAttributes?.luck ?? 0,
        }),
        speedFormula: (input) => 10_000 + (input.customAttributes?.luck ?? 0),
      },
      damage: {
        damageFormula: (attacker) => attacker.magic,
        evasionFormula: () => 0,
        criticalChance: 0,
        varianceMin: 1,
        varianceMax: 1,
        minimumDamage: 0,
      },
    })

    const dice = WizDice.withSeed(42)
    const root = new WizRootReducer<TrainingArenaState, ArenaAction, ArenaAction, MagicTypes>({
      battleMonsterAdapter: WizSceneBattleMonsterAdapter.define({
        statusCustom: () => ({ magic: 0 }),
      }),
      content: MOCK_CONTENT,
      context: {
        initialVault: MOCK_VAULT,
        initialWorldState: toVillageScene(MOCK_VAULT),
      },
      shopDialogueService: new WizEngineShopDialogueService([]),
      preset,
      environment: WizStandardRuntimeEnvironment.create({ dice }),
      pluginScenes,
    })

    let state = createArena(MOCK_VAULT, 0)
    state = root.reduce(state, { type: "TRAIN" }).state as TrainingArenaState
    state = root.reduce(state, { type: "TRAIN" }).state as TrainingArenaState
    state = root.reduce(state, {
      type: "GAIN_LUCK",
      amount: 10,
    }).state as TrainingArenaState

    expect(state.type).toBe("training_arena")
    expect(state.battlesWon).toBe(2)

    const player = new WizVaultPlayer(state.vault.player.toPlain())
    expect(player.getCustomAttribute("luck")).toBe(10)

    const monster = state.vault.areas.find((area) => area.id === "forest")?.monsters[0]
    if (!monster) throw new Error("forest monster is required")

    const battle = root.reduce(toExplorationScene(state.vault, "forest"), {
      type: "ENCOUNTER_MONSTER",
      areaId: "forest",
      monsterId: monster.id,
    }).state

    expect(battle.type).toBe("battle")
    if (battle.type !== "battle") throw new Error("battle state is required")

    const battlePlayer = battle.phase.context.party.requireMemberById("player")
    const battleStatus = battlePlayer.status.toFormulaView()
    const magicIsExactlyNumber: Expect<Exact<typeof battleStatus.magic, number>> = true
    expect(magicIsExactlyNumber).toBe(true)
    expect(battleStatus.magic).toBe(10)
    expect(battleStatus.speed).toBe(10_010)

    const turnOrder = root.reduce(battle, { type: "BATTLE_START" }).state
    expect(turnOrder.type).toBe("battle")
    if (turnOrder.type !== "battle" || turnOrder.phase.phase !== "turnOrder") {
      throw new Error("turn order phase is required")
    }

    expect(turnOrder.phase.getCurrentActor()?.id).toBe("player")
    const target = turnOrder.phase.context.enemies.getAllAliveMonsters()[0]
    if (!target) throw new Error("battle target is required")
    expect(target.status.toFormulaView().magic).toBe(0)
    const hpBeforeAttack = target.status.resources.current("health")

    const afterAttack = root.reduce(turnOrder, {
      type: "BATTLE_EXECUTE_ACTION",
      action: WizEngineBattleTurnAction.attack("player", target.id, "magic-attack"),
    }).state

    expect(afterAttack.type).toBe("battle")
    if (afterAttack.type !== "battle") throw new Error("battle result is required")
    const damagedTarget = afterAttack.phase.context.enemies.getMonsterById(target.id)
    expect(damagedTarget?.status.resources.current("health")).toBe(Math.max(0, hpBeforeAttack - 10))
  })

  it("monster custom型をRootとStandardWorldの戦闘stateまで維持する", () => {
    const preset = WizPresetValue.create<EssenceMagicTypes>({
      statusConversion: {
        customStatusFormula: () => ({ magic: 0 }),
      },
      reward: {
        expFormula: (monsters) =>
          monsters.reduce((total, monster) => total + monster.custom.essence, 0),
        goldFormula: (monsters) =>
          monsters.reduce((total, monster) => total + monster.custom.essence, 0),
      },
    })
    const battleMonsterAdapter = WizSceneBattleMonsterAdapter.defineWithMonsterCustom({
      statusCustom: () => ({ magic: 4 }),
      monsterCustom: (_monster, standard): EssenceMonsterCustom => ({
        essence: standard.expReward * 3,
      }),
    })
    const root = new WizRootReducer<never, never, never, EssenceMagicTypes>({
      battleMonsterAdapter,
      content: MOCK_CONTENT,
      context: {
        initialVault: MOCK_VAULT,
        initialWorldState: toVillageScene(MOCK_VAULT),
      },
      shopDialogueService: new WizEngineShopDialogueService([]),
      preset,
    })
    const rootBattle = root.reduce(toExplorationScene(MOCK_VAULT, "forest"), {
      type: "ENCOUNTER_MONSTER",
      areaId: "forest",
      monsterId: "goblin",
    }).state
    if (rootBattle.type !== "battle") {
      throw new TypeError("Expected Root battle state")
    }
    const rootMonster = rootBattle.phase.context.enemies.getAllMonsters()[0]
    if (!rootMonster) {
      throw new TypeError("Expected Root battle monster")
    }
    const rootCustomIsExact: Expect<Exact<typeof rootMonster.custom, EssenceMonsterCustom>> = true

    const world = WizStandardSceneWorld.create({
      battleMonsterAdapter,
      content: MOCK_CONTENT,
      preset,
    })
    const worldBattle = world.navigate(world.initialState, {
      type: "START_BATTLE",
      areaId: "forest",
      monsterIds: ["goblin"],
    })
    if (worldBattle.accepted === false || worldBattle.state.type !== "battle") {
      throw new TypeError("Expected StandardWorld battle state")
    }
    const worldMonster = worldBattle.state.phase.context.enemies.getAllMonsters()[0]
    if (!worldMonster) {
      throw new TypeError("Expected StandardWorld battle monster")
    }
    const worldCustomIsExact: Expect<Exact<typeof worldMonster.custom, EssenceMonsterCustom>> = true

    expect(rootCustomIsExact).toBe(true)
    expect(worldCustomIsExact).toBe(true)
    expect(rootMonster.custom.essence).toBe(30)
    expect(worldMonster.custom.essence).toBe(30)
  })

  it("シーンから組み込みシーンへ遷移しても vault は維持される", () => {
    const root = new WizRootReducer<TrainingArenaState, ArenaAction, ArenaAction>({
      content: MOCK_CONTENT,
      context: {
        initialVault: MOCK_VAULT,
        initialWorldState: toVillageScene(MOCK_VAULT),
      },
      shopDialogueService: new WizEngineShopDialogueService([]),
      pluginScenes,
    })

    const arena = createArena(MOCK_VAULT, 0)
    const luckGained = root.reduce(arena, {
      type: "GAIN_LUCK",
      amount: 5,
    }).state

    expect(luckGained.type).toBe("training_arena")
    if (luckGained.type === "training_arena") {
      const player = new WizVaultPlayer(luckGained.vault.player.toPlain())
      expect(player.getCustomAttribute("luck")).toBe(5)
    }
  })
})
