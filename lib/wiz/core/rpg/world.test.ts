import { describe, expect, it } from "vite-plus/test"
import { z } from "zod"
import {
  WIZ_IMMUTABLE_VALUE,
  WizImmutableValue,
} from "@/lib/wiz/core/immutable-value"
import { WizRpgFeatureAction } from "@/lib/wiz/core/rpg/commands"
import { WizRpgComponentIdentity } from "@/lib/wiz/core/rpg/component-identity"
import {
  WizRpgAffordance,
  WizRpgFeature,
  WizRpgFeatureCodec,
} from "@/lib/wiz/core/rpg/feature"
import { WizRpgPolicy } from "@/lib/wiz/core/rpg/policy"
import { WizRpgSceneRuntime } from "@/lib/wiz/core/rpg/scene-runtime"
import { WizRpgWorld } from "@/lib/wiz/core/rpg/world"
import { WizRpgWorldIdentity } from "@/lib/wiz/core/rpg/world-identity"
import { WizWorldSaveContentVersionError } from "@/lib/wiz/core/save/world-save-codec"

class TestScene {
  declare readonly [WIZ_IMMUTABLE_VALUE]: true

  constructor(readonly step: number) {
    WizImmutableValue.freeze(this)
  }

  next(): TestScene {
    return new TestScene(this.step + 1)
  }
}

Object.freeze(TestScene.prototype)
Object.freeze(TestScene)

type TestSceneAction = Readonly<{ type: "ADVANCE" }>
type ReputationAction = Readonly<{ type: "GAIN_REPUTATION"; amount: number }>

class ReputationCommands {
  declare readonly [WIZ_IMMUTABLE_VALUE]: true

  constructor() {
    WizImmutableValue.freeze(this)
  }

  gain(amount: number): ReputationAction {
    return Object.freeze({ amount, type: "GAIN_REPUTATION" })
  }
}

Object.freeze(ReputationCommands.prototype)
Object.freeze(ReputationCommands)

class AdvanceCounterCommands {
  constructor() {
    Object.freeze(this)
  }

  advance(): TestSceneAction {
    return Object.freeze({ type: "ADVANCE" })
  }
}

Object.freeze(AdvanceCounterCommands.prototype)
Object.freeze(AdvanceCounterCommands)

class MilestoneCommands {
  constructor() {
    Object.freeze(this)
  }

  synchronize(): Readonly<{ type: "SYNCHRONIZE_MILESTONE" }> {
    return Object.freeze({ type: "SYNCHRONIZE_MILESTONE" })
  }
}

Object.freeze(MilestoneCommands.prototype)
Object.freeze(MilestoneCommands)

class CounterCommands {
  constructor() {
    Object.freeze(this)
  }

  add(amount: number): Readonly<{ amount: number; type: "ADD" }> {
    return Object.freeze({ amount, type: "ADD" })
  }
}

Object.freeze(CounterCommands.prototype)
Object.freeze(CounterCommands)

class CountdownCommands {
  constructor() {
    Object.freeze(this)
  }

  start(
    remaining: number
  ): Readonly<{ remaining: number; type: "START_COUNTDOWN" }> {
    return Object.freeze({ remaining, type: "START_COUNTDOWN" })
  }
}

Object.freeze(CountdownCommands.prototype)
Object.freeze(CountdownCommands)

const createRuntime = (content: unknown = { chapters: ["start"] }) =>
  WizRpgSceneRuntime.define({
    actions: Object.freeze({
      advance: (): TestSceneAction => Object.freeze({ type: "ADVANCE" }),
    }),
    capture: (scene: TestScene) => ({ step: scene.step }),
    components: Object.freeze([]),
    identity: WizRpgWorldIdentity.create(content, "test-runtime-1"),
    dispatch: (scene: TestScene, _action: TestSceneAction) => {
      const next = scene.next()
      return Object.freeze({
        accepted: true,
        error: undefined,
        events: Object.freeze([
          { type: "SCENE_ADVANCED", step: next.step },
        ] as const),
        state: next,
      })
    },
    initialScene: new TestScene(0),
    ownsAction: (action): action is TestSceneAction =>
      typeof action === "object" &&
      action !== null &&
      "type" in action &&
      action.type === "ADVANCE",
    restore: (input: unknown) => {
      const value = z
        .strictObject({ step: z.number().int().nonnegative() })
        .parse(input)
      return new TestScene(value.step)
    },
  })

const reputationCodec = WizRpgFeatureCodec.define<
  Readonly<{ points: number }>,
  Readonly<{ points: number }>
>({
  capture: (state) => ({ points: state.points }),
  restore: (data) => Object.freeze({ points: data.points }),
  schema: z.strictObject({ points: z.number().int().nonnegative() }),
})

const createReputationFeature = (identityData: unknown) =>
  WizRpgFeature.forWorld(WizRpgWorld.fromRuntime(createRuntime())).define({
    action: z.strictObject({
      amount: z.number(),
      type: z.literal("GAIN_REPUTATION"),
    }),
    codec: reputationCodec,
    commands: new ReputationCommands(),
    identity: WizRpgComponentIdentity.create("1", identityData),
    initialState: Object.freeze({ points: 0 }),
    key: "reputation",
    react: (context) =>
      typeof context.event === "object" &&
      context.event !== null &&
      "type" in context.event &&
      context.event.type === "SCENE_ADVANCED"
        ? {
            accepted: true,
            events: [
              {
                points: context.state.points + 1,
                type: "REPUTATION_OBSERVED",
              },
            ],
            state: { points: context.state.points + 1 },
          }
        : null,
    reduce: (context, action) =>
      action.amount < 1
        ? { accepted: false, reason: "REPUTATION_AMOUNT_INVALID" }
        : {
            accepted: true,
            events: [{ type: "REPUTATION_GAINED", amount: action.amount }],
            state: { points: context.state.points + action.amount },
          },
  })

const reputationFeature = createReputationFeature(
  Object.freeze({
    tiers: Object.freeze(["unknown", "known", "trusted"]),
  })
)

describe("WizRpgWorld", () => {
  it("sceneを横断するfeature stateをactionとevent reactionで更新する", () => {
    const world =
      WizRpgWorld.fromRuntime(createRuntime()).withFeature(reputationFeature)
    const advanced = world.dispatch(
      world.initialState,
      world.commands.scene.advance()
    )
    const gainCommand = world.commands.feature("reputation").gain(4)
    const gained = world.dispatch(advanced.state, gainCommand)

    expect(gainCommand).toBeInstanceOf(WizRpgFeatureAction)
    expect(gainCommand.featureKey).toBe("reputation")
    expect(Object.isFrozen(gainCommand)).toBe(true)
    expect(Object.isFrozen(gainCommand.payload)).toBe(true)
    expect(advanced.isAccepted()).toBe(true)
    expect(advanced.state.scene.step).toBe(1)
    expect(advanced.state.feature("reputation").points).toBe(1)
    expect(advanced.eventRecords).toMatchObject([
      {
        causedBy: null,
        source: { kind: "scene" },
      },
      {
        causedBy: 0,
        source: { featureKey: "reputation", kind: "feature" },
      },
    ])
    expect(Object.isFrozen(advanced.eventRecords[0])).toBe(true)
    expect(gained.isAccepted()).toBe(true)
    expect(gained.state.feature("reputation").points).toBe(5)
    expect(gained.events).toEqual([{ type: "REPUTATION_GAINED", amount: 4 }])
    expect(gained.eventRecords[0]?.source).toEqual({
      featureKey: "reputation",
      kind: "feature",
    })
  })

  it("feature commandのschema違反を所有者付きerrorとして拒否する", () => {
    const base =
      WizRpgWorld.fromRuntime(createRuntime()).withFeature(reputationFeature)
    const policy = WizRpgPolicy.define<
      typeof base.initialState,
      Parameters<typeof base.dispatch>[1],
      "ALL_ACTIONS_BLOCKED"
    >({
      authorize: () => ({ allowed: false, reason: "ALL_ACTIONS_BLOCKED" }),
      identity: WizRpgComponentIdentity.create("1", Object.freeze({})),
      name: "all-actions-blocked",
    })
    const world = base.withPolicy(policy)
    const result = world.dispatch(
      world.initialState,
      world.commands.feature("reputation").gain(Number.NaN)
    )

    expect(result.error).toEqual({
      actionType: "GAIN_REPUTATION",
      code: "FEATURE_ACTION_INVALID",
      featureKey: "reputation",
    })
  })

  it("同じ構造のscene actionとfeature actionをclass namespaceで衝突させない", () => {
    const base = WizRpgWorld.fromRuntime(createRuntime())
    const advanceCounter = WizRpgFeature.forWorld(base).define({
      action: z.strictObject({ type: z.literal("ADVANCE") }),
      codec: WizRpgFeatureCodec.define({
        capture: (state: Readonly<{ count: number }>) => ({
          count: state.count,
        }),
        restore: (data) => Object.freeze({ count: data.count }),
        schema: z.strictObject({ count: z.number().int().nonnegative() }),
      }),
      commands: new AdvanceCounterCommands(),
      identity: WizRpgComponentIdentity.create("1", Object.freeze({})),
      initialState: Object.freeze({ count: 0 }),
      key: "advanceCounter",
      reduce: (context) => ({
        accepted: true,
        state: { count: context.state.count + 1 },
      }),
    })
    const world = base.withFeature(advanceCounter)

    const featureResult = world.dispatch(
      world.initialState,
      world.commands.feature("advanceCounter").advance()
    )
    const sceneResult = world.dispatch(
      featureResult.state,
      world.commands.scene.advance()
    )

    expect(featureResult.isAccepted()).toBe(true)
    expect(featureResult.state.scene.step).toBe(0)
    expect(featureResult.state.feature("advanceCounter").count).toBe(1)
    expect(sceneResult.isAccepted()).toBe(true)
    expect(sceneResult.state.scene.step).toBe(1)
    expect(sceneResult.state.feature("advanceCounter").count).toBe(1)
  })

  it("同じaction schemaを持つ複数featureを生成値ごとに正しい所有者へ配送する", () => {
    const base = WizRpgWorld.fromRuntime(createRuntime())
    const counterCodec = WizRpgFeatureCodec.define({
      capture: (state: Readonly<{ total: number }>) => ({ total: state.total }),
      restore: (data) => Object.freeze({ total: data.total }),
      schema: z.strictObject({ total: z.number() }),
    })
    const first = WizRpgFeature.forWorld(base).define({
      action: z.strictObject({ amount: z.number(), type: z.literal("ADD") }),
      codec: counterCodec,
      commands: new CounterCommands(),
      identity: WizRpgComponentIdentity.create("1", Object.freeze({})),
      initialState: Object.freeze({ total: 0 }),
      key: "firstCounter",
      reduce: (context, action) => ({
        accepted: true,
        state: { total: context.state.total + action.amount },
      }),
    })
    const withFirst = base.withFeature(first)
    const second = WizRpgFeature.forWorld(withFirst).define({
      action: z.strictObject({ amount: z.number(), type: z.literal("ADD") }),
      codec: counterCodec,
      commands: new CounterCommands(),
      identity: WizRpgComponentIdentity.create("1", Object.freeze({})),
      initialState: Object.freeze({ total: 0 }),
      key: "secondCounter",
      reduce: (context, action) => ({
        accepted: true,
        state: { total: context.state.total + action.amount },
      }),
    })
    const world = withFirst.withFeature(second)
    const amounts = Array.from({ length: 96 }, (_, index) => index - 48)
    const result = amounts.reduce(
      (current, amount, index) =>
        world.dispatch(
          current.state,
          index % 2 === 0
            ? world.commands.feature("firstCounter").add(amount)
            : world.commands.feature("secondCounter").add(amount)
        ),
      world.dispatch(
        world.initialState,
        world.commands.feature("firstCounter").add(0)
      )
    )
    const expectedFirst = amounts
      .filter((_, index) => index % 2 === 0)
      .reduce((total, amount) => total + amount, 0)
    const expectedSecond = amounts
      .filter((_, index) => index % 2 !== 0)
      .reduce((total, amount) => total + amount, 0)

    expect(result.state.feature("firstCounter").total).toBe(expectedFirst)
    expect(result.state.feature("secondCounter").total).toBe(expectedSecond)
    expect(result.state.scene.step).toBe(0)
  })

  it("生成したreaction chainの因果indexと最終stateを保持する", () => {
    const base = WizRpgWorld.fromRuntime(createRuntime())
    const countdown = WizRpgFeature.forWorld(base).define({
      action: z.strictObject({
        remaining: z.number().int().min(0).max(64),
        type: z.literal("START_COUNTDOWN"),
      }),
      codec: WizRpgFeatureCodec.define({
        capture: (state: Readonly<{ reactions: number }>) => ({
          reactions: state.reactions,
        }),
        restore: (data) => Object.freeze({ reactions: data.reactions }),
        schema: z.strictObject({ reactions: z.number().int().nonnegative() }),
      }),
      commands: new CountdownCommands(),
      identity: WizRpgComponentIdentity.create("1", Object.freeze({})),
      initialState: Object.freeze({ reactions: 0 }),
      key: "countdown",
      react: (context) => {
        if (
          typeof context.event !== "object" ||
          context.event === null ||
          !("type" in context.event) ||
          context.event.type !== "COUNTDOWN" ||
          !("remaining" in context.event) ||
          typeof context.event.remaining !== "number"
        ) {
          return null
        }
        return {
          accepted: true,
          events:
            context.event.remaining === 0
              ? []
              : [
                  {
                    remaining: context.event.remaining - 1,
                    type: "COUNTDOWN" as const,
                  },
                ],
          state: { reactions: context.state.reactions + 1 },
        }
      },
      reduce: (context, action) => ({
        accepted: true,
        events: [{ remaining: action.remaining, type: "COUNTDOWN" as const }],
        state: context.state,
      }),
    })
    const world = base.withFeature(countdown)

    for (let remaining = 0; remaining <= 64; remaining += 1) {
      const result = world.dispatch(
        world.initialState,
        world.commands.feature("countdown").start(remaining)
      )

      expect(result.state.feature("countdown").reactions).toBe(remaining + 1)
      expect(result.eventRecords).toHaveLength(remaining + 1)
      expect(result.eventRecords[0]?.causedBy).toBeNull()
      expect(
        result.eventRecords.slice(1).map((record) => record.causedBy)
      ).toEqual(Array.from({ length: remaining }, (_, index) => index))
    }
  })

  it("後続featureから先行feature stateを型安全に参照する", () => {
    const base =
      WizRpgWorld.fromRuntime(createRuntime()).withFeature(reputationFeature)
    const milestone = WizRpgFeature.forWorld(base).define({
      action: z.strictObject({ type: z.literal("SYNCHRONIZE_MILESTONE") }),
      codec: WizRpgFeatureCodec.define({
        capture: (state: Readonly<{ highestReputation: number }>) => ({
          highestReputation: state.highestReputation,
        }),
        restore: (data) =>
          Object.freeze({ highestReputation: data.highestReputation }),
        schema: z.strictObject({
          highestReputation: z.number().int().nonnegative(),
        }),
      }),
      commands: new MilestoneCommands(),
      identity: WizRpgComponentIdentity.create("1", Object.freeze({})),
      initialState: Object.freeze({ highestReputation: 0 }),
      key: "milestone",
      reduce: (context) => ({
        accepted: true,
        state: {
          highestReputation: Math.max(
            context.state.highestReputation,
            context.features.reputation.points
          ),
        },
      }),
    })
    const world = base.withFeature(milestone)
    const gained = world.dispatch(
      world.initialState,
      world.commands.feature("reputation").gain(7)
    )
    const synchronized = world.dispatch(
      gained.state,
      world.commands.feature("milestone").synchronize()
    )

    expect(synchronized.state.feature("milestone").highestReputation).toBe(7)

    const verifyDependency = (): void => {
      const worldWithoutReputation = WizRpgWorld.fromRuntime(createRuntime())
      // @ts-expect-error milestoneはreputation feature stateを必要とする
      worldWithoutReputation.withFeature(milestone)
    }
    void verifyDependency
  })

  it("循環reactionを因果位置とfeature key付きで拒否する", () => {
    const base = WizRpgWorld.fromRuntime(createRuntime())
    const looping = WizRpgFeature.forWorld(base).define({
      action: z.strictObject({ type: z.literal("START_LOOP") }),
      codec: WizRpgFeatureCodec.define({
        capture: (state: Readonly<{ reactions: number }>) => ({
          reactions: state.reactions,
        }),
        restore: (data) => Object.freeze({ reactions: data.reactions }),
        schema: z.strictObject({ reactions: z.number().int().nonnegative() }),
      }),
      commands: Object.freeze({
        start: (): Readonly<{ type: "START_LOOP" }> =>
          Object.freeze({ type: "START_LOOP" }),
      }),
      identity: WizRpgComponentIdentity.create("1", Object.freeze({})),
      initialState: Object.freeze({ reactions: 0 }),
      key: "looping",
      react: (context) =>
        typeof context.event === "object" &&
        context.event !== null &&
        "type" in context.event &&
        context.event.type === "LOOP"
          ? {
              accepted: true,
              events: [{ type: "LOOP" }],
              state: { reactions: context.state.reactions + 1 },
            }
          : null,
      reduce: (context) => ({
        accepted: true,
        events: [{ type: "LOOP" }],
        state: context.state,
      }),
    })
    const world = base.withFeature(looping)
    const result = world.dispatch(
      world.initialState,
      world.commands.feature("looping").start()
    )

    expect(result.error).toEqual({
      causedBy: 1024,
      code: "FEATURE_REACTION_LIMIT_EXCEEDED",
      featureKey: "looping",
      maximumReactionSteps: 1024,
    })
    expect(result.state).toBe(world.initialState)
    expect(result.events).toEqual([])
    expect(result.eventRecords).toEqual([])
  })

  it("feature reactionの型付き拒否でdispatch全体をrollbackする", () => {
    const base = WizRpgWorld.fromRuntime(createRuntime())
    const guard = WizRpgFeature.forWorld(base).define({
      action: z.strictObject({ type: z.literal("ADVANCE") }),
      codec: WizRpgFeatureCodec.define({
        capture: (state: Readonly<{ observed: number }>) => ({
          observed: state.observed,
        }),
        restore: (data) => Object.freeze({ observed: data.observed }),
        schema: z.strictObject({ observed: z.number().int().nonnegative() }),
      }),
      commands: new AdvanceCounterCommands(),
      identity: WizRpgComponentIdentity.create(
        "1",
        Object.freeze({ maximumObservedSceneSteps: 0 })
      ),
      initialState: Object.freeze({ observed: 0 }),
      key: "sceneStepGuard",
      react: (context) =>
        typeof context.event === "object" &&
        context.event !== null &&
        "type" in context.event &&
        context.event.type === "SCENE_ADVANCED"
          ? { accepted: false, reason: "SCENE_STEP_LIMIT_REACHED" }
          : null,
      reduce: (context) => ({ accepted: true, state: context.state }),
    })
    const world = base.withFeature(guard)
    const result = world.dispatch(
      world.initialState,
      world.commands.scene.advance()
    )

    expect(result.error).toEqual({
      causedBy: 0,
      code: "FEATURE_REACTION_REJECTED",
      featureKey: "sceneStepGuard",
      reason: "SCENE_STEP_LIMIT_REACHED",
    })
    expect(result.state).toBe(world.initialState)
    expect(result.state.scene.step).toBe(0)
    expect(result.events).toEqual([])
    expect(result.eventRecords).toEqual([])
  })

  it("prototypeだけを偽装したcomposition objectを拒否する", () => {
    const base = WizRpgWorld.fromRuntime(createRuntime())
    const forgedRuntime = Object.freeze(
      Object.create(WizRpgSceneRuntime.prototype)
    )
    const forgedFeature = Object.freeze(Object.create(WizRpgFeature.prototype))
    const forgedPolicy = Object.freeze(Object.create(WizRpgPolicy.prototype))
    const forgedAffordance = Object.freeze(
      Object.create(WizRpgAffordance.prototype)
    )
    const policy = WizRpgPolicy.define<
      typeof base.initialState,
      TestSceneAction,
      never
    >({
      affordances: () => [forgedAffordance],
      authorize: () => ({ allowed: true }),
      identity: WizRpgComponentIdentity.create("1", {}),
      name: "forged-affordance-provider",
    })
    const world = base.withPolicy(policy)

    expect(() => WizRpgWorld.fromRuntime(forgedRuntime)).toThrow(
      "RPG scene runtime must be created with WizRpgSceneRuntime.define()"
    )
    expect(() => base.withFeature(forgedFeature)).toThrow(
      "RPG feature must be created with WizRpgFeature.forWorld(...).define()"
    )
    expect(() => base.withPolicy(forgedPolicy)).toThrow(
      "RPG policy must be created with WizRpgPolicy.define()"
    )
    expect(() => world.affordances(world.initialState)).toThrow(
      "RPG affordance at index 0 must be created with WizRpgAffordance.define()"
    )
  })

  it("extension callbackの不正なresult contractを境界で拒否する", () => {
    const base = WizRpgWorld.fromRuntime(createRuntime())
    const invalidFeature = WizRpgFeature.forWorld(base).define({
      action: z.strictObject({ type: z.literal("ADVANCE") }),
      codec: WizRpgFeatureCodec.define({
        capture: (state: Readonly<{ count: number }>) => ({
          count: state.count,
        }),
        restore: (data) => Object.freeze({ count: data.count }),
        schema: z.strictObject({ count: z.number().int().nonnegative() }),
      }),
      commands: new AdvanceCounterCommands(),
      identity: WizRpgComponentIdentity.create("1", {}),
      initialState: Object.freeze({ count: 0 }),
      key: "invalidResult",
      reduce: () => ({ accepted: false }) as never,
    })
    const invalidPolicy = WizRpgPolicy.define<
      typeof base.initialState,
      TestSceneAction,
      "INVALID"
    >({
      authorize: () => ({ allowed: false }) as never,
      identity: WizRpgComponentIdentity.create("1", {}),
      name: "invalid-result",
    })
    const invalidRuntime = WizRpgSceneRuntime.define({
      actions: Object.freeze({
        advance: (): TestSceneAction => Object.freeze({ type: "ADVANCE" }),
      }),
      capture: (scene: TestScene) => ({ step: scene.step }),
      components: Object.freeze([]),
      dispatch: (scene: TestScene) =>
        ({
          accepted: false,
          error: undefined,
          events: [],
          state: scene,
        }) as never,
      identity: WizRpgWorldIdentity.create({}, "invalid-result-runtime-1"),
      initialScene: new TestScene(0),
      ownsAction: (action): action is TestSceneAction =>
        typeof action === "object" &&
        action !== null &&
        "type" in action &&
        action.type === "ADVANCE",
      restore: () => new TestScene(0),
    })
    const invalidFeatureWorld = base.withFeature(invalidFeature)
    const invalidPolicyWorld = base.withPolicy(invalidPolicy)
    const invalidRuntimeWorld = WizRpgWorld.fromRuntime(invalidRuntime)
    const invalidOwnerRuntime = WizRpgSceneRuntime.define({
      actions: Object.freeze({
        advance: (): TestSceneAction => Object.freeze({ type: "ADVANCE" }),
      }),
      capture: (scene: TestScene) => ({ step: scene.step }),
      components: Object.freeze([]),
      dispatch: (scene: TestScene) => ({
        accepted: true,
        error: undefined,
        events: [],
        state: scene,
      }),
      identity: WizRpgWorldIdentity.create({}, "invalid-owner-runtime-1"),
      initialScene: new TestScene(0),
      ownsAction: (_action: unknown): _action is TestSceneAction =>
        "truthy" as never,
      restore: () => new TestScene(0),
    })
    const invalidOwnerWorld = WizRpgWorld.fromRuntime(invalidOwnerRuntime)

    expect(() =>
      invalidFeatureWorld.dispatch(
        invalidFeatureWorld.initialState,
        invalidFeatureWorld.commands.feature("invalidResult").advance()
      )
    ).toThrow('RPG feature "invalidResult" reducer rejected result must have')
    expect(() =>
      invalidPolicyWorld.dispatch(
        invalidPolicyWorld.initialState,
        invalidPolicyWorld.commands.scene.advance()
      )
    ).toThrow('RPG policy "invalid-result" authorize rejection must have')
    expect(() =>
      invalidRuntimeWorld.dispatch(
        invalidRuntimeWorld.initialState,
        invalidRuntime.actions.advance()
      )
    ).toThrow("Rejected RPG scene dispatch must return a coded error")
    expect(() =>
      invalidOwnerWorld.dispatch(
        invalidOwnerWorld.initialState,
        invalidOwnerRuntime.actions.advance()
      )
    ).toThrow("RPG scene runtime ownsAction must return a boolean")
  })

  it("scene runtime構築時にinitial sceneを防御所有する", () => {
    const initialScene = { step: 0 }
    const runtime = WizRpgSceneRuntime.define({
      actions: Object.freeze({
        advance: (): TestSceneAction => Object.freeze({ type: "ADVANCE" }),
      }),
      capture: (scene: Readonly<{ step: number }>) => ({ step: scene.step }),
      components: Object.freeze([]),
      identity: WizRpgWorldIdentity.create({}, "ownership-test-1"),
      dispatch: (scene: Readonly<{ step: number }>) => ({
        accepted: true,
        error: undefined,
        events: [],
        state: scene,
      }),
      initialScene,
      ownsAction: (action): action is TestSceneAction =>
        typeof action === "object" &&
        action !== null &&
        "type" in action &&
        action.type === "ADVANCE",
      restore: () => ({ step: 0 }),
    })

    initialScene.step = 9

    expect(runtime.initialScene.step).toBe(0)
  })

  it("plain sceneとdispatch resultを公開型でもdeep readonlyにする", () => {
    const restoredSource = { nested: { values: [3] } }
    const runtime = WizRpgSceneRuntime.define({
      actions: Object.freeze({
        advance: (): TestSceneAction => Object.freeze({ type: "ADVANCE" }),
      }),
      capture: (
        scene: Readonly<{ nested: Readonly<{ values: readonly number[] }> }>
      ) => ({
        nested: { values: [...scene.nested.values] },
      }),
      components: Object.freeze([]),
      dispatch: (
        scene: Readonly<{ nested: Readonly<{ values: readonly number[] }> }>
      ) => ({
        accepted: true,
        error: undefined,
        events: [{ metadata: { values: [2] }, type: "ADVANCED" }],
        state: scene,
      }),
      identity: WizRpgWorldIdentity.create({}, "deep-readonly-test-1"),
      initialScene: { nested: { values: [1] } },
      ownsAction: (action): action is TestSceneAction =>
        typeof action === "object" &&
        action !== null &&
        "type" in action &&
        action.type === "ADVANCE",
      restore: () => restoredSource,
    })
    const world = WizRpgWorld.fromRuntime(runtime)
    const result = world.dispatch(
      world.initialState,
      world.commands.scene.advance()
    )
    const restored = runtime.restore({})
    restoredSource.nested.values.push(4)
    const verifyReadonlyTypes = (): void => {
      // @ts-expect-error 公開sceneのnested arrayはdeep readonly
      world.initialState.scene.nested.values.push(2)
      // @ts-expect-error dispatch eventのnested arrayもdeep readonly
      result.events[0]?.metadata.values.push(3)
      // @ts-expect-error runtime restore結果もdeep readonly
      restored.nested.values.push(5)
    }

    void verifyReadonlyTypes
    expect(Object.isFrozen(world.initialState.scene.nested.values)).toBe(true)
    expect(Object.isFrozen(result.events[0]?.metadata.values)).toBe(true)
    expect(restored.nested.values).toEqual([3])
    expect(Object.isFrozen(restored.nested.values)).toBe(true)
  })

  it("scene runtimeのcommand surfaceを型と実体の両方でdeep readonlyにする", () => {
    expect(() =>
      WizRpgSceneRuntime.define({
        actions: {
          advance: (): TestSceneAction => Object.freeze({ type: "ADVANCE" }),
        },
        capture: (scene: TestScene) => ({ step: scene.step }),
        components: Object.freeze([]),
        identity: WizRpgWorldIdentity.create({}, "command-surface-test-1"),
        dispatch: (scene: TestScene) => ({
          accepted: true,
          error: undefined,
          events: [],
          state: scene,
        }),
        initialScene: new TestScene(0),
        ownsAction: (action): action is TestSceneAction =>
          typeof action === "object" &&
          action !== null &&
          "type" in action &&
          action.type === "ADVANCE",
        restore: () => new TestScene(0),
      })
    ).toThrow("RPG scene command surface must be deeply immutable")

    expect(() =>
      WizRpgSceneRuntime.define({
        actions: Object.freeze({
          advance: (): TestSceneAction => Object.freeze({ type: "ADVANCE" }),
          metadata: { labels: ["advance"] },
        }),
        capture: (scene: TestScene) => ({ step: scene.step }),
        components: Object.freeze([]),
        dispatch: (scene: TestScene) => ({
          accepted: true,
          error: undefined,
          events: [],
          state: scene,
        }),
        identity: WizRpgWorldIdentity.create(
          {},
          "nested-command-surface-test-1"
        ),
        initialScene: new TestScene(0),
        ownsAction: (action): action is TestSceneAction =>
          typeof action === "object" &&
          action !== null &&
          "type" in action &&
          action.type === "ADVANCE",
        restore: () => new TestScene(0),
      })
    ).toThrow("RPG scene command surface must be deeply immutable at metadata")

    const runtime = WizRpgSceneRuntime.define({
      actions: Object.freeze({
        advance: (): TestSceneAction => Object.freeze({ type: "ADVANCE" }),
        metadata: Object.freeze({
          labels: Object.freeze(["advance"]),
        }),
      }),
      capture: (scene: TestScene) => ({ step: scene.step }),
      components: Object.freeze([]),
      dispatch: (scene: TestScene) => ({
        accepted: true,
        error: undefined,
        events: [],
        state: scene,
      }),
      identity: WizRpgWorldIdentity.create({}, "deep-command-surface-test-1"),
      initialScene: new TestScene(0),
      ownsAction: (action): action is TestSceneAction =>
        typeof action === "object" &&
        action !== null &&
        "type" in action &&
        action.type === "ADVANCE",
      restore: () => new TestScene(0),
    })
    const verifyReadonlyTypes = (): void => {
      // @ts-expect-error command metadataのnested arrayはdeep readonly
      runtime.actions.metadata.labels.push("other")
    }

    void verifyReadonlyTypes
    expect(Object.isFrozen(runtime.actions.metadata.labels)).toBe(true)
  })

  it("policyの認可とaffordanceを同じcompositionで公開する", () => {
    const base =
      WizRpgWorld.fromRuntime(createRuntime()).withFeature(reputationFeature)
    const policy = WizRpgPolicy.define<
      typeof base.initialState,
      Parameters<typeof base.dispatch>[1],
      "REPUTATION_LOCKED"
    >({
      affordances: () => [
        WizRpgAffordance.define({
          action: base.commands.feature("reputation").gain(1),
          id: "gain-reputation",
        }),
      ],
      authorize: (state, action) =>
        action instanceof WizRpgFeatureAction &&
        action.payload.type === "GAIN_REPUTATION" &&
        state.scene.step === 0
          ? { allowed: false, reason: "REPUTATION_LOCKED" }
          : { allowed: true },
      identity: WizRpgComponentIdentity.create(
        "1",
        Object.freeze({ threshold: 1 })
      ),
      name: "reputation-availability",
    })
    const world = base.withPolicy(policy)
    const rejected = world.dispatch(
      world.initialState,
      world.commands.feature("reputation").gain(1)
    )

    expect(rejected.error).toEqual({
      code: "POLICY_REJECTED",
      policyName: "reputation-availability",
      reason: "REPUTATION_LOCKED",
    })
    expect(world.affordances(world.initialState)[0]?.enabled).toBe(false)
  })

  it("affordanceを全policyで認可して最終状態を返す", () => {
    const base =
      WizRpgWorld.fromRuntime(createRuntime()).withFeature(reputationFeature)
    const provider = WizRpgPolicy.define<
      typeof base.initialState,
      Parameters<typeof base.dispatch>[1],
      never
    >({
      affordances: () => [
        WizRpgAffordance.define({
          action: base.commands.feature("reputation").gain(1),
          id: "gain-reputation",
        }),
      ],
      authorize: () => ({ allowed: true }),
      identity: WizRpgComponentIdentity.create("1", Object.freeze({})),
      name: "provider",
    })
    const restriction = WizRpgPolicy.define<
      typeof base.initialState,
      Parameters<typeof base.dispatch>[1],
      "REPUTATION_LOCKED"
    >({
      authorize: (_state, action) =>
        action instanceof WizRpgFeatureAction &&
        action.payload.type === "GAIN_REPUTATION"
          ? { allowed: false, reason: "REPUTATION_LOCKED" }
          : { allowed: true },
      identity: WizRpgComponentIdentity.create("1", Object.freeze({})),
      name: "restriction",
    })
    const world = base.withPolicy(provider).withPolicy(restriction)

    expect(world.affordances(world.initialState)[0]).toMatchObject({
      enabled: false,
      reason: "REPUTATION_LOCKED",
    })
  })

  it("重複するaffordance idを拒否する", () => {
    const base = WizRpgWorld.fromRuntime(createRuntime())
    const first = WizRpgPolicy.define<
      typeof base.initialState,
      TestSceneAction,
      never
    >({
      affordances: () => [
        WizRpgAffordance.define({
          action: { type: "ADVANCE" },
          id: "advance",
        }),
      ],
      authorize: () => ({ allowed: true }),
      identity: WizRpgComponentIdentity.create("1", Object.freeze({})),
      name: "first",
    })
    const second = WizRpgPolicy.define<
      typeof base.initialState,
      TestSceneAction,
      never
    >({
      affordances: () => [
        WizRpgAffordance.define({
          action: { type: "ADVANCE" },
          id: "advance",
        }),
      ],
      authorize: () => ({ allowed: true }),
      identity: WizRpgComponentIdentity.create("1", Object.freeze({})),
      name: "second",
    })
    const world = base.withPolicy(first).withPolicy(second)

    expect(() => world.affordances(world.initialState)).toThrow(
      'Duplicate RPG affordance id "advance"'
    )
  })

  it("dispatchできないaffordance actionをpolicy評価前に拒否する", () => {
    const base =
      WizRpgWorld.fromRuntime(createRuntime()).withFeature(reputationFeature)
    const policy = WizRpgPolicy.define<
      typeof base.initialState,
      Parameters<typeof base.dispatch>[1],
      never
    >({
      affordances: () => [
        WizRpgAffordance.define({
          action: base.commands.feature("reputation").gain(Number.NaN),
          id: "invalid-reputation",
        }),
      ],
      authorize: () => ({ allowed: true }),
      identity: WizRpgComponentIdentity.create("1", Object.freeze({})),
      name: "invalid-affordance-provider",
    })
    const world = base.withPolicy(policy)

    expect(() => world.affordances(world.initialState)).toThrow(
      'RPG affordance "invalid-reputation" has invalid action for feature "reputation": FEATURE_ACTION_INVALID'
    )
  })

  it("policy追加後はaction unionを変えるfeatureを追加できない", () => {
    const base = WizRpgWorld.fromRuntime(createRuntime())
    const policy = WizRpgPolicy.define<
      typeof base.initialState,
      TestSceneAction,
      never
    >({
      authorize: () => ({ allowed: true }),
      identity: WizRpgComponentIdentity.create("1", Object.freeze({})),
      name: "final-policy",
    })
    const finalized = base.withPolicy(policy)
    const verifyCompositionOrder = (): void => {
      // @ts-expect-error policyが認可するaction unionの確定後にfeatureは追加できない
      finalized.withFeature(reputationFeature)
    }

    void verifyCompositionOrder
  })

  it("sceneと全featureを自動content identity付きで保存・復元する", () => {
    const world =
      WizRpgWorld.fromRuntime(createRuntime()).withFeature(reputationFeature)
    const advanced = world.dispatch(
      world.initialState,
      world.commands.scene.advance()
    )
    const gained = world.dispatch(
      advanced.state,
      world.commands.feature("reputation").gain(3)
    )
    const saved = JSON.parse(JSON.stringify(world.save(gained.state)))
    const restored = world.restore(saved)

    expect(saved.contentVersion).toBe(world.identity)
    expect(restored.scene.step).toBe(1)
    expect(restored.feature("reputation").points).toBe(4)
  })

  it("runtime・feature・policyの構成manifestを不変な診断値として公開する", () => {
    const runtime = createRuntime()
    const featured =
      WizRpgWorld.fromRuntime(runtime).withFeature(reputationFeature)
    const policy = WizRpgPolicy.define<
      typeof featured.initialState,
      Parameters<typeof featured.dispatch>[1],
      never
    >({
      authorize: () => ({ allowed: true }),
      identity: WizRpgComponentIdentity.create(
        "2",
        Object.freeze({ threshold: 3 })
      ),
      name: "manifest-policy",
    })
    const world = featured.withPolicy(policy)
    const featureComponent = world.manifest.find("feature", "reputation")
    const policyComponent = world.manifest.find("policy", "manifest-policy")
    const differentFeature = WizRpgWorld.fromRuntime(runtime)
      .withFeature(createReputationFeature({ tiers: ["different"] }))
      .manifest.find("feature", "reputation")

    expect(world.manifest.runtimeIdentity).toBe(runtime.identity.value)
    expect(world.manifest.worldIdentity).toBe(world.identity)
    expect(world.manifest.components).toEqual([
      featureComponent,
      policyComponent,
    ])
    expect(world.manifest.list("feature")).toEqual([featureComponent])
    expect(featureComponent?.dataIdentity).toBe(
      reputationFeature.identity.digest
    )
    expect(policyComponent?.dataIdentity).toBe(policy.identity.digest)
    expect(featureComponent).toMatchObject({
      key: "reputation",
      kind: "feature",
      revision: "1",
    })
    expect(policyComponent).toMatchObject({
      key: "manifest-policy",
      kind: "policy",
      revision: "2",
    })
    expect(featureComponent?.identity).not.toBe(differentFeature?.identity)
    expect(Object.isFrozen(world.manifest)).toBe(true)
    expect(Object.isFrozen(world.manifest.components)).toBe(true)
    expect(Object.isFrozen(featureComponent)).toBe(true)
    expect(Object.isFrozen(world.manifest.list("feature"))).toBe(true)
  })

  it("feature codecのtransformを復元時に一度だけ適用する", () => {
    let transformCalls = 0
    const transformedCodec = WizRpgFeatureCodec.define<
      Readonly<{ points: number }>,
      Readonly<{ points: string }>,
      Readonly<{ points: number }>
    >({
      capture: (state) => ({ points: String(state.points) }),
      restore: (data) => Object.freeze({ points: data.points }),
      schema: z.strictObject({
        points: z.string().transform((value) => {
          transformCalls += 1
          return Number(value)
        }),
      }),
    })
    const transformedFeature = WizRpgFeature.forWorld(
      WizRpgWorld.fromRuntime(createRuntime())
    ).define({
      action: z.strictObject({
        amount: z.number(),
        type: z.literal("GAIN_REPUTATION"),
      }),
      codec: transformedCodec,
      commands: new ReputationCommands(),
      identity: WizRpgComponentIdentity.create("1", Object.freeze({})),
      initialState: Object.freeze({ points: 3 }),
      key: "transformed",
      reduce: (context) => ({ accepted: true, state: context.state }),
    })
    const world =
      WizRpgWorld.fromRuntime(createRuntime()).withFeature(transformedFeature)
    const saved = JSON.parse(JSON.stringify(world.save(world.initialState)))
    transformCalls = 0

    const restored = world.restore(saved)

    expect(restored.feature("transformed").points).toBe(3)
    expect(transformCalls).toBe(1)
  })

  it("policyとreducerのaction解釈を一致させるためaction schema transformを許可しない", () => {
    const verifyIdentityActionSchema = (): void => {
      // @ts-expect-error feature action schemaは入力を別の出力型へtransformできない
      WizRpgFeature.forWorld(WizRpgWorld.fromRuntime(createRuntime())).define({
        action: z.strictObject({
          amount: z.string().transform(Number),
          type: z.literal("GAIN_REPUTATION"),
        }),
        codec: reputationCodec,
        commands: Object.freeze({
          gain: (
            amount: string
          ): Readonly<{ amount: string; type: "GAIN_REPUTATION" }> =>
            Object.freeze({ amount, type: "GAIN_REPUTATION" }),
        }),
        identity: WizRpgComponentIdentity.create("1", Object.freeze({})),
        initialState: Object.freeze({ points: 0 }),
        key: "invalidTransform",
        reduce: () => ({ accepted: true, state: { points: 0 } }),
      })
    }

    void verifyIdentityActionSchema
  })

  it("同じrevisionでもfeature identity dataが異なるsaveを受理しない", () => {
    const source = WizRpgWorld.fromRuntime(createRuntime()).withFeature(
      createReputationFeature({ tiers: ["known"] })
    )
    const target = WizRpgWorld.fromRuntime(createRuntime()).withFeature(
      createReputationFeature({ tiers: ["trusted"] })
    )

    expect(target.identity).not.toBe(source.identity)
    expect(() => target.restore(source.save(source.initialState))).toThrow(
      WizWorldSaveContentVersionError
    )
  })

  it("異なるcontentから作られたsaveを受理しない", () => {
    const source = WizRpgWorld.fromRuntime(createRuntime({ chapter: "one" }))
    const target = WizRpgWorld.fromRuntime(createRuntime({ chapter: "two" }))

    expect(() => target.restore(source.save(source.initialState))).toThrow(
      WizWorldSaveContentVersionError
    )
  })
})
