import { describe, expect, expectTypeOf, it } from "vite-plus/test"
import { z } from "zod"
import { WizEngineShopDialogueService } from "@/lib/wiz/core/engine/shop/wiz-shop-scene-dialogue-service"
import {
  WIZ_IMMUTABLE_VALUE,
  WizImmutableValue,
} from "@/lib/wiz/core/immutable-value"
import { MOCK_CONTENT, MOCK_VAULT } from "@/lib/wiz/core/mocks/mock-vault"
import { WizRootReducer } from "@/lib/wiz/core/presets/default"
import type { WizPluginSceneState } from "@/lib/wiz/core/runtime/plugin/plugin-scene"
import {
  WizPluginSceneRegistry,
  type WizPluginSceneRegistryActionInput,
  type WizPluginSceneRegistryActionOutput,
  type WizPluginSceneRegistryEvent,
  type WizPluginSceneRegistryReason,
} from "@/lib/wiz/core/runtime/plugin/plugin-scene-registry"
import { WizPluginSceneModule } from "@/lib/wiz/core/runtime/plugin/is-authentic-wiz-plugin-scene-module"
import type {
  WizPluginSceneActionTypeConflict,
  WizPluginSceneTypeConflict,
} from "@/lib/wiz/core/runtime/plugin/is-authentic-wiz-plugin-scene-module"
import type {
  WizPluginSceneModuleActionInput,
  WizPluginSceneModuleActionOutput,
  WizPluginSceneModuleEvent,
  WizPluginSceneModuleReason,
} from "@/lib/wiz/core/runtime/plugin/plugin-scene-module"
import { WizPluginSceneNavigation } from "@/lib/wiz/core/runtime/plugin/plugin-scene-navigation"
import {
  WizPluginSceneResultFactory,
  type WizPluginSceneAcceptedResult,
  type WizPluginSceneResult,
} from "@/lib/wiz/core/runtime/plugin/plugin-scene-result"
import { WizSceneResultFactory } from "@/lib/wiz/core/runtime/scene-result"
import { toExplorationScene } from "@/lib/wiz/core/runtime/to-exploration-scene"
import { toVillageScene } from "@/lib/wiz/core/runtime/to-village-scene"
import type { WizStandardSchemaDefinition } from "@/lib/wiz/core/standard-schema"
import type { WizVaultValue } from "@/lib/wiz/core/vault/value"

class ArenaState implements WizPluginSceneState {
  declare readonly [WIZ_IMMUTABLE_VALUE]: true
  readonly type = "arena"

  constructor(
    readonly vault: WizVaultValue,
    readonly score: number
  ) {
    WizImmutableValue.freeze(this)
  }

  withVault(vault: WizVaultValue): ArenaState {
    return new ArenaState(vault, this.score)
  }

  updateVault(update: (vault: WizVaultValue) => WizVaultValue): ArenaState {
    return this.withVault(update(this.vault))
  }

  withScore(score: number): ArenaState {
    return new ArenaState(this.vault, score)
  }
}

const zArenaAction = z
  .object({
    type: z.literal("ARENA_BATTLE_WIN"),
    points: z.coerce.number(),
  })
  .strict()

type ArenaAction = z.output<typeof zArenaAction>

const arenaModule = WizPluginSceneModule.define({
  type: "arena",
  action: zArenaAction,
  navigation: {
    from: ["village"],
    schema: z.object({ score: z.number().int().nonnegative() }).strict(),
    create: (vault, payload): ArenaState =>
      new ArenaState(vault, payload.score),
  },
  reduce: (state: ArenaState, action) =>
    WizPluginSceneResultFactory.accept(
      state.withScore(state.score + action.points)
    ),
})

const arenaScenes = WizPluginSceneRegistry.define([arenaModule])
const initialState = toVillageScene(MOCK_VAULT)
const shopDialogueService = new WizEngineShopDialogueService([])

const createRoot = () =>
  new WizRootReducer<ArenaState, z.input<typeof zArenaAction>, ArenaAction>({
    content: MOCK_CONTENT,
    context: {
      initialVault: MOCK_VAULT,
      initialWorldState: initialState,
    },
    pluginScenes: arenaScenes,
    shopDialogueService,
  })

describe("WizPluginSceneModule", () => {
  it("navigationの生成口をscene moduleだけに限定する", () => {
    const verifyPublicFactoryIsAbsent = () => {
      // @ts-expect-error navigationはscene moduleのenter()だけが生成する
      return WizPluginSceneNavigation.create
    }

    void verifyPublicFactoryIsAbsent
    expect("create" in WizPluginSceneNavigation).toBe(false)
    expect(arenaModule.enter({ score: 1 })).toBeInstanceOf(
      WizPluginSceneNavigation
    )
  })

  it("reducer returnからeventとliteral reasonをmodule/registryへ推論する", () => {
    const module = WizPluginSceneModule.define({
      type: "arena",
      action: z
        .object({
          type: z.literal("UPDATE_ARENA_SCORE"),
          points: z.number(),
        })
        .strict(),
      navigation: {
        from: ["village"],
        schema: z.object({}).strict(),
        create: (vault): ArenaState => new ArenaState(vault, 0),
      },
      reduce: (state: ArenaState, action) =>
        action.points < 0
          ? WizPluginSceneResultFactory.reject(state, "ARENA_SCORE_REJECTED")
          : WizPluginSceneResultFactory.accept(
              state.withScore(state.score + action.points),
              undefined,
              [{ type: "ARENA_SCORE_UPDATED", points: action.points }]
            ),
    })
    const registry = WizPluginSceneRegistry.define([module])

    expectTypeOf<WizPluginSceneModuleEvent<typeof module>>().toEqualTypeOf<
      Readonly<{
        type: "ARENA_SCORE_UPDATED"
        points: number
      }>
    >()
    expectTypeOf<
      WizPluginSceneModuleReason<typeof module>
    >().toEqualTypeOf<"ARENA_SCORE_REJECTED">()
    expectTypeOf<WizPluginSceneRegistryEvent<typeof registry>>().toEqualTypeOf<
      Readonly<{
        type: "ARENA_SCORE_UPDATED"
        points: number
      }>
    >()
    expectTypeOf<
      WizPluginSceneRegistryReason<typeof registry>
    >().toEqualTypeOf<"ARENA_SCORE_REJECTED">()

    const verifyBroadReasonIsRejected = () => {
      const reduce = (
        state: ArenaState
      ): WizPluginSceneResult<ArenaState, never, string> =>
        WizPluginSceneResultFactory.reject(state, "BROAD_REASON")

      // @ts-expect-error plugin reasonはliteral unionで宣言する
      return WizPluginSceneModule.define({
        type: "arena",
        action: z.object({ type: z.literal("USE_BROAD_REASON") }).strict(),
        navigation: {
          from: ["village"],
          schema: z.object({}).strict(),
          create: (vault: WizVaultValue): ArenaState =>
            new ArenaState(vault, 0),
        },
        reduce,
      })
    }

    expect(verifyBroadReasonIsRejected).toBeTypeOf("function")
  })

  it("Standard Schemaのoutputだけをreducerへ一度だけ渡す", () => {
    let validations = 0
    const schema = {
      "~standard": {
        version: 1 as const,
        vendor: "test",
        types: undefined as
          | {
              input: { type: "ADD_SCORE"; points: string }
              output: { type: "ADD_SCORE"; points: number }
            }
          | undefined,
        validate: (input: unknown) => {
          validations += 1
          const parsed = z
            .object({
              type: z.literal("ADD_SCORE"),
              points: z.coerce.number(),
            })
            .safeParse(input)

          return parsed.success
            ? { value: parsed.data }
            : { issues: [{ message: "invalid action" }] }
        },
      },
    }
    const module = WizPluginSceneModule.define({
      type: "arena",
      action: schema,
      navigation: {
        from: ["village"],
        schema: z.object({ score: z.number() }).strict(),
        create: (vault, payload): ArenaState =>
          new ArenaState(vault, payload.score),
      },
      reduce: (state: ArenaState, action) =>
        WizPluginSceneResultFactory.accept(
          state.withScore(state.score + action.points)
        ),
    })

    const sceneResult = module.reduce(new ArenaState(MOCK_VAULT, 1), {
      type: "ADD_SCORE",
      points: "2",
    })

    expect(validations).toBe(1)
    expect(sceneResult?.state).toMatchObject({ score: 3 })
  })

  it("arbitrary inputをcanonical actionへ一度だけ変換してregistryとrootで共有する", () => {
    type ScoreAction = Readonly<{ type: "SET_ARENA_SCORE"; points: number }>
    let validations = 0
    const schema: WizStandardSchemaDefinition<string, ScoreAction> = {
      "~standard": {
        version: 1,
        vendor: "string-action",
        types: undefined,
        validate: (input) => {
          validations += 1
          const points = typeof input === "string" ? Number(input) : Number.NaN

          return Number.isFinite(points)
            ? { value: { type: "SET_ARENA_SCORE", points } }
            : { issues: [{ message: "expected a numeric string" }] }
        },
      },
    }
    const module = WizPluginSceneModule.define({
      type: "arena",
      action: schema,
      navigation: {
        from: ["village"],
        schema: z.object({}).strict(),
        create: (vault): ArenaState => new ArenaState(vault, 0),
      },
      reduce: (state: ArenaState, action) =>
        WizPluginSceneResultFactory.accept(state.withScore(action.points)),
    })
    const registry = WizPluginSceneRegistry.define([module])
    const resolvedAction = registry.resolveAction("arena", "7")

    expectTypeOf<
      WizPluginSceneModuleActionInput<typeof module>
    >().toEqualTypeOf<string>()
    expectTypeOf<
      WizPluginSceneModuleActionOutput<typeof module>
    >().toEqualTypeOf<ScoreAction>()
    expectTypeOf<
      WizPluginSceneRegistryActionInput<typeof registry>
    >().toEqualTypeOf<string>()
    expectTypeOf<
      WizPluginSceneRegistryActionOutput<typeof registry>
    >().toEqualTypeOf<ScoreAction>()
    expect(resolvedAction).not.toBeNull()
    if (resolvedAction === null) {
      throw new TypeError("Expected resolved plugin action")
    }
    expect(registry.getCanonicalAction("arena", resolvedAction)).toEqual({
      type: "SET_ARENA_SCORE",
      points: 7,
    })
    const sceneResult = registry.reduceResolved(
      new ArenaState(MOCK_VAULT, 0),
      resolvedAction
    )

    expect(validations).toBe(1)
    expect(sceneResult?.state).toMatchObject({ score: 7 })

    validations = 0
    const root = new WizRootReducer<ArenaState, string, ScoreAction>({
      content: MOCK_CONTENT,
      context: {
        initialVault: MOCK_VAULT,
        initialWorldState: initialState,
      },
      pluginScenes: registry,
      shopDialogueService,
    })
    const arena = root.navigate(initialState, module.enter({})).state
    const rootResult = root.reduce(arena, "11")

    expect(validations).toBe(1)
    expect(rootResult.state).toMatchObject({ score: 11 })
  })

  it("wideとtemplate action型が予約名を含み得る場合は型で拒否する", () => {
    type WideAction = Readonly<{ type: string }>
    type PatternAction = Readonly<{ type: `${string}_ACTION` }>
    type PatternScene = `${string}age`
    const requireNoConflict = <_TConflict extends never>() => undefined

    // @ts-expect-error wide stringは全組み込みaction名を含み得る
    requireNoConflict<WizPluginSceneActionTypeConflict<WideAction>>()
    // @ts-expect-error templateにはBATTLE_EXECUTE_ACTIONなどの予約名が含まれる
    requireNoConflict<WizPluginSceneActionTypeConflict<PatternAction>>()
    // @ts-expect-error template scene名にはvillageが含まれる
    requireNoConflict<WizPluginSceneTypeConflict<PatternScene>>()
  })

  it("schemaが型契約を破って予約actionを返してもruntimeで拒否する", () => {
    const schema: WizStandardSchemaDefinition<
      string,
      Readonly<{ type: "SAFE_ACTION" }>
    > = {
      "~standard": {
        version: 1,
        vendor: "lying-schema",
        types: undefined,
        validate: () => ({ value: { type: "ADVANCE_TIME" } }) as never,
      },
    }
    const module = WizPluginSceneModule.define({
      type: "arena",
      action: schema,
      navigation: {
        from: ["village"],
        schema: z.object({}).strict(),
        create: (vault): ArenaState => new ArenaState(vault, 0),
      },
      reduce: (state: ArenaState) => WizPluginSceneResultFactory.accept(state),
    })

    expect(module.resolveAction("unsafe")).toBeNull()
    expect(module.reduce(new ArenaState(MOCK_VAULT, 0), "unsafe")).toBeNull()
  })

  it("型を迂回した組み込みscene名をruntimeでも拒否する", () => {
    expect(() =>
      WizPluginSceneModule.define({
        type: "village",
        action: z.object({ type: z.literal("SAFE_ACTION") }).strict(),
        navigation: {
          from: ["village"],
          schema: z.object({}).strict(),
          create: (vault: WizVaultValue): ArenaState =>
            new ArenaState(vault, 0),
        },
        reduce: (state: ArenaState) =>
          WizPluginSceneResultFactory.accept(state),
      } as never)
    ).toThrow(/reserved/)
  })

  it("Standard Schemaのcontract errorをaction不一致へ変換しない", () => {
    const contractError = new TypeError("schema contract failed")
    const module = WizPluginSceneModule.define({
      type: "arena",
      action: {
        "~standard": {
          version: 1,
          vendor: "throwing-schema",
          types: undefined as
            | {
                input: ArenaAction
                output: ArenaAction
              }
            | undefined,
          validate: () => {
            throw contractError
          },
        },
      },
      navigation: {
        from: ["village"],
        schema: z.object({}).strict(),
        create: (vault): ArenaState => new ArenaState(vault, 0),
      },
      reduce: (state: ArenaState) => WizPluginSceneResultFactory.accept(state),
    })

    expect(() =>
      module.acceptsAction({ type: "ARENA_BATTLE_WIN", points: 1 })
    ).toThrow(contractError)
  })

  it("malformed payloadをreducerへ渡さずsemanticに拒否する", () => {
    const root = createRoot()
    const arena = root.navigate(
      initialState,
      arenaModule.enter({ score: 0 })
    ).state
    const sceneResult = root.reduce(arena, {
      type: "ARENA_BATTLE_WIN",
      points: "oops",
    } as never)

    expect(sceneResult).toMatchObject({
      accepted: false,
      reason: "PLUGIN_ACTION_INVALID",
    })
    expect(sceneResult.state).toBe(arena)
  })

  it("built-in sceneから登録済みnavigationだけでplugin sceneへ入る", () => {
    const sceneResult = createRoot().navigate(
      initialState,
      arenaModule.enter({ score: 7 })
    )

    expect(sceneResult).toMatchObject({
      accepted: true,
      state: { type: "arena", score: 7 },
    })
    expect(sceneResult.state.vault).toBe(MOCK_VAULT)
  })

  it("許可されていないsourceからのplugin navigationを拒否する", () => {
    const root = createRoot()
    const arena = root.navigate(
      initialState,
      arenaModule.enter({ score: 0 })
    ).state
    const sceneResult = root.navigate(arena, arenaModule.enter({ score: 1 }))

    expect(sceneResult).toMatchObject({
      accepted: false,
      reason: "TRANSITION_PLUGIN_SOURCE_NOT_ALLOWED",
    })
    expect(sceneResult.state).toBe(arena)
  })

  it("plugin reducerはtransitionを通してbuilt-in sceneへ戻る", () => {
    const leaveModule = WizPluginSceneModule.define({
      type: "arena",
      action: z.object({ type: z.literal("LEAVE_ARENA") }).strict(),
      navigation: {
        from: ["village"],
        schema: z.object({ score: z.number() }).strict(),
        create: (vault, payload): ArenaState =>
          new ArenaState(vault, payload.score),
      },
      reduce: (state: ArenaState) =>
        WizPluginSceneResultFactory.accept(state, { type: "GO_TO_VILLAGE" }),
    })
    const pluginScenes = WizPluginSceneRegistry.define([leaveModule])
    const root = new WizRootReducer<
      ArenaState,
      { readonly type: "LEAVE_ARENA" },
      { readonly type: "LEAVE_ARENA" }
    >({
      content: MOCK_CONTENT,
      context: {
        initialVault: MOCK_VAULT,
        initialWorldState: initialState,
      },
      pluginScenes,
      shopDialogueService,
    })
    const arena = root.navigate(
      initialState,
      leaveModule.enter({ score: 0 })
    ).state
    const sceneResult = root.reduce(arena, { type: "LEAVE_ARENA" })

    expect(sceneResult.state.type).toBe("village")
  })

  it("root transition後もplugin resultのsemantic eventsを失わない", () => {
    const leaveModule = WizPluginSceneModule.define({
      type: "arena",
      action: z.object({ type: z.literal("LEAVE_WITH_EVENT") }).strict(),
      navigation: {
        from: ["village"],
        schema: z.object({}).strict(),
        create: (vault): ArenaState => new ArenaState(vault, 0),
      },
      reduce: (state: ArenaState) =>
        WizPluginSceneResultFactory.accept(state, { type: "GO_TO_VILLAGE" }, [
          { type: "ARENA_LEFT" },
        ]),
    })
    const pluginScenes = WizPluginSceneRegistry.define([leaveModule])
    const root = new WizRootReducer({
      content: MOCK_CONTENT,
      context: {
        initialVault: MOCK_VAULT,
        initialWorldState: initialState,
      },
      pluginScenes,
      shopDialogueService,
    })
    const arena = root.navigate(initialState, leaveModule.enter({})).state
    const sceneResult = root.reduce(arena, { type: "LEAVE_WITH_EVENT" })

    expect(sceneResult.accepted).toBe(true)
    if (sceneResult.accepted === false) {
      throw new TypeError("Expected accepted plugin transition")
    }
    const eventType: "ARENA_LEFT" = sceneResult.events[0].type
    expect(eventType).toBe("ARENA_LEFT")
    expect(sceneResult.events).toEqual([{ type: "ARENA_LEFT" }])
  })

  it("plugin reducerがbuilt-in stateを直接返してもauthority境界が拒否する", () => {
    const unsafeModule = WizPluginSceneModule.define({
      type: "arena",
      action: z.object({ type: z.literal("UNSAFE_LEAVE") }).strict(),
      navigation: {
        from: ["village"],
        schema: z.object({}).strict(),
        create: (vault): ArenaState => new ArenaState(vault, 0),
      },
      reduce: (state: ArenaState) =>
        WizSceneResultFactory.accept(
          toExplorationScene(state.vault, "missing-area")
        ) as unknown as WizPluginSceneResult<ArenaState, never, "UNSAFE_CAST">,
    })
    const pluginScenes = WizPluginSceneRegistry.define([unsafeModule])
    const root = new WizRootReducer({
      content: MOCK_CONTENT,
      context: {
        initialVault: MOCK_VAULT,
        initialWorldState: initialState,
      },
      pluginScenes,
      shopDialogueService,
    })
    const arena = root.navigate(initialState, unsafeModule.enter({})).state
    expect(() => root.reduce(arena, { type: "UNSAFE_LEAVE" })).toThrow(
      'Plugin scene "arena" reducer returned state for scene "exploration"'
    )
  })

  it("plugin reducerのraw result literalをauthenticity境界で拒否する", () => {
    const unsafeModule = WizPluginSceneModule.define({
      type: "arena",
      action: z.object({ type: z.literal("RETURN_RAW_RESULT") }).strict(),
      navigation: {
        from: ["village"],
        schema: z.object({}).strict(),
        create: (vault: WizVaultValue): ArenaState => new ArenaState(vault, 0),
      },
      reduce: (state: ArenaState) =>
        ({
          accepted: true,
          events: [],
          state,
        }) as unknown as WizPluginSceneAcceptedResult<ArenaState>,
    })
    const root = new WizRootReducer({
      content: MOCK_CONTENT,
      context: {
        initialVault: MOCK_VAULT,
        initialWorldState: initialState,
      },
      pluginScenes: WizPluginSceneRegistry.define([unsafeModule]),
      shopDialogueService,
    })
    const arena = root.navigate(initialState, unsafeModule.enter({})).state

    expect(() => root.reduce(arena, { type: "RETURN_RAW_RESULT" })).toThrow(
      "Scene reducer must return an authentic WizSceneResult"
    )
  })

  it("plugin result factoryはbuilt-in stateの直接返却を型で拒否する", () => {
    const verifyAuthority = () => {
      // @ts-expect-error plugin resultはplugin stateだけを受け付ける
      return WizPluginSceneResultFactory.accept(toVillageScene(MOCK_VAULT))
    }

    expect(typeof verifyAuthority).toBe("function")
  })

  it("Promise以外のthenableを返すasync schemaも拒否する", () => {
    const module = WizPluginSceneModule.define({
      type: "arena",
      action: {
        "~standard": {
          version: 1,
          vendor: "thenable",
          types: undefined as
            | {
                input: ArenaAction
                output: ArenaAction
              }
            | undefined,
          validate: () => {
            const thenable = Object.create(null)
            Object.defineProperty(thenable, ["th", "en"].join(""), {
              value: () => undefined,
            })

            return thenable as never
          },
        },
      },
      navigation: {
        from: ["village"],
        schema: z.object({}).strict(),
        create: (vault): ArenaState => new ArenaState(vault, 0),
      },
      reduce: (state: ArenaState) => WizPluginSceneResultFactory.accept(state),
    })

    expect(() =>
      module.reduce(new ArenaState(MOCK_VAULT, 0), {} as never)
    ).toThrow(/must validate synchronously/)
  })

  it("scene type重複をregistry構築時に拒否する", () => {
    expect(() =>
      WizPluginSceneRegistry.define([arenaModule, arenaModule])
    ).toThrow(/Duplicate plugin scene type/)
  })

  it("defineを迂回したmoduleと偽造instanceをregistryへ受け入れない", () => {
    expect(() => Reflect.construct(WizPluginSceneModule, [])).toThrow(
      /must be created with define/
    )
    const forgedModule = Object.create(WizPluginSceneModule.prototype)

    expect(() =>
      WizPluginSceneRegistry.define([forgedModule] as never)
    ).toThrow(/accepts only WizPluginSceneModule/)
  })

  it("own isOwnedでmoduleのidentity authorityを偽装できない", () => {
    const forgedModule = Object.create(WizPluginSceneModule.prototype)
    Object.defineProperties(forgedModule, {
      isOwned: { value: () => true },
      navigationSourceTypes: { value: Object.freeze(["village"]) },
      type: { value: "forged-scene" },
    })
    Object.freeze(forgedModule)

    expect(() =>
      WizPluginSceneRegistry.define([forgedModule] as never)
    ).toThrow(/accepts only WizPluginSceneModule/)
  })

  it("own getCanonicalActionでaction schema authorityを迂回できない", () => {
    const forgedResolvedAction = Object.create(
      Object.getPrototypeOf(
        arenaModule.resolveAction({ type: "ARENA_BATTLE_WIN", points: 1 })
      )
    )
    Object.defineProperty(forgedResolvedAction, "getCanonicalAction", {
      value: () => Object.freeze({ type: "ARENA_BATTLE_WIN", points: 999 }),
    })
    Object.freeze(forgedResolvedAction)
    const state = new ArenaState(MOCK_VAULT, 0)

    expect(arenaModule.reduceResolved(state, forgedResolvedAction)).toBeNull()
    expect(
      arenaScenes.getCanonicalAction("arena", forgedResolvedAction)
    ).toBeNull()
  })

  it("own belongsTo/getPayloadでnavigation schema authorityを迂回できない", () => {
    const forgedNavigation = Object.create(WizPluginSceneNavigation.prototype)
    Object.defineProperties(forgedNavigation, {
      belongsTo: { value: () => true },
      getPayload: { value: () => Object.freeze({ score: 999 }) },
      sceneType: { value: "arena" },
      type: { value: "GO_TO_PLUGIN_SCENE" },
    })
    Object.freeze(forgedNavigation)

    expect(arenaScenes.resolveNavigation(initialState, forgedNavigation)).toBe(
      "TRANSITION_PLUGIN_STATE_INVALID"
    )
  })

  it("plugin identity authorityのpublic classと実instance prototypeを凍結する", () => {
    const navigation = arenaModule.enter({ score: 1 })

    expect(Object.isFrozen(WizPluginSceneModule)).toBe(true)
    expect(Object.isFrozen(WizPluginSceneModule.prototype)).toBe(true)
    expect(Object.isFrozen(WizPluginSceneRegistry)).toBe(true)
    expect(Object.isFrozen(WizPluginSceneRegistry.prototype)).toBe(true)
    expect(Object.isFrozen(WizPluginSceneNavigation)).toBe(true)
    expect(Object.isFrozen(WizPluginSceneNavigation.prototype)).toBe(true)
    expect(Object.isFrozen(Object.getPrototypeOf(navigation))).toBe(true)
  })
})
