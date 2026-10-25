import { z } from "zod"
import { describe, expect, expectTypeOf, it } from "vite-plus/test"

import {
  WizWorld,
  WizWorldCompositionError,
  WizWorldDispatchResult,
  WizWorldEnvironment,
  WizWorldEnvironmentValueError,
  WizWorldEventReaction,
  WizWorldModule,
  WizWorldReactionPolicy,
  type WizWorldRule,
  WizWorldStateOwnership,
  WizWorldValueOwnershipError,
} from "@/lib/wiz/core/world/world"
import {
  WIZ_IMMUTABLE_VALUE,
  type WizDeepReadonly,
  WizImmutableValue,
} from "@/lib/wiz/core/immutable-value"
import type { WizStandardSchemaDefinition } from "@/lib/wiz/core/standard-schema"

type CounterState = Readonly<{ count: number }>
type CounterAction = Readonly<{ type: "INCREMENT"; amount: number }>
type CounterEvent = Readonly<{ type: "INCREMENTED"; amount: number }>

const counterModule = WizWorldModule.define<CounterState, CounterAction, CounterEvent>({
  accepts: (action): action is CounterAction =>
    typeof action === "object" &&
    action !== null &&
    "type" in action &&
    action.type === "INCREMENT",
  name: "counter",
  reduce: (state, action) => ({
    accepted: true,
    events: [{ type: "INCREMENTED", amount: action.amount }],
    state: Object.freeze({ count: state.count + action.amount }),
  }),
})

describe("WizWorld", () => {
  const verifyNominalWorldDependencies = () => {
    // @ts-expect-error environmentはfactory生成classだけを受理する。
    WizWorld.create({ count: 0 }, { nextId: () => "id", now: () => 0, random: () => 0 })
    const world = WizWorld.create({ count: 0 })
    // @ts-expect-error reaction policyはfactory生成classだけを受理する。
    world.withReactionPolicy({ maximumReactionSteps: 1 })
  }
  void verifyNominalWorldDependencies

  it("state ownershipとdispatch factoryをprototype/static改変から隔離する", () => {
    const ownership = WizWorldStateOwnership.deepImmutable<CounterState>()
    const verifyReadonlyAuthorities = () => {
      // @ts-expect-error state ownership portは構築後に差し替えられない。
      ownership.own = (state) => state
      // @ts-expect-error state ownership factoryは構築後に差し替えられない。
      WizWorldStateOwnership.define = () => ownership
      // @ts-expect-error dispatch result factoryは構築後に差し替えられない。
      WizWorldDispatchResult.accepted = () => Object.freeze({})
    }
    void verifyReadonlyAuthorities

    expect(Object.isFrozen(WizWorldStateOwnership.prototype)).toBe(true)
    expect(Object.isFrozen(WizWorldStateOwnership)).toBe(true)
    expect(Object.isFrozen(WizWorldDispatchResult.prototype)).toBe(true)
    expect(Object.isFrozen(WizWorldDispatchResult)).toBe(true)
    expect(Reflect.ownKeys(ownership)).not.toContain("ownState")
    expect(() =>
      Object.defineProperty(WizWorldStateOwnership.prototype, "own", {
        configurable: true,
        value: (state: CounterState) => state,
      }),
    ).toThrow(TypeError)
    expect(() =>
      Object.defineProperty(WizWorldDispatchResult, "accepted", {
        configurable: true,
        value: () => Object.freeze({ accepted: true, state: { count: 999 } }),
      }),
    ).toThrow(TypeError)

    const result = WizWorld.create({ count: 0 }, undefined, ownership)
      .with(counterModule)
      .dispatch({ count: 1 }, { type: "INCREMENT", amount: 2 })

    expect(result).toBeInstanceOf(WizWorldDispatchResult)
    expect(result.state).toEqual({ count: 3 })
    expect(Object.isFrozen(result.state)).toBe(true)
  })

  it("公開factory以外のruntime constructor迂回を拒否する", () => {
    expect(() =>
      Reflect.construct(WizWorldStateOwnership, [{ ownState: (value: unknown) => value }]),
    ).toThrow(TypeError)
    expect(() => Reflect.construct(WizWorldEnvironment, [{}])).toThrow(TypeError)
    expect(() =>
      Reflect.construct(WizWorldEventReaction, [
        {
          accepts: () => true,
          name: "forged",
          react: () => ({ accepted: true, state: {} }),
        },
      ]),
    ).toThrow(TypeError)
    expect(() => Reflect.construct(WizWorldReactionPolicy, [{ maximumReactionSteps: 1 }])).toThrow(
      TypeError,
    )
    expect(() =>
      Reflect.construct(WizWorldModule, [
        {
          name: "forged",
          match: () => ({ action: {} }),
          reduce: () => ({ accepted: true, state: {} }),
        },
      ]),
    ).toThrow(TypeError)
    expect(() =>
      Reflect.construct(WizWorldDispatchResult, [{ accepted: true, state: { count: 0 } }]),
    ).toThrow(TypeError)
    expect(() =>
      Reflect.construct(WizWorld, [
        {
          environment: WizWorldEnvironment.create(),
          initialState: { count: 0 },
          modules: [],
          stateOwnership: WizWorldStateOwnership.deepImmutable(),
        },
      ]),
    ).toThrow(TypeError)
    expect(() =>
      // eslint-disable-next-line typescript/unbound-method -- runtimeのfactory引数偽装を検証する。
      Reflect.apply(WizWorld.create, WizWorld, [
        { count: 0 },
        Object.freeze({
          nextId: () => "forged-id",
          now: () => 0,
          random: () => 0,
        }),
      ]),
    ).toThrow(TypeError)
    const world = WizWorld.create({ count: 0 })
    expect(() =>
      // eslint-disable-next-line typescript/unbound-method -- runtimeのinstance引数偽装を検証する。
      Reflect.apply(world.withReactionPolicy, world, [Object.freeze({ maximumReactionSteps: 0 })]),
    ).toThrow(TypeError)
    const forgedOwnership = Object.freeze({
      own: (value: CounterState) => value,
    }) as unknown as WizWorldStateOwnership<CounterState>
    expect(() =>
      WizWorld.create({ count: 0 }, WizWorldEnvironment.create(), forgedOwnership),
    ).toThrow(TypeError)
    expect(() =>
      WizWorldDispatchResult.accepted<CounterState, never>({ count: 0 }, [], forgedOwnership),
    ).toThrow(TypeError)
    const forgedModule = Object.freeze({
      accepts: () => true,
      name: "forged",
    }) as unknown as WizWorldModule<CounterState, CounterAction>
    expect(() => world.with(forgedModule)).toThrow(TypeError)
    const forgedReaction = Object.freeze({
      accepts: () => true,
      name: "forged",
    }) as unknown as WizWorldEventReaction<CounterState, never>
    expect(() => world.withReaction(forgedReaction)).toThrow(TypeError)
  })

  it("module追加とdispatchで元のworld/stateを変更しない", () => {
    const environment = WizWorldEnvironment.create({
      nextId: () => "fixed-id",
      now: () => 100,
      random: () => 0.5,
    })
    const emptyWorld = WizWorld.create<CounterState>(Object.freeze({ count: 1 }), environment)
    const world = emptyWorld.with(counterModule)

    const result = world.dispatch(world.initialState, {
      type: "INCREMENT",
      amount: 2,
    })

    expect(result.accepted).toBe(true)
    expect(result.state).toEqual({ count: 3 })
    expect(result.events).toEqual([{ type: "INCREMENTED", amount: 2 }])
    expect(world.initialState).toEqual({ count: 1 })
    expect(emptyWorld).not.toBe(world)
  })

  it("defineとschemaのacceptsが検証済みinputへnarrowする", () => {
    const guardedCandidate: unknown = { type: "INCREMENT", amount: 1 }
    if (counterModule.accepts(guardedCandidate)) {
      expectTypeOf(guardedCandidate).toEqualTypeOf<CounterAction>()
    }

    let schemaValidationCount = 0
    const schemaModule = WizWorldModule.fromSchema({
      name: "schema-acceptance",
      schema: z
        .strictObject({
          type: z.literal("SCHEMA_ACCEPTED"),
          amount: z.number().default(1),
        })
        .transform((action) => {
          schemaValidationCount += 1
          return action
        }),
      reduce: (state: CounterState, action) => ({
        accepted: true,
        state: { count: state.count + action.amount },
      }),
    })
    const schemaCandidate: unknown = { type: "SCHEMA_ACCEPTED" }
    if (schemaModule.accepts(schemaCandidate)) {
      const acceptedType: "SCHEMA_ACCEPTED" = schemaCandidate.type

      expect(acceptedType).toBe("SCHEMA_ACCEPTED")
    }
    expect(schemaValidationCount).toBe(1)
  })

  it("schema変換後の値をownership診断として扱う", () => {
    const schema: WizStandardSchemaDefinition<Readonly<{ type: "TRANSFORM_TO_DATE" }>, Date> = {
      "~standard": {
        validate: () => ({ value: new Date("2026-01-01T00:00:00.000Z") }),
        vendor: "world-output-ownership-test",
        version: 1,
      },
    }
    const module = WizWorldModule.fromSchema({
      name: "transform-to-date",
      reduce: (state: CounterState) => ({ accepted: true, state }),
      schema,
    })
    const result = WizWorld.create<CounterState>({ count: 0 })
      .with(module)
      .dispatchUnknown({ count: 0 }, { type: "TRANSFORM_TO_DATE" })

    expect(result.error).toEqual({
      actionType: "TRANSFORM_TO_DATE",
      code: "ACTION_VALIDATION_FAILED",
      diagnostics: [
        {
          kind: "ownership",
          moduleName: "transform-to-date",
          path: "$",
          reason: "mutable built-in instances are not immutable data",
          valueType: "Date",
        },
      ],
    })
  })

  it("unknown actionのaccessorを実行せずownership validationとして診断する", () => {
    const action = Object.create(null)
    Object.defineProperty(action, "type", {
      enumerable: true,
      get: () => {
        throw new Error("must not execute")
      },
    })

    const result = WizWorld.create<CounterState>({ count: 0 })
      .with(counterModule)
      .dispatchUnknown({ count: 0 }, action)

    expect(result.error).toMatchObject({
      actionType: "object",
      code: "ACTION_VALIDATION_FAILED",
      diagnostics: [
        {
          kind: "ownership",
          moduleName: "counter",
          path: "$.type",
          reason: "accessor properties are not supported by deep immutable ownership",
          valueType: "Object",
        },
      ],
    })
  })

  it("guard actionを所有できない場合に未処理actionへ読み替えない", () => {
    const result = WizWorld.create<CounterState>({ count: 0 })
      .with(counterModule)
      .dispatchUnknown(
        { count: 0 },
        {
          amount: 1,
          callback: () => undefined,
          type: "INCREMENT",
        },
      )

    expect(result.error).toMatchObject({
      actionType: "INCREMENT",
      code: "ACTION_VALIDATION_FAILED",
      diagnostics: [
        {
          kind: "ownership",
          moduleName: "counter",
          path: "$.callback",
          reason: "function properties are not immutable data",
          valueType: "Function",
        },
      ],
    })
  })

  it("ownership diagnosticの型名取得でconstructor getterを実行しない", () => {
    const action = Object.create(null)
    Object.defineProperty(action, "constructor", {
      enumerable: true,
      get: () => {
        throw new Error("constructor getter must not execute")
      },
    })
    Object.defineProperty(action, "type", {
      enumerable: true,
      value: "INCREMENT",
    })

    const result = WizWorld.create<CounterState>({ count: 0 })
      .with(counterModule)
      .dispatchUnknown({ count: 0 }, action)

    expect(result.error).toMatchObject({
      actionType: "INCREMENT",
      code: "ACTION_VALIDATION_FAILED",
      diagnostics: [
        {
          kind: "ownership",
          moduleName: "counter",
          path: "$.constructor",
          reason: "accessor properties are not supported by deep immutable ownership",
          valueType: "Object",
        },
      ],
    })
  })

  it("Proxy reflection failureをownership diagnosticへ正規化する", () => {
    const action = new Proxy(
      {},
      {
        getPrototypeOf: () => {
          throw new Error("PROXY_TRAP_RAN")
        },
      },
    )

    const result = WizWorld.create<CounterState>({ count: 0 })
      .with(counterModule)
      .dispatchUnknown({ count: 0 }, action)

    expect(result.error).toEqual({
      actionType: "object",
      code: "ACTION_VALIDATION_FAILED",
      diagnostics: [
        {
          kind: "ownership",
          moduleName: "counter",
          path: "$",
          reason: "value could not be inspected safely",
          valueType: "Object",
        },
      ],
    })
  })

  it("validation diagnosticsをentry・issue・pathまで所有する", () => {
    const path = [{ key: "amount" }]
    const issues = [{ message: "before", path }]
    const schema: WizStandardSchemaDefinition = {
      "~standard": {
        validate: () => ({ issues }),
        vendor: "mutable-test",
        version: 1,
      },
    }
    const module = WizWorldModule.fromSchema({
      name: "diagnostic-ownership",
      schema,
      reduce: (state: CounterState) => ({ accepted: true, state }),
    })
    const world = WizWorld.create<CounterState>({ count: 0 }).with(module)

    const result = world.dispatchUnknown(world.initialState, { type: "INVALID" })
    issues[0].message = "after"
    path[0].key = "changed"

    expect(result.error).toEqual({
      actionType: "INVALID",
      code: "ACTION_VALIDATION_FAILED",
      diagnostics: [
        {
          kind: "schema",
          issues: [{ message: "before", path: [{ key: "amount" }] }],
          moduleName: "diagnostic-ownership",
        },
      ],
    })
    if (result.error?.code === "ACTION_VALIDATION_FAILED") {
      const diagnostic = result.error.diagnostics[0]
      expect(Object.isFrozen(diagnostic)).toBe(true)
      if (diagnostic?.kind === "schema") {
        expect(Object.isFrozen(diagnostic.issues[0])).toBe(true)
        expect(Object.isFrozen(diagnostic.issues[0].path)).toBe(true)
      }
    }
  })

  it("構築後に外部definition propertyを差し替えてもmoduleの挙動を変更しない", () => {
    const definition: {
      name: string
      accepts: (action: unknown) => action is CounterAction
      reduce: (
        state: CounterState,
        action: CounterAction,
      ) => Readonly<{ accepted: true; state: CounterState }>
    } = {
      name: "captured-definition",
      accepts: (action): action is CounterAction =>
        typeof action === "object" &&
        action !== null &&
        "type" in action &&
        action.type === "INCREMENT",
      reduce: (state, action) => ({
        accepted: true,
        state: { count: state.count + action.amount },
      }),
    }
    const module = WizWorldModule.define(definition)

    definition.name = "changed-definition"
    definition.accepts = (_action): _action is CounterAction => {
      throw new Error("changed accepts must not run")
    }
    definition.reduce = () => ({ accepted: true, state: { count: 999 } })

    const world = WizWorld.create<CounterState>({ count: 1 }).with(module)
    const result = world.dispatch(world.initialState, { type: "INCREMENT", amount: 2 })

    expect(module.name).toBe("captured-definition")
    expect(result.state).toEqual({ count: 3 })

    const actionSchema = z.strictObject({
      type: z.literal("CAPTURED_SCHEMA"),
      amount: z.number(),
    })
    const alternateSchema = z
      .strictObject({
        type: z.literal("CAPTURED_SCHEMA"),
        amount: z.number(),
      })
      .refine(() => false)
    const schemaDefinition = {
      name: "captured-schema-definition",
      schema: actionSchema,
      reduce: (state: CounterState, action: WizDeepReadonly<z.output<typeof actionSchema>>) => ({
        accepted: true as const,
        state: { count: state.count + action.amount },
      }),
    }
    const schemaModule = WizWorldModule.fromSchema(schemaDefinition)

    schemaDefinition.name = "changed-schema-definition"
    schemaDefinition.schema = alternateSchema
    schemaDefinition.reduce = () => ({ accepted: true, state: { count: 999 } })

    const schemaWorld = WizWorld.create<CounterState>({ count: 1 }).with(schemaModule)
    const schemaResult = schemaWorld.dispatch(schemaWorld.initialState, {
      type: "CAPTURED_SCHEMA",
      amount: 2,
    })

    expect(schemaModule.name).toBe("captured-schema-definition")
    expect(schemaResult.state).toEqual({ count: 3 })
  })

  it("schemaからaction型を推論し、default/transform後の値を一度だけ所有してruleへ渡す", () => {
    const defaultMetadata = { tags: ["default"] }
    let parseCount = 0
    let transformedAction:
      | {
          type: "ADD_NORMALIZED"
          amount: number
          metadata: { tags: string[] }
        }
      | undefined
    let observedAction:
      | Readonly<{
          type: "ADD_NORMALIZED"
          amount: number
          metadata: Readonly<{ tags: readonly string[] }>
        }>
      | undefined
    const actionSchema = z
      .strictObject({
        type: z.literal("ADD_NORMALIZED"),
        amount: z.coerce.number().default(2),
        metadata: z
          .strictObject({
            tags: z.array(z.string()),
          })
          .default(defaultMetadata),
      })
      .transform((action) => {
        parseCount += 1
        transformedAction = {
          ...action,
          amount: action.amount * 2,
        }
        return transformedAction
      })
    const module = WizWorldModule.fromSchema({
      name: "schema-counter",
      schema: actionSchema,
      reduce: (state: CounterState, action) => {
        expectTypeOf(action).toEqualTypeOf<WizDeepReadonly<z.output<typeof actionSchema>>>()
        observedAction = action
        return {
          accepted: true,
          state: { count: state.count + action.amount },
        }
      },
    })
    const world = WizWorld.create<CounterState>({ count: 1 }).with(module)
    expectTypeOf<typeof world.dispatch>()
      .parameter(1)
      .toEqualTypeOf<WizDeepReadonly<z.input<typeof actionSchema>>>()
    const externalAction = {
      type: "ADD_NORMALIZED" as const,
      amount: "3",
    }

    const result = world.dispatch(world.initialState, externalAction)
    externalAction.amount = "99"
    defaultMetadata.tags.push("late-default")
    transformedAction?.metadata.tags.push("late-transform")

    expect(parseCount).toBe(1)
    expect(result).toMatchObject({
      accepted: true,
      state: { count: 7 },
    })
    expect(observedAction).toEqual({
      type: "ADD_NORMALIZED",
      amount: 6,
      metadata: { tags: ["default"] },
    })
    expect(observedAction).not.toBe(transformedAction)
    expect(Object.isFrozen(observedAction)).toBe(true)
    expect(Object.isFrozen(observedAction?.metadata)).toBe(true)
    expect(Object.isFrozen(observedAction?.metadata.tags)).toBe(true)
  })

  it("Standard Schemaへraw class inputを渡し、plain outputだけを所有する", () => {
    type DateAction = Readonly<{
      type: "SET_EPOCH"
      epoch: number
      metadata: Readonly<{ tags: readonly string[] }>
    }>

    let validatorInput: unknown
    let transformedAction:
      | { type: "SET_EPOCH"; epoch: number; metadata: { tags: string[] } }
      | undefined
    let reducerAction: WizDeepReadonly<DateAction> | undefined
    const schema: WizStandardSchemaDefinition<Date, DateAction> = Object.freeze({
      "~standard": Object.freeze({
        validate: (value: unknown) => {
          validatorInput = value
          if (!(value instanceof Date)) {
            return {
              issues: [{ message: "Expected Date" }],
            }
          }
          transformedAction = {
            type: "SET_EPOCH",
            epoch: value.getTime(),
            metadata: { tags: ["validated"] },
          }
          return { value: transformedAction }
        },
        vendor: "open-wiz-test",
        version: 1,
      }),
    })
    const schemaModule = WizWorldModule.fromSchema({
      name: "date-input",
      schema,
      reduce: (_state: CounterState, action) => {
        reducerAction = action
        return {
          accepted: true,
          state: { count: action.epoch },
        }
      },
    })
    const world = WizWorld.create<CounterState>({ count: 0 }).with(counterModule).with(schemaModule)
    const input = new Date(42)

    const result = world.dispatch(world.initialState, input)
    input.setTime(99)
    transformedAction?.metadata.tags.push("late")

    expect(validatorInput).toBe(input)
    expect(result.state.count).toBe(42)
    expect(reducerAction).toEqual({
      type: "SET_EPOCH",
      epoch: 42,
      metadata: { tags: ["validated"] },
    })
    expect(reducerAction).not.toBe(transformedAction)
    expect(Object.isFrozen(reducerAction)).toBe(true)
    expect(Object.isFrozen(reducerAction?.metadata)).toBe(true)
    expect(Object.isFrozen(reducerAction?.metadata.tags)).toBe(true)
  })

  it("最小のStandard Schema V1実装からもinput/outputを推論する", () => {
    type StructuralInput = Readonly<{
      type: "STRUCTURAL_INCREMENT"
      amount: string
    }>
    type StructuralOutput = Readonly<{
      type: "STRUCTURAL_INCREMENT"
      amount: number
    }>

    let validationCount = 0
    const schema: WizStandardSchemaDefinition<StructuralInput, StructuralOutput> = Object.freeze({
      "~standard": Object.freeze({
        validate: (action: unknown) => {
          validationCount += 1
          if (
            typeof action !== "object" ||
            action === null ||
            !("type" in action) ||
            action.type !== "STRUCTURAL_INCREMENT" ||
            !("amount" in action) ||
            typeof action.amount !== "string"
          ) {
            return Object.freeze({
              issues: Object.freeze([Object.freeze({ message: "Invalid structural action" })]),
            })
          }
          return Object.freeze({
            value: Object.freeze({
              amount: Number(action.amount),
              type: action.type,
            }),
          })
        },
        vendor: "open-wiz-test",
        version: 1,
      }),
    })
    const module = WizWorldModule.fromSchema({
      name: "structural-schema",
      schema,
      reduce: (state: CounterState, action) => {
        expectTypeOf(action).toEqualTypeOf<WizDeepReadonly<StructuralOutput>>()
        return { accepted: true, state: { count: state.count + action.amount } }
      },
    })
    const world = WizWorld.create<CounterState>({ count: 1 }).with(module)
    expectTypeOf<typeof world.dispatch>()
      .parameter(1)
      .toEqualTypeOf<WizDeepReadonly<StructuralInput>>()

    const result = world.dispatch(world.initialState, {
      amount: "2",
      type: "STRUCTURAL_INCREMENT",
    })

    expect(result.state).toEqual({ count: 3 })
    expect(validationCount).toBe(1)

    const invalidAccepted = module.accepts({
      amount: 2,
      type: "STRUCTURAL_INCREMENT",
    })

    expect(invalidAccepted).toBe(false)
    expect(validationCount).toBe(2)
  })

  it("非同期Zod schemaを同期dispatch境界で明確に拒否する", () => {
    const schema = z
      .strictObject({
        type: z.literal("ASYNC_INCREMENT"),
        amount: z.number(),
      })
      .transform(async (action) => action)
    const module = WizWorldModule.fromSchema({
      name: "async-schema",
      schema,
      reduce: (state: CounterState, action) => ({
        accepted: true,
        state: { count: state.count + action.amount },
      }),
    })
    const world = WizWorld.create<CounterState>({ count: 1 }).with(module)

    expect(() =>
      world.dispatch(world.initialState, {
        amount: 2,
        type: "ASYNC_INCREMENT",
      }),
    ).toThrowError('World action schema for module "async-schema" must validate synchronously')
  })

  it("schema出力がimmutable classならnominal型とprototypeを維持する", () => {
    class ImmutableIncrementAction {
      declare readonly [WIZ_IMMUTABLE_VALUE]: true
      readonly type = "IMMUTABLE_CLASS_INCREMENT" as const

      constructor(readonly amount: number) {
        WizImmutableValue.freeze(this)
      }

      doubledAmount(): number {
        return this.amount * 2
      }
    }

    const schema = z.custom<ImmutableIncrementAction>(
      (action) => action instanceof ImmutableIncrementAction,
    )
    let observedAction: ImmutableIncrementAction | undefined
    const module = WizWorldModule.fromSchema({
      name: "immutable-class-action",
      schema,
      reduce: (state: CounterState, action) => {
        expectTypeOf(action).toEqualTypeOf<ImmutableIncrementAction>()
        observedAction = action
        return {
          accepted: true,
          state: { count: state.count + action.doubledAmount() },
        }
      },
    })
    const world = WizWorld.create<CounterState>({ count: 1 }).with(module)
    const action = new ImmutableIncrementAction(2)

    const result = world.dispatch(world.initialState, action)

    expect(observedAction).toBe(action)
    expect(observedAction).toBeInstanceOf(ImmutableIncrementAction)
    expect(result.state).toEqual({ count: 5 })
  })

  it("schema validation failureではruleを呼ばず、schema例外はunhandledへ変換しない", () => {
    let parseCount = 0
    let reduceCount = 0
    const schema = z
      .strictObject({
        type: z.literal("VALIDATED_INCREMENT"),
        amount: z.unknown(),
      })
      .superRefine((action, context) => {
        parseCount += 1
        if (
          typeof action.amount !== "number" ||
          !Number.isInteger(action.amount) ||
          action.amount <= 0
        ) {
          context.addIssue({
            code: "custom",
            message: "amount must be a positive integer",
            path: ["amount"],
          })
        }
      })
      .transform((action) => ({
        ...action,
        amount: action.amount as number,
      }))
    const module = WizWorldModule.fromSchema({
      name: "validated-counter",
      schema,
      reduce: (state: CounterState, action) => {
        reduceCount += 1
        return { accepted: true, state: { count: state.count + action.amount } }
      },
    })
    const world = WizWorld.create<CounterState>({ count: 1 }).with(module)

    const invalid = world.dispatch(world.initialState, {
      type: "VALIDATED_INCREMENT",
      amount: "invalid",
    })

    expect(parseCount).toBe(1)
    expect(reduceCount).toBe(0)
    expect(invalid.error).toEqual({
      actionType: "VALIDATED_INCREMENT",
      code: "ACTION_VALIDATION_FAILED",
      diagnostics: [
        {
          kind: "schema",
          issues: [
            {
              message: "amount must be a positive integer",
              path: ["amount"],
            },
          ],
          moduleName: "validated-counter",
        },
      ],
    })

    const schemaError = new Error("schema transform failed")
    let throwingParseCount = 0
    const throwingSchema: WizStandardSchemaDefinition<Readonly<{ type: "THROWING_SCHEMA" }>> =
      Object.freeze({
        "~standard": Object.freeze({
          validate: () => {
            throwingParseCount += 1
            throw schemaError
          },
          vendor: "open-wiz-test-throwing",
          version: 1,
        }),
      })
    const throwingModule = WizWorldModule.fromSchema({
      name: "throwing-schema",
      schema: throwingSchema,
      reduce: (state: CounterState) => ({ accepted: true, state }),
    })
    const throwingWorld = WizWorld.create<CounterState>({ count: 1 }).with(throwingModule)

    expect(() =>
      throwingWorld.dispatch(throwingWorld.initialState, { type: "THROWING_SCHEMA" }),
    ).toThrow(schemaError)
    expect(throwingParseCount).toBe(1)
  })

  it("複数schemaの正規化結果を混ぜず、各schemaを一度だけ評価して曖昧拒否する", () => {
    const parseCounts = { first: 0, second: 0 }
    const reduceCounts = { first: 0, second: 0 }
    const baseSchema = z.strictObject({
      type: z.literal("OVERLAPPING_ACTION"),
      amount: z.coerce.number(),
    })
    const firstSchema = baseSchema.transform((parsed) => {
      parseCounts.first += 1
      return { ...parsed, amount: parsed.amount + 1 }
    })
    const first = WizWorldModule.fromSchema({
      name: "first-schema",
      schema: firstSchema,
      reduce: (state: CounterState, action) => {
        reduceCounts.first += 1
        return { accepted: true, state: { count: state.count + action.amount } }
      },
    })
    const secondSchema = baseSchema.transform((parsed) => {
      parseCounts.second += 1
      return { ...parsed, amount: parsed.amount + 100 }
    })
    const second = WizWorldModule.fromSchema({
      name: "second-schema",
      schema: secondSchema,
      reduce: (state: CounterState, action) => {
        reduceCounts.second += 1
        return { accepted: true, state: { count: state.count + action.amount } }
      },
    })
    const world = WizWorld.create<CounterState>({ count: 1 }).with(first).with(second)

    const result = world.dispatch(world.initialState, {
      type: "OVERLAPPING_ACTION",
      amount: "2",
    })

    expect(parseCounts).toEqual({ first: 1, second: 1 })
    expect(reduceCounts).toEqual({ first: 0, second: 0 })
    expect(result.state).toBe(world.initialState)
    expect(result.error).toEqual({
      actionType: "OVERLAPPING_ACTION",
      code: "AMBIGUOUS_ACTION",
      moduleNames: ["first-schema", "second-schema"],
    })
  })

  it("environment providerの壊れた値を利用地点で拒否する", () => {
    const environment = WizWorldEnvironment.create({
      nextId: () => "",
      now: () => Number.NaN,
      random: () => 1,
    })

    expect(() => environment.now()).toThrowError(
      expect.objectContaining({
        source: "now",
        value: Number.NaN,
      }),
    )
    expect(() => environment.random()).toThrowError(
      expect.objectContaining({
        source: "random",
        value: 1,
      }),
    )
    expect(() => environment.nextId()).toThrowError(
      expect.objectContaining({
        source: "nextId",
        value: "",
      }),
    )

    const whitespaceIdEnvironment = WizWorldEnvironment.create({
      nextId: () => "   ",
    })
    expect(() => whitespaceIdEnvironment.nextId()).toThrowError(
      expect.objectContaining({
        source: "nextId",
        value: "   ",
      }),
    )
    const paddedIdEnvironment = WizWorldEnvironment.create({
      nextId: () => " padded-id ",
    })
    expect(() => paddedIdEnvironment.nextId()).toThrowError(
      expect.objectContaining({
        source: "nextId",
        value: " padded-id ",
      }),
    )

    const mutableInvalidValue = { nested: { source: "before" } }
    const objectEnvironment = WizWorldEnvironment.create({
      now: () => mutableInvalidValue as unknown as number,
    })
    let diagnosticValue: unknown
    try {
      objectEnvironment.now()
    } catch (error) {
      diagnosticValue = (error as WizWorldEnvironmentValueError).value
    }
    mutableInvalidValue.nested.source = "after"

    expect(diagnosticValue).toEqual({ nested: { source: "before" } })
    expect(Object.isFrozen(diagnosticValue)).toBe(true)
    expect(Object.isFrozen((diagnosticValue as { nested: { source: string } }).nested)).toBe(true)

    let getterCalls = 0
    const accessorArray = ["before"]
    Object.defineProperty(accessorArray, "0", {
      enumerable: true,
      get: () => {
        getterCalls += 1
        throw new Error("DIAGNOSTIC_GETTER_RAN")
      },
    })
    const accessorEnvironment = WizWorldEnvironment.create({
      now: () => accessorArray as unknown as number,
    })

    expect(() => accessorEnvironment.now()).toThrowError(WizWorldEnvironmentValueError)
    try {
      accessorEnvironment.now()
    } catch (error) {
      expect((error as WizWorldEnvironmentValueError).value).toEqual([{ valueType: "Accessor" }])
    }
    expect(getterCalls).toBe(0)
  })

  it("未登録actionを診断付きで拒否する", () => {
    const world = WizWorld.create<CounterState>({ count: 1 })
    const result = (world as unknown as WizWorld<CounterState, { type: "UNKNOWN" }>).dispatch(
      world.initialState,
      { type: "UNKNOWN" },
    )

    expect(result.accepted).toBe(false)
    expect(result.state).toBe(world.initialState)
    expect(result.error).toEqual({
      actionType: "UNKNOWN",
      code: "UNHANDLED_ACTION",
    })
  })

  it("同名moduleを暗黙に上書きしない", () => {
    const world = WizWorld.create<CounterState>({ count: 1 }).with(counterModule)

    expect(() => world.with(counterModule)).toThrowError(WizWorldCompositionError)
  })

  it("曖昧なmodule名と不安定なrejection reasonを拒否する", () => {
    expect(() =>
      WizWorldModule.define<CounterState, CounterAction>({
        accepts: counterModule.accepts.bind(counterModule),
        name: " counter ",
        reduce: (state) => ({ accepted: true, state }),
      }),
    ).toThrow(RangeError)

    const invalidRejection = WizWorldModule.define<CounterState, CounterAction, never, "   ">({
      accepts: counterModule.accepts.bind(counterModule),
      name: "invalid-rejection",
      reduce: () => ({ accepted: false, reason: "   " }),
    })
    const world = WizWorld.create<CounterState>({ count: 1 }).with(invalidRejection)

    expect(() => world.dispatch(world.initialState, { type: "INCREMENT", amount: 1 })).toThrow(
      RangeError,
    )

    const paddedRejection = WizWorldModule.define<CounterState, CounterAction, never, " PADDED ">({
      accepts: counterModule.accepts.bind(counterModule),
      name: "padded-rejection",
      reduce: () => ({ accepted: false, reason: " PADDED " }),
    })
    const paddedWorld = WizWorld.create<CounterState>({ count: 1 }).with(paddedRejection)

    expect(() =>
      paddedWorld.dispatch(paddedWorld.initialState, {
        type: "INCREMENT",
        amount: 1,
      }),
    ).toThrow(RangeError)
    expect(() =>
      WizWorldDispatchResult.rejectedByRule({ count: 1 }, { type: "INCREMENT" }, " PADDED "),
    ).toThrow(RangeError)
  })

  it("module callbackの不正なresult shapeを成功扱いしない", () => {
    const invalidResults = [
      {
        expected: 'World module "invalid-result" reducer must return an accepted or rejected',
        value: undefined,
      },
      {
        expected:
          'World module "invalid-result" reducer accepted result must have accepted true and a state',
        value: { accepted: "yes", state: { count: 1 } },
      },
      {
        expected: 'World module "invalid-result" reducer accepted result events must be an array',
        value: { accepted: true, events: "not-an-array", state: { count: 1 } },
      },
    ] as const

    for (const invalid of invalidResults) {
      const module = WizWorldModule.define<CounterState, CounterAction>({
        accepts: (action): action is CounterAction =>
          typeof action === "object" &&
          action !== null &&
          "type" in action &&
          action.type === "INCREMENT",
        name: "invalid-result",
        reduce: () => invalid.value as never,
      })
      const world = WizWorld.create<CounterState>({ count: 0 }).with(module)

      expect(() => world.dispatch(world.initialState, { amount: 1, type: "INCREMENT" })).toThrow(
        invalid.expected,
      )
    }
  })

  it("moduleとevent reactionのpredicateはbooleanだけを受理する", () => {
    type Started = Readonly<{ type: "STARTED" }>

    const invalidModule = WizWorldModule.define<CounterState, CounterAction>({
      accepts: (_action: unknown): _action is CounterAction => "truthy" as never,
      name: "invalid-predicate",
      reduce: (state) => ({ accepted: true, state }),
    })
    expect(() =>
      WizWorld.create<CounterState>({ count: 0 })
        .with(invalidModule)
        .dispatchUnknown({ count: 0 }, { amount: 1, type: "INCREMENT" }),
    ).toThrow('World module "invalid-predicate" accepts must return a boolean')

    const source = WizWorldModule.define<CounterState, CounterAction, Started>({
      accepts: (action): action is CounterAction =>
        typeof action === "object" &&
        action !== null &&
        "type" in action &&
        action.type === "INCREMENT",
      name: "predicate-source",
      reduce: (state) => ({ accepted: true, events: [{ type: "STARTED" }], state }),
    })
    const invalidReaction = WizWorldEventReaction.define<CounterState, Started>({
      accepts: (_event: unknown): _event is Started => "truthy" as never,
      name: "invalid-predicate",
      react: (state) => ({ accepted: true, state }),
    })
    const world = WizWorld.create<CounterState>({ count: 0 })
      .with(source)
      .withReaction(invalidReaction)

    expect(() => world.dispatch(world.initialState, { amount: 1, type: "INCREMENT" })).toThrow(
      'World event reaction "invalid-predicate" accepts must return a boolean',
    )
  })

  it("同じactionを複数moduleが処理する曖昧な構成を拒否する", () => {
    const secondCounter = WizWorldModule.define<CounterState, CounterAction>({
      accepts: (action): action is CounterAction =>
        typeof action === "object" &&
        action !== null &&
        "type" in action &&
        action.type === "INCREMENT",
      name: "second-counter",
      reduce: (state, action) => ({
        accepted: true,
        state: Object.freeze({ count: state.count + action.amount * 10 }),
      }),
    })
    const world = WizWorld.create<CounterState>({ count: 1 })
      .with(counterModule)
      .with(secondCounter)

    const result = world.dispatch(world.initialState, {
      type: "INCREMENT",
      amount: 2,
    })

    expect(result.accepted).toBe(false)
    expect(result.state).toBe(world.initialState)
    expect(result.error).toEqual({
      actionType: "INCREMENT",
      code: "AMBIGUOUS_ACTION",
      moduleNames: ["counter", "second-counter"],
    })
  })

  it("initialStateを再帰copyして呼び出し側の変更から所有stateを隔離する", () => {
    const input = {
      nested: {
        values: [1, 2],
      },
    }
    const world = WizWorld.create(input)
    const verifyReadonlyInitialState = () => {
      // @ts-expect-error owned initial stateはdeep readonly
      world.initialState.nested.values.push(4)
      // @ts-expect-error nested propertyもreadonly
      world.initialState.nested = { values: [] }
    }

    void verifyReadonlyInitialState
    input.nested.values.push(3)
    input.nested = { values: [9] }

    expect(world.initialState).toEqual({
      nested: {
        values: [1, 2],
      },
    })
    expect(world.initialState).not.toBe(input)
    expect(world.initialState.nested).not.toBe(input.nested)
    expect(Object.isFrozen(world.initialState)).toBe(true)
    expect(Object.isFrozen(world.initialState.nested)).toBe(true)
    expect(Object.isFrozen(world.initialState.nested.values)).toBe(true)
  })

  it("dispatch入力とreducer戻りstateの両境界で所有権を取得する", () => {
    type NestedState = {
      readonly values: readonly number[]
    }
    type AppendAction = {
      readonly type: "APPEND"
      readonly value: number
    }

    let stateObservedByRule: NestedState | undefined
    let stateReturnedByRule: { values: number[] } | undefined
    const appendModule = WizWorldModule.define<NestedState, AppendAction>({
      accepts: (action): action is AppendAction =>
        typeof action === "object" &&
        action !== null &&
        "type" in action &&
        action.type === "APPEND",
      name: "append",
      reduce: (state, action) => {
        stateObservedByRule = state
        stateReturnedByRule = { values: [...state.values, action.value] }
        return { accepted: true, state: stateReturnedByRule }
      },
    })
    const externalState = { values: [1] }
    const world = WizWorld.create<NestedState>({ values: [] }).with(appendModule)
    const result = world.dispatch(externalState, { type: "APPEND", value: 2 })

    externalState.values.push(9)
    stateReturnedByRule?.values.push(10)

    expect(stateObservedByRule).not.toBe(externalState)
    expect(Object.isFrozen(stateObservedByRule)).toBe(true)
    expect(Object.isFrozen(stateObservedByRule?.values)).toBe(true)
    expect(result.state).toEqual({ values: [1, 2] })
    expect(result.state).not.toBe(stateReturnedByRule)
    expect(Object.isFrozen(result.state)).toBe(true)
    expect(Object.isFrozen(result.state.values)).toBe(true)
  })

  it("不変class instanceのprototypeとmethodを壊さない", () => {
    class ImmutableCounter {
      declare readonly [WIZ_IMMUTABLE_VALUE]: true
      readonly #count: number

      constructor(count: number) {
        this.#count = count
        WizImmutableValue.freeze(this)
      }

      get count(): number {
        return this.#count
      }

      increment(): ImmutableCounter {
        return new ImmutableCounter(this.count + 1)
      }
    }

    const initialState = new ImmutableCounter(1)
    const module = WizWorldModule.define<ImmutableCounter, Readonly<{ type: "INCREMENT_CLASS" }>>({
      accepts: (action): action is Readonly<{ type: "INCREMENT_CLASS" }> =>
        typeof action === "object" &&
        action !== null &&
        "type" in action &&
        action.type === "INCREMENT_CLASS",
      name: "immutable-counter",
      reduce: (state) => ({ accepted: true, state: state.increment() }),
    })
    const world = WizWorld.create(initialState).with(module)
    const result = world.dispatch(world.initialState, { type: "INCREMENT_CLASS" })
    const next = world.dispatch(result.state, { type: "INCREMENT_CLASS" })
    const exactInitialState: ImmutableCounter = world.initialState
    const exactResultState: ImmutableCounter = result.state

    expect(exactInitialState).toBe(initialState)
    expect(exactResultState.count).toBe(2)
    expect(world.initialState).toBe(initialState)
    expect(world.initialState).toBeInstanceOf(ImmutableCounter)
    expect(result.state).toBeInstanceOf(ImmutableCounter)
    expect(result.state.count).toBe(2)
    expect(next.state.count).toBe(3)
  })

  it("immutable Array subclassも通常配列へ変換せずprototypeを維持する", () => {
    class DicePool extends Array<number> {
      declare readonly [WIZ_IMMUTABLE_VALUE]: true

      constructor(...values: number[]) {
        super(...values)
        WizImmutableValue.freeze(this)
      }

      total(): number {
        return this.reduce((sum, value) => sum + value, 0)
      }
    }

    const pool = new DicePool(1, 2, 3)
    const world = WizWorld.create(pool)

    expect(world.initialState).toBe(pool)
    expect(world.initialState).toBeInstanceOf(DicePool)
    expect(world.initialState.total()).toBe(6)
  })

  it("mutableなclassとbuilt-inを暗黙に共有せず拒否する", () => {
    class MutableCounter {
      count = 1
    }
    class MutableMapSubclass extends Map<string, string> {
      declare readonly [WIZ_IMMUTABLE_VALUE]: true

      constructor() {
        super([["status", "before"]])
        WizImmutableValue.freeze(this)
      }
    }

    expect(() => WizWorld.create(new MutableCounter())).toThrowError(WizWorldValueOwnershipError)
    expect(() => WizWorld.create(new Date())).toThrowError(WizWorldValueOwnershipError)
    expect(() => WizWorld.create(Object.freeze(new Date()))).toThrowError(
      WizWorldValueOwnershipError,
    )
    expect(() => WizWorld.create(new MutableMapSubclass())).toThrowError(
      WizWorldValueOwnershipError,
    )
  })

  it("freezeだけでは観測不能なprivate可変stateを不変classと誤認しない", () => {
    class HiddenMutableCounter {
      #count = 1

      constructor() {
        Object.freeze(this)
      }

      increment(): void {
        this.#count += 1
      }

      count(): number {
        return this.#count
      }
    }

    expect(() => WizWorld.create(new HiddenMutableCounter())).toThrowError(
      expect.objectContaining({
        path: "$",
        valueType: "HiddenMutableCounter",
      }),
    )
  })

  it("外側だけfreezeされたclassをimmutable atomとして誤認しない", () => {
    class ShallowFrozenCounter {
      declare readonly [WIZ_IMMUTABLE_VALUE]: true
      readonly nested = { count: 1 }

      constructor() {
        WizImmutableValue.freeze(this)
      }
    }

    expect(() => WizWorld.create(new ShallowFrozenCounter())).toThrowError(
      expect.objectContaining({
        path: "$.nested",
        valueType: "Object",
      }),
    )
  })

  it("freeze済みでもclosure stateを持てるfunction propertyは拒否する", () => {
    class FunctionBackedCounter {
      declare readonly [WIZ_IMMUTABLE_VALUE]: true
      readonly read: () => number

      constructor() {
        let count = 0
        this.read = Object.freeze(() => {
          count += 1
          return count
        })
        WizImmutableValue.freeze(this)
      }
    }

    expect(() => WizWorld.create(new FunctionBackedCounter())).toThrowError(
      expect.objectContaining({
        path: "$.read",
        valueType: "Function",
      }),
    )
  })

  it("独自ownership strategyでclass stateのcopy/freeze方法を差し替えられる", () => {
    class CounterBox {
      declare readonly [WIZ_IMMUTABLE_VALUE]: true
      readonly count: number

      constructor(count: number) {
        this.count = count
        WizImmutableValue.freeze(this)
      }
    }

    type CounterInput = Readonly<{ count: number }> | CounterBox

    const ownership = WizWorldStateOwnership.define<CounterInput>({
      ownState: (state) => new CounterBox(state.count),
    })
    const input = { count: 1 }
    const world = WizWorld.create(input, WizWorldEnvironment.create(), ownership)

    input.count = 9

    expect(world.initialState).not.toBe(input)
    expect(world.initialState).toBeInstanceOf(CounterBox)
    expect(world.initialState.count).toBe(1)
    expect(Object.isFrozen(world.initialState)).toBe(true)
  })

  it("独自ownershipのclass resultにもWiz immutable contractを要求する", () => {
    class UndeclaredCounterBox {
      readonly count: number

      constructor(count: number) {
        this.count = count
        Object.freeze(this)
      }
    }

    const ownership = WizWorldStateOwnership.define<UndeclaredCounterBox>({
      ownState: (state) => new UndeclaredCounterBox(state.count),
    })

    expect(() => ownership.own(new UndeclaredCounterBox(1))).toThrowError(
      expect.objectContaining({
        path: "$",
        reason: "class instances must declare the WizImmutableValue contract",
        valueType: "UndeclaredCounterBox",
      }),
    )
  })

  it("独自ownership callbackがmutableなidentity/shallow resultを返したら拒否する", () => {
    type MutableState = {
      nested: {
        values: string[]
      }
    }
    const ownership = WizWorldStateOwnership.define<MutableState>({
      ownState: (state) => state,
    })
    const shallowOwnership = WizWorldStateOwnership.define<MutableState>({
      ownState: (state) => Object.freeze({ nested: state.nested }),
    })
    const input: MutableState = { nested: { values: ["mutable"] } }

    expect(() => ownership.own(input)).toThrowError(
      expect.objectContaining({
        path: "$",
        valueType: "Object",
      }),
    )
    expect(() => WizWorld.create(input, WizWorldEnvironment.create(), ownership)).toThrowError(
      WizWorldValueOwnershipError,
    )
    expect(() => shallowOwnership.own(input)).toThrowError(
      expect.objectContaining({
        path: "$.nested",
        valueType: "Object",
      }),
    )
  })

  it("独自ownership callbackにもrawまたはdeep readonly stateを型安全に渡す", () => {
    type CustomOwnedState = {
      nested: {
        values: string[]
      }
    }
    const ownership = WizWorldStateOwnership.define<CustomOwnedState>({
      ownState: (state) => {
        const verifyReadonlyOwnedInput = () => {
          // @ts-expect-error 再ownership時はdeep readonly stateも入力される
          state.nested.values.push("mutated")
        }
        void verifyReadonlyOwnedInput
        return Object.freeze({
          nested: Object.freeze({
            values: Object.freeze([...state.nested.values]),
          }),
        })
      },
    })
    const first = ownership.own({ nested: { values: ["first"] } })
    const second = ownership.own(first)

    expect(second).toEqual({ nested: { values: ["first"] } })
    expect(Object.isFrozen(second.nested.values)).toBe(true)
  })

  it("dispatch resultを単独生成してもstateを所有する", () => {
    const input = { values: [1] }
    const result = WizWorldDispatchResult.accepted<typeof input, never>(input)
    const verifyReadonlyResult = () => {
      // @ts-expect-error dispatch result stateはdeep readonly
      result.state.values.push(3)
    }

    void verifyReadonlyResult
    input.values.push(2)

    expect(result.state).toEqual({ values: [1] })
    expect(result.state).not.toBe(input)
    expect(Object.isFrozen(result.state)).toBe(true)
    expect(Object.isFrozen(result.state.values)).toBe(true)
  })

  it("rule rejectionをunhandled actionと区別して返す", () => {
    const input = { count: 1 }

    const result = WizWorldDispatchResult.rejectedByRule<typeof input, never, "LIMIT_REACHED">(
      input,
      { type: "INCREMENT" },
      "LIMIT_REACHED",
    )

    expect(result).toMatchObject({
      accepted: false,
      error: {
        actionType: "INCREMENT",
        code: "ACTION_REJECTED",
        reason: "LIMIT_REACHED",
      },
      state: { count: 1 },
    })
    expect(Object.isFrozen(result.error)).toBe(true)
  })

  it("module ruleが明示した拒否理由を原子的に返す", () => {
    const limitedModule = WizWorldModule.define<
      CounterState,
      CounterAction,
      never,
      "COUNT_LIMIT_REACHED"
    >({
      accepts: (action): action is CounterAction =>
        typeof action === "object" &&
        action !== null &&
        "type" in action &&
        action.type === "INCREMENT",
      name: "limited-counter",
      reduce: (state, action) =>
        state.count + action.amount > 3
          ? { accepted: false, reason: "COUNT_LIMIT_REACHED" }
          : { accepted: true, state: { count: state.count + action.amount } },
    })
    const world = WizWorld.create<CounterState>({ count: 2 }).with(limitedModule)

    const result = world.dispatch(world.initialState, {
      type: "INCREMENT",
      amount: 2,
    })

    expect(result.isRejected()).toBe(true)
    if (result.isRejected()) {
      expect(result.error).toEqual({
        actionType: "INCREMENT",
        code: "ACTION_REJECTED",
        reason: "COUNT_LIMIT_REACHED",
      })
    }
    expect(result.state).toBe(world.initialState)
  })

  it("stateを変えない正当なruleは暗黙に拒否しない", () => {
    const observeModule = WizWorldModule.define<
      CounterState,
      Readonly<{ type: "OBSERVE" }>,
      Readonly<{ type: "OBSERVED" }>
    >({
      accepts: (action): action is Readonly<{ type: "OBSERVE" }> =>
        typeof action === "object" &&
        action !== null &&
        "type" in action &&
        action.type === "OBSERVE",
      name: "observer",
      reduce: (state) => ({
        accepted: true,
        events: [{ type: "OBSERVED" }],
        state,
      }),
    })
    const world = WizWorld.create<CounterState>({ count: 2 }).with(observeModule)

    const result = world.dispatch(world.initialState, { type: "OBSERVE" })

    expect(result.isAccepted()).toBe(true)
    expect(result.events).toEqual([{ type: "OBSERVED" }])
  })

  it("actionとeventもworld境界で再帰copyして所有する", () => {
    type BoundaryState = Readonly<{ count: number }>
    type BoundaryAction = Readonly<{
      type: "RECORD"
      payload: { values: number[] }
    }>
    type BoundaryEvent = Readonly<{
      type: "RECORDED"
      payload: { values: number[] }
    }>

    let observedAction: WizDeepReadonly<BoundaryAction> | undefined
    let returnedEvent: BoundaryEvent | undefined
    const module = WizWorldModule.define<BoundaryState, BoundaryAction, BoundaryEvent>({
      accepts: (action): action is BoundaryAction =>
        typeof action === "object" &&
        action !== null &&
        "type" in action &&
        action.type === "RECORD",
      name: "boundary-owner",
      reduce: (state, action) => {
        const verifyReadonlyRuleInputs = () => {
          // @ts-expect-error rule stateはdeep readonly
          state.count = 99
          // @ts-expect-error rule actionはdeep readonly
          action.payload.values.push(99)
        }
        expectTypeOf(verifyReadonlyRuleInputs).toBeFunction()
        observedAction = action
        returnedEvent = {
          type: "RECORDED",
          payload: { values: [...action.payload.values] },
        }
        return {
          accepted: true,
          events: [returnedEvent],
          state: { count: state.count + 1 },
        }
      },
    })
    const world = WizWorld.create<BoundaryState>({ count: 0 }).with(module)
    const externalAction: BoundaryAction = {
      type: "RECORD",
      payload: { values: [1] },
    }

    const result = world.dispatch(world.initialState, externalAction)
    const verifyReadonlyEvents = () => {
      // @ts-expect-error dispatch event entryもdeep readonly
      result.events[0].payload.values.push(4)
    }

    void verifyReadonlyEvents
    externalAction.payload.values.push(2)
    returnedEvent?.payload.values.push(3)

    expect(observedAction).not.toBe(externalAction)
    expect(Object.isFrozen(observedAction)).toBe(true)
    expect(Object.isFrozen(observedAction?.payload)).toBe(true)
    expect(Object.isFrozen(observedAction?.payload.values)).toBe(true)
    expect(result.events).toEqual([
      {
        type: "RECORDED",
        payload: { values: [1] },
      },
    ])
    expect(result.events[0]).not.toBe(returnedEvent)
    expect(Object.isFrozen(result.events)).toBe(true)
    expect(Object.isFrozen(result.events[0])).toBe(true)
    expect(Object.isFrozen(result.events[0]?.payload.values)).toBe(true)
  })

  it("dispatchUnknownがschema diagnosticsのmoduleとpathを所有して保持する", () => {
    const issue: {
      message: string
      path: (
        | string
        | {
            key: string
          }
      )[]
    } = {
      message: "amount must be a number",
      path: [{ key: "payload" }, "amount"],
    }
    const schema: WizStandardSchemaDefinition<
      Readonly<{
        type: "VALIDATE_PAYLOAD"
        payload: Readonly<{ amount: number }>
      }>
    > = Object.freeze({
      "~standard": Object.freeze({
        validate: () => ({ issues: [issue] }),
        vendor: "open-wiz-test",
        version: 1,
      }),
    })
    const module = WizWorldModule.fromSchema({
      name: "payload-validator",
      reduce: (state: CounterState) => ({ accepted: true, state }),
      schema,
    })
    const world = WizWorld.create<CounterState>({ count: 1 }).with(module)
    const untrustedAction: unknown = {
      payload: { amount: "invalid" },
      type: "VALIDATE_PAYLOAD",
    }

    const invalid = world.dispatchUnknown(world.initialState, untrustedAction)

    issue.message = "changed"
    issue.path.push("changed")
    expect(invalid.error).toEqual({
      actionType: "VALIDATE_PAYLOAD",
      code: "ACTION_VALIDATION_FAILED",
      diagnostics: [
        {
          kind: "schema",
          issues: [
            {
              message: "amount must be a number",
              path: [{ key: "payload" }, "amount"],
            },
          ],
          moduleName: "payload-validator",
        },
      ],
    })
    expect(Object.isFrozen(invalid.error)).toBe(true)
    if (invalid.error?.code === "ACTION_VALIDATION_FAILED") {
      expect(Object.isFrozen(invalid.error.diagnostics)).toBe(true)
      const diagnostic = invalid.error.diagnostics[0]
      if (diagnostic?.kind === "schema") {
        expect(Object.isFrozen(diagnostic.issues)).toBe(true)
        expect(Object.isFrozen(diagnostic.issues[0]?.path)).toBe(true)
      }
    }

    const unrelated = world.dispatchUnknown(world.initialState, { type: "UNRELATED" })

    expect(unrelated.error?.code).toBe("ACTION_VALIDATION_FAILED")
  })

  it("semantic rejection reasonのliteral unionをdispatch resultまで維持する", () => {
    type StopReason = "COUNT_LIMIT_REACHED" | "COUNTER_LOCKED"
    const module = WizWorldModule.define<CounterState, CounterAction, never, StopReason>({
      accepts: counterModule.accepts,
      name: "typed-reason",
      reduce: () => ({ accepted: false, reason: "COUNTER_LOCKED" }),
    })
    const world = WizWorld.create<CounterState>({ count: 1 }).with(module)

    const result = world.dispatch(world.initialState, { amount: 1, type: "INCREMENT" })

    expectTypeOf(result).toEqualTypeOf<WizWorldDispatchResult<CounterState, never, StopReason>>()
    if (result.error?.code === "ACTION_REJECTED") {
      expectTypeOf(result.error.reason).toEqualTypeOf<StopReason>()
    }
    expect(result.error).toEqual({
      actionType: "INCREMENT",
      code: "ACTION_REJECTED",
      reason: "COUNTER_LOCKED",
    })
  })

  it("一つのcommand eventへ複数systemが登録順で原子的に反応する", () => {
    type DailyState = Readonly<{
      buffs: number
      commandCount: number
      hunger: number
      quests: number
      time: number
    }>
    type AdvanceDay = Readonly<{ type: "ADVANCE_DAY" }>
    type DayAdvanced = Readonly<{ type: "DAY_ADVANCED"; days: number }>
    type TimeChanged = Readonly<{ type: "TIME_CHANGED"; current: number }>

    const command = WizWorldModule.define<DailyState, AdvanceDay, DayAdvanced>({
      accepts: (action): action is AdvanceDay =>
        typeof action === "object" &&
        action !== null &&
        "type" in action &&
        action.type === "ADVANCE_DAY",
      name: "calendar-command",
      reduce: (state) => ({
        accepted: true,
        events: [{ days: 1, type: "DAY_ADVANCED" }],
        state: { ...state, commandCount: state.commandCount + 1 },
      }),
    })
    const time = WizWorldEventReaction.define<DailyState, DayAdvanced, TimeChanged>({
      accepts: (event): event is DayAdvanced =>
        typeof event === "object" &&
        event !== null &&
        "type" in event &&
        event.type === "DAY_ADVANCED",
      name: "time",
      react: (state, event) => {
        const current = state.time + event.days

        return {
          accepted: true,
          events: [{ current, type: "TIME_CHANGED" }],
          state: { ...state, time: current },
        }
      },
    })
    const hunger = WizWorldEventReaction.define<DailyState, DayAdvanced>({
      accepts: time.accepts,
      name: "hunger",
      react: (state, event) => ({
        accepted: true,
        state: { ...state, hunger: state.hunger + event.days * 2 },
      }),
    })
    const buffs = WizWorldEventReaction.define<DailyState, DayAdvanced>({
      accepts: time.accepts,
      name: "buffs",
      react: (state, event) => ({
        accepted: true,
        state: { ...state, buffs: state.buffs - event.days },
      }),
    })
    const quests = WizWorldEventReaction.define<DailyState, TimeChanged>({
      accepts: (event): event is TimeChanged =>
        typeof event === "object" &&
        event !== null &&
        "type" in event &&
        event.type === "TIME_CHANGED",
      name: "quests",
      react: (state, event) => ({
        accepted: true,
        state: { ...state, quests: state.quests + event.current },
      }),
    })
    const world = WizWorld.create<DailyState>({
      buffs: 5,
      commandCount: 0,
      hunger: 0,
      quests: 0,
      time: 0,
    })
      .with(command)
      .withReaction(time)
      .withReaction(hunger)
      .withReaction(buffs)
      .withReaction(quests)

    const result = world.dispatch(world.initialState, { type: "ADVANCE_DAY" })

    expect(result.state).toEqual({
      buffs: 4,
      commandCount: 1,
      hunger: 2,
      quests: 1,
      time: 1,
    })
    expect(result.events).toEqual([
      { days: 1, type: "DAY_ADVANCED" },
      { current: 1, type: "TIME_CHANGED" },
    ])
  })

  it("reaction rejectionでcommandと先行reactionをまとめてrollbackする", () => {
    type State = Readonly<{ value: number }>
    type Command = Readonly<{ type: "START" }>
    type Started = Readonly<{ type: "STARTED" }>
    type Rejection = "REACTION_BLOCKED"
    const command = WizWorldModule.define<State, Command, Started>({
      accepts: (action): action is Command =>
        typeof action === "object" &&
        action !== null &&
        "type" in action &&
        action.type === "START",
      name: "start",
      reduce: (state) => ({
        accepted: true,
        events: [{ type: "STARTED" }],
        state: { value: state.value + 1 },
      }),
    })
    const first = WizWorldEventReaction.define<State, Started>({
      accepts: (event): event is Started =>
        typeof event === "object" && event !== null && "type" in event && event.type === "STARTED",
      name: "first",
      react: (state) => ({ accepted: true, state: { value: state.value + 10 } }),
    })
    const rejecting = WizWorldEventReaction.define<State, Started, never, Rejection>({
      accepts: first.accepts,
      name: "rejecting",
      react: () => ({ accepted: false, reason: "REACTION_BLOCKED" }),
    })
    const world = WizWorld.create<State>({ value: 0 })
      .with(command)
      .withReaction(first)
      .withReaction(rejecting)

    const result = world.dispatch(world.initialState, { type: "START" })

    expectTypeOf(result).toEqualTypeOf<WizWorldDispatchResult<State, Started, Rejection>>()
    expect(result.state).toBe(world.initialState)
    expect(result.events).toEqual([])
    expect(result.error).toEqual({
      code: "REACTION_REJECTED",
      eventType: "STARTED",
      reactionName: "rejecting",
      reason: "REACTION_BLOCKED",
    })
  })

  it("event reaction callbackの不正なresult shapeを成功扱いしない", () => {
    type Started = Readonly<{ type: "STARTED" }>

    const module = WizWorldModule.define<CounterState, CounterAction, Started>({
      accepts: (action): action is CounterAction =>
        typeof action === "object" &&
        action !== null &&
        "type" in action &&
        action.type === "INCREMENT",
      name: "reaction-result-source",
      reduce: (state) => ({
        accepted: true,
        events: [{ type: "STARTED" }],
        state,
      }),
    })
    const reaction = WizWorldEventReaction.define<CounterState, Started>({
      accepts: (event): event is Started =>
        typeof event === "object" && event !== null && "type" in event && event.type === "STARTED",
      name: "invalid-result",
      react: () => ({ accepted: true, events: "not-an-array", state: { count: 1 } }) as never,
    })
    const world = WizWorld.create<CounterState>({ count: 0 }).with(module).withReaction(reaction)

    expect(() => world.dispatch(world.initialState, { amount: 1, type: "INCREMENT" })).toThrow(
      'World event reaction "invalid-result" accepted result events must be an array',
    )
  })

  it("reaction rollbackでID・乱数・時刻の観測順も復元する", () => {
    type State = Readonly<{ attempts: number }>
    type Command = Readonly<{ type: "TRY" }>
    type Started = Readonly<{ type: "TRY_STARTED" }>
    const observed: Array<readonly [string, number, number]> = []
    const ids = ["id-1", "id-2"]
    const randomValues = [0.25, 0.75]
    const times = [100, 200]
    let idIndex = 0
    let randomIndex = 0
    let timeIndex = 0
    const environment = WizWorldEnvironment.create({
      nextId: () => ids[idIndex++] ?? "id-overflow",
      now: () => times[timeIndex++] ?? 300,
      random: () => randomValues[randomIndex++] ?? 0.5,
    })
    const command = WizWorldModule.define<State, Command, Started>({
      accepts: (action): action is Command =>
        typeof action === "object" && action !== null && "type" in action && action.type === "TRY",
      name: "try",
      reduce: (state) => ({
        accepted: true,
        events: [{ type: "TRY_STARTED" }],
        state,
      }),
    })
    const sampling = WizWorldEventReaction.define<State, Started>({
      accepts: (event): event is Started =>
        typeof event === "object" &&
        event !== null &&
        "type" in event &&
        event.type === "TRY_STARTED",
      name: "sampling",
      react: (state, _event, source) => {
        observed.push([source.nextId(), source.random(), source.now()])
        return {
          accepted: true,
          state: { attempts: state.attempts + 1 },
        }
      },
    })
    const rejecting = WizWorldEventReaction.define<State, Started, never, "BLOCKED">({
      accepts: sampling.accepts,
      name: "rejecting",
      react: () => ({ accepted: false, reason: "BLOCKED" }),
    })
    const rejectedWorld = WizWorld.create<State>({ attempts: 0 }, environment)
      .with(command)
      .withReaction(sampling)
      .withReaction(rejecting)

    rejectedWorld.dispatch(rejectedWorld.initialState, { type: "TRY" })
    rejectedWorld.dispatch(rejectedWorld.initialState, { type: "TRY" })

    expect(observed).toEqual([
      ["id-1", 0.25, 100],
      ["id-1", 0.25, 100],
    ])
    expect([idIndex, randomIndex, timeIndex]).toEqual([1, 1, 1])

    const acceptedWorld = WizWorld.create<State>({ attempts: 0 }, environment)
      .with(command)
      .withReaction(sampling)
    const accepted = acceptedWorld.dispatch(acceptedWorld.initialState, { type: "TRY" })

    expect(accepted.state.attempts).toBe(1)
    expect(observed.at(-1)).toEqual(["id-1", 0.25, 100])
    expect(environment.nextId()).toBe("id-2")
    expect(environment.random()).toBe(0.75)
    expect(environment.now()).toBe(200)
  })

  it("同種eventの有限cascadeを許可し、runaway cascadeは上限でrollbackする", () => {
    type State = Readonly<{ ticks: number }>
    type Start = Readonly<{ type: "START_COUNTDOWN"; remaining: number }>
    type Countdown = Readonly<{ type: "COUNTDOWN"; remaining: number }>
    const command = WizWorldModule.define<State, Start, Countdown>({
      accepts: (action): action is Start =>
        typeof action === "object" &&
        action !== null &&
        "type" in action &&
        action.type === "START_COUNTDOWN",
      name: "countdown-command",
      reduce: (state, action) => ({
        accepted: true,
        events: [{ remaining: action.remaining, type: "COUNTDOWN" }],
        state,
      }),
    })
    const finite = WizWorldEventReaction.define<State, Countdown, Countdown>({
      accepts: (event): event is Countdown =>
        typeof event === "object" &&
        event !== null &&
        "type" in event &&
        event.type === "COUNTDOWN",
      name: "finite-countdown",
      react: (state, event) => ({
        accepted: true,
        events: event.remaining > 0 ? [{ remaining: event.remaining - 1, type: "COUNTDOWN" }] : [],
        state: { ticks: state.ticks + 1 },
      }),
    })
    const finiteWorld = WizWorld.create<State>({ ticks: 0 })
      .with(command)
      .withReaction(finite)
      .withReactionPolicy(WizWorldReactionPolicy.create({ maximumReactionSteps: 8 }))

    const completed = finiteWorld.dispatch(finiteWorld.initialState, {
      remaining: 3,
      type: "START_COUNTDOWN",
    })

    expect(completed.state.ticks).toBe(4)
    expect(completed.events).toEqual([
      { remaining: 3, type: "COUNTDOWN" },
      { remaining: 2, type: "COUNTDOWN" },
      { remaining: 1, type: "COUNTDOWN" },
      { remaining: 0, type: "COUNTDOWN" },
    ])

    const runaway = WizWorldEventReaction.define<State, Countdown, Countdown>({
      accepts: finite.accepts,
      name: "runaway",
      react: (state, event) => ({
        accepted: true,
        events: [{ remaining: event.remaining + 1, type: "COUNTDOWN" }],
        state: { ticks: state.ticks + 1 },
      }),
    })
    const runawayWorld = WizWorld.create<State>({ ticks: 0 })
      .with(command)
      .withReaction(runaway)
      .withReactionPolicy(WizWorldReactionPolicy.create({ maximumReactionSteps: 3 }))

    const limited = runawayWorld.dispatch(runawayWorld.initialState, {
      remaining: 0,
      type: "START_COUNTDOWN",
    })

    expect(limited.state).toBe(runawayWorld.initialState)
    expect(limited.events).toEqual([])
    expect(limited.error).toEqual({
      code: "REACTION_LIMIT_EXCEEDED",
      eventType: "COUNTDOWN",
      maximumReactionSteps: 3,
      reactionNames: ["runaway", "runaway", "runaway", "runaway"],
    })
  })

  it("reaction出力state/eventを次のsystemへ渡す前に所有する", () => {
    type State = Readonly<{ values: readonly number[] }>
    type Start = Readonly<{ type: "START_OWNERSHIP" }>
    type Started = Readonly<{ type: "OWNERSHIP_STARTED" }>
    type Continued = Readonly<{ payload: { values: number[] }; type: "OWNERSHIP_CONTINUED" }>
    const command = WizWorldModule.define<State, Start, Started>({
      accepts: (action): action is Start =>
        typeof action === "object" &&
        action !== null &&
        "type" in action &&
        action.type === "START_OWNERSHIP",
      name: "ownership-command",
      reduce: (state) => ({
        accepted: true,
        events: [{ type: "OWNERSHIP_STARTED" }],
        state,
      }),
    })
    const returnedState = { values: [1] }
    const returnedEvent: Continued = {
      payload: { values: [2] },
      type: "OWNERSHIP_CONTINUED",
    }
    const producer = WizWorldEventReaction.define<State, Started, Continued>({
      accepts: (event): event is Started =>
        typeof event === "object" &&
        event !== null &&
        "type" in event &&
        event.type === "OWNERSHIP_STARTED",
      name: "ownership-producer",
      react: () => ({
        accepted: true,
        events: [returnedEvent],
        state: returnedState,
      }),
    })
    const consumer = WizWorldEventReaction.define<State, Continued>({
      accepts: (event): event is Continued =>
        typeof event === "object" &&
        event !== null &&
        "type" in event &&
        event.type === "OWNERSHIP_CONTINUED",
      name: "ownership-consumer",
      react: (state, event) => {
        expect(Object.isFrozen(state)).toBe(true)
        expect(Object.isFrozen(state.values)).toBe(true)
        expect(Object.isFrozen(event)).toBe(true)
        expect(Object.isFrozen(event.payload.values)).toBe(true)

        return { accepted: true, state }
      },
    })
    const world = WizWorld.create<State>({ values: [] })
      .with(command)
      .withReaction(producer)
      .withReaction(consumer)

    const result = world.dispatch(world.initialState, { type: "START_OWNERSHIP" })

    returnedState.values.push(3)
    returnedEvent.payload.values.push(4)
    expect(result.state.values).toEqual([1])
    expect(result.events[1]).toEqual({
      payload: { values: [2] },
      type: "OWNERSHIP_CONTINUED",
    })
    expect(result.state).not.toBe(returnedState)
    expect(result.events[1]).not.toBe(returnedEvent)
  })

  it("reaction guardをfreeze済みwrapperとして捕捉し外部functionを公開しない", () => {
    type Observed = Readonly<{ type: "OBSERVED" }>
    const externalGuard = Object.assign(
      (event: unknown): event is Observed =>
        typeof event === "object" && event !== null && "type" in event && event.type === "OBSERVED",
      { label: "external" },
    )
    const definition: {
      accepts: (event: unknown) => event is Observed
      name: string
      react: WizWorldRule<CounterState, Observed, never, never>
    } = {
      accepts: externalGuard,
      name: "captured-guard",
      react: (state) => ({ accepted: true, state }),
    }
    const reaction = WizWorldEventReaction.define(definition)

    externalGuard.label = "mutated"
    definition.accepts = (_event: unknown): _event is Observed => false

    expect(reaction.accepts({ type: "OBSERVED" })).toBe(true)
    expect(Object.isFrozen(reaction.accepts)).toBe(true)
    expect(Object.hasOwn(reaction.accepts, "label")).toBe(false)
  })

  it("reaction名とpolicyの不正構成を明示的に拒否する", () => {
    type Observed = Readonly<{ type: "OBSERVED" }>
    const reaction = WizWorldEventReaction.define<CounterState, Observed>({
      accepts: (event): event is Observed =>
        typeof event === "object" && event !== null && "type" in event && event.type === "OBSERVED",
      name: "observer",
      react: (state) => ({ accepted: true, state }),
    })
    const world = WizWorld.create<CounterState>({ count: 0 }).with(
      WizWorldModule.define<CounterState, Readonly<{ type: "OBSERVE" }>, Observed>({
        accepts: (action): action is Readonly<{ type: "OBSERVE" }> =>
          typeof action === "object" &&
          action !== null &&
          "type" in action &&
          action.type === "OBSERVE",
        name: "observe",
        reduce: (state) => ({
          accepted: true,
          events: [{ type: "OBSERVED" }],
          state,
        }),
      }),
    )

    expect(() => world.withReaction(reaction).withReaction(reaction)).toThrowError(
      expect.objectContaining({
        code: "DUPLICATE_REACTION_NAME",
        componentName: "observer",
      }),
    )
    expect(() => WizWorldReactionPolicy.create({ maximumReactionSteps: 0 })).toThrow(RangeError)
    expect(() =>
      WizWorldEventReaction.define<CounterState, Observed>({
        accepts: reaction.accepts,
        name: " observer ",
        react: (state) => ({ accepted: true, state }),
      }),
    ).toThrow(RangeError)
  })
})
