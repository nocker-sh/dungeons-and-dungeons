import { z } from "zod"
import { describe, expect, expectTypeOf, it } from "vite-plus/test"
import {
  WIZ_IMMUTABLE_VALUE,
  WizImmutableValue,
} from "@/lib/wiz/core/immutable-value"
import type { WizDeepReadonly } from "@/lib/wiz/core/immutable-value"
import {
  WizWorld,
  WizWorldCompositionError,
  WizWorldDispatchResult,
  WizWorldModule,
} from "@/lib/wiz/core/world/world"
import { WizWorldSliceModule } from "@/lib/wiz/core/world/world-slice-module"

type CombatState = Readonly<{
  hp: number
  history: readonly string[]
}>

type InventoryState = Readonly<{
  itemIds: readonly string[]
}>

type RootState = Readonly<{
  combat: CombatState
  inventory: InventoryState
  chapter: number
}>

type DamageAction = Readonly<{
  type: "DAMAGE"
  amount: number
  metadata: Readonly<{ sourceId: string }>
}>

type AddItemAction = Readonly<{
  type: "ADD_ITEM"
  itemId: string
}>

type DamagedEvent = Readonly<{
  type: "DAMAGED"
  amount: number
}>

type ItemAddedEvent = Readonly<{
  type: "ITEM_ADDED"
  itemId: string
}>

const acceptsDamage = (action: unknown): action is DamageAction =>
  typeof action === "object" &&
  action !== null &&
  "type" in action &&
  action.type === "DAMAGE"

const acceptsAddItem = (action: unknown): action is AddItemAction =>
  typeof action === "object" &&
  action !== null &&
  "type" in action &&
  action.type === "ADD_ITEM"

describe("WizWorldSliceModule", () => {
  it("独立したslice ruleを合成し、Action/Event unionを型へ反映する", () => {
    const combatModule = WizWorldSliceModule.define<
      RootState,
      CombatState,
      DamageAction,
      DamagedEvent
    >({
      accepts: acceptsDamage,
      name: "combat",
      reduce: (combat, action) => ({
        accepted: true,
        events: [{ amount: action.amount, type: "DAMAGED" }],
        state: {
          history: [...combat.history, action.metadata.sourceId],
          hp: combat.hp - action.amount,
        },
      }),
      select: (root) => root.combat,
      update: (root, combat) => ({ ...root, combat }),
    })
    const inventoryModule = WizWorldSliceModule.forRoot<RootState>().at(
      "inventory",
      {
        accepts: acceptsAddItem,
        reduce: (inventory, action) => ({
          accepted: true,
          events: [
            {
              itemId: action.itemId,
              type: "ITEM_ADDED",
            } satisfies ItemAddedEvent,
          ],
          state: {
            itemIds: [...inventory.itemIds, action.itemId],
          },
        }),
      }
    )
    type InferredInventoryEvent =
      typeof inventoryModule extends WizWorldSliceModule<
        RootState,
        InventoryState,
        AddItemAction,
        infer TEvent
      >
        ? TEvent
        : never
    const inferredInventoryEvent: InferredInventoryEvent = {
      itemId: "potion",
      type: "ITEM_ADDED",
    }
    const guardedCandidate: unknown = { itemId: "potion", type: "ADD_ITEM" }
    if (inventoryModule.accepts(guardedCandidate)) {
      expectTypeOf(guardedCandidate).toEqualTypeOf<AddItemAction>()
    }
    const world = WizWorld.create<RootState>({
      chapter: 1,
      combat: { history: [], hp: 10 },
      inventory: { itemIds: [] },
    })
      .withSlice(combatModule)
      .withSlice(inventoryModule)

    expectTypeOf<typeof world.dispatch>()
      .parameter(1)
      .toEqualTypeOf<DamageAction | AddItemAction>()
    expectTypeOf(inferredInventoryEvent).toMatchTypeOf<ItemAddedEvent>()

    const damaged = world.dispatch(world.initialState, {
      amount: 3,
      metadata: { sourceId: "slime" },
      type: "DAMAGE",
    })
    const itemAdded = world.dispatch(damaged.state, {
      itemId: "potion",
      type: "ADD_ITEM",
    })

    expect(damaged).toMatchObject({
      accepted: true,
      events: [{ amount: 3, type: "DAMAGED" }],
      state: {
        chapter: 1,
        combat: { history: ["slime"], hp: 7 },
        inventory: { itemIds: [] },
      },
    })
    expect(itemAdded).toMatchObject({
      accepted: true,
      events: [{ itemId: "potion", type: "ITEM_ADDED" }],
      state: {
        chapter: 1,
        combat: { history: ["slime"], hp: 7 },
        inventory: { itemIds: ["potion"] },
      },
    })
    expect(world.initialState).toEqual({
      chapter: 1,
      combat: { history: [], hp: 10 },
      inventory: { itemIds: [] },
    })
  })

  it("fromSchema/atSchemaでinput/outputを推論し、正規化を一度だけslice ruleへ渡す", () => {
    const parseCounts = { combat: 0, inventory: 0 }
    let observedDamage:
      | Readonly<{
          type: "SCHEMA_DAMAGE"
          amount: number
          metadata: Readonly<{ sourceId: string }>
        }>
      | undefined
    let observedItem:
      | Readonly<{
          type: "SCHEMA_ADD_ITEM"
          itemId: string
        }>
      | undefined
    const damageSchema = z
      .strictObject({
        type: z.literal("SCHEMA_DAMAGE"),
        amount: z.coerce.number().default(2),
        metadata: z
          .strictObject({ sourceId: z.string() })
          .default({ sourceId: "schema" }),
      })
      .transform((action) => {
        parseCounts.combat += 1
        return { ...action, amount: action.amount * 2 }
      })
    const itemSchema = z
      .strictObject({
        type: z.literal("SCHEMA_ADD_ITEM"),
        itemId: z.string().default("potion"),
      })
      .transform((action) => {
        parseCounts.inventory += 1
        return action
      })
    const combatModule = WizWorldSliceModule.fromSchema({
      name: "schema-combat",
      schema: damageSchema,
      reduce: (combat: CombatState, action) => {
        expectTypeOf(action).toEqualTypeOf<
          WizDeepReadonly<z.output<typeof damageSchema>>
        >()
        observedDamage = action
        return {
          accepted: true,
          state: {
            history: [...combat.history, action.metadata.sourceId],
            hp: combat.hp - action.amount,
          },
        }
      },
      select: (root: RootState) => root.combat,
      update: (root, combat) => ({ ...root, combat }),
    })
    const inventoryModule = WizWorldSliceModule.forRoot<RootState>().atSchema(
      "inventory",
      {
        schema: itemSchema,
        reduce: (inventory, action) => {
          expectTypeOf(action).toEqualTypeOf<
            WizDeepReadonly<z.output<typeof itemSchema>>
          >()
          observedItem = action
          return {
            accepted: true,
            state: {
              itemIds: [...inventory.itemIds, action.itemId],
            },
          }
        },
      }
    )
    expectTypeOf(combatModule.accepts).returns.toEqualTypeOf<boolean>()
    expectTypeOf(inventoryModule.accepts).returns.toEqualTypeOf<boolean>()
    const world = WizWorld.create<RootState>({
      chapter: 1,
      combat: { history: [], hp: 10 },
      inventory: { itemIds: [] },
    })
      .withSlice(combatModule)
      .withSlice(inventoryModule)
    expectTypeOf<typeof world.dispatch>()
      .parameter(1)
      .toEqualTypeOf<
        | WizDeepReadonly<z.input<typeof damageSchema>>
        | WizDeepReadonly<z.input<typeof itemSchema>>
      >()

    const damaged = world.dispatch(world.initialState, {
      type: "SCHEMA_DAMAGE",
      amount: "2",
    })
    const itemAdded = world.dispatch(damaged.state, {
      type: "SCHEMA_ADD_ITEM",
    })

    expect(parseCounts).toEqual({ combat: 1, inventory: 1 })
    expect(damaged.state.combat).toEqual({ history: ["schema"], hp: 6 })
    expect(itemAdded.state.inventory.itemIds).toEqual(["potion"])
    expect(observedDamage).toEqual({
      type: "SCHEMA_DAMAGE",
      amount: 4,
      metadata: { sourceId: "schema" },
    })
    expect(observedItem).toEqual({
      type: "SCHEMA_ADD_ITEM",
      itemId: "potion",
    })
    expect(Object.isFrozen(observedDamage)).toBe(true)
    expect(Object.isFrozen(observedDamage?.metadata)).toBe(true)
    expect(Object.isFrozen(observedItem)).toBe(true)
  })

  it("semantic rejectionをrootの変更なしで伝播する", () => {
    const module = WizWorldSliceModule.define<
      RootState,
      CombatState,
      DamageAction,
      DamagedEvent,
      "COMBAT_HP_EXHAUSTED"
    >({
      accepts: acceptsDamage,
      name: "combat",
      reduce: (combat, action) =>
        action.amount >= combat.hp
          ? { accepted: false, reason: "COMBAT_HP_EXHAUSTED" }
          : {
              accepted: true,
              events: [{ amount: action.amount, type: "DAMAGED" }],
              state: { ...combat, hp: combat.hp - action.amount },
            },
      select: (root) => root.combat,
      update: (root, combat) => ({ ...root, combat }),
    })
    const world = WizWorld.create<RootState>({
      chapter: 1,
      combat: { history: [], hp: 3 },
      inventory: { itemIds: [] },
    }).withSlice(module)
    const result = world.dispatch(world.initialState, {
      amount: 3,
      metadata: { sourceId: "slime" },
      type: "DAMAGE",
    })

    expectTypeOf(result).toEqualTypeOf<
      WizWorldDispatchResult<RootState, DamagedEvent, "COMBAT_HP_EXHAUSTED">
    >()
    expect(result).toMatchObject({
      accepted: false,
      error: {
        actionType: "DAMAGE",
        code: "ACTION_REJECTED",
        reason: "COMBAT_HP_EXHAUSTED",
      },
    })
    expect(result.state).toBe(world.initialState)
    expect(result.events).toEqual([])
  })

  it("root・slice・action・eventの入力aliasをworld境界から隔離する", () => {
    const initialInput = {
      chapter: 1,
      combat: { history: ["start"], hp: 10 },
      inventory: { itemIds: [] },
    }
    let observedSlice: CombatState | undefined
    let returnedSlice: { history: string[]; hp: number } | undefined
    let returnedEvent: { amount: number; type: "DAMAGED" } | undefined
    const module = WizWorldSliceModule.define<
      RootState,
      CombatState,
      DamageAction,
      DamagedEvent
    >({
      accepts: acceptsDamage,
      name: "combat",
      reduce: (combat, action) => {
        observedSlice = combat
        returnedSlice = {
          history: [...combat.history, action.metadata.sourceId],
          hp: combat.hp - action.amount,
        }
        returnedEvent = { amount: action.amount, type: "DAMAGED" }
        return {
          accepted: true,
          events: [returnedEvent],
          state: returnedSlice,
        }
      },
      select: (root) => root.combat,
      update: (root, combat) => ({ ...root, combat }),
    })
    const world = WizWorld.create<RootState>(initialInput).withSlice(module)
    const actionInput = {
      amount: 2,
      metadata: { sourceId: "slime" },
      type: "DAMAGE" as const,
    }
    const result = world.dispatch(world.initialState, actionInput)

    initialInput.combat.history.push("external")
    actionInput.metadata.sourceId = "changed"
    returnedSlice?.history.push("late")
    if (returnedEvent) {
      returnedEvent.amount = 99
    }

    expect(observedSlice).not.toBe(initialInput.combat)
    expect(Object.isFrozen(observedSlice)).toBe(true)
    expect(Object.isFrozen(observedSlice?.history)).toBe(true)
    expect(result.state.combat).toEqual({ history: ["start", "slime"], hp: 8 })
    expect(result.events).toEqual([{ amount: 2, type: "DAMAGED" }])
    expect(Object.isFrozen(result.state)).toBe(true)
    expect(Object.isFrozen(result.state.combat)).toBe(true)
    expect(Object.isFrozen(result.state.combat.history)).toBe(true)
    expect(Object.isFrozen(result.events)).toBe(true)
    expect(Object.isFrozen(result.events[0])).toBe(true)
  })

  it("module名の重複とactionの曖昧性を既存worldの診断へ委譲する", () => {
    const sliceModule = WizWorldSliceModule.define<
      RootState,
      CombatState,
      DamageAction
    >({
      accepts: acceptsDamage,
      name: "combat",
      reduce: (combat) => ({ accepted: true, state: combat }),
      select: (root) => root.combat,
      update: (root, combat) => ({ ...root, combat }),
    })
    const rootModule = WizWorldModule.define<RootState, DamageAction>({
      accepts: acceptsDamage,
      name: "root-combat",
      reduce: (root) => ({ accepted: true, state: root }),
    })
    const duplicateSliceModule = WizWorldSliceModule.define<
      RootState,
      CombatState,
      DamageAction
    >({
      accepts: acceptsDamage,
      name: "combat",
      reduce: (combat) => ({ accepted: true, state: combat }),
      select: (root) => root.combat,
      update: (root, combat) => ({ ...root, combat }),
    })
    const emptyWorld = WizWorld.create<RootState>({
      chapter: 1,
      combat: { history: [], hp: 10 },
      inventory: { itemIds: [] },
    })

    expect(() =>
      emptyWorld.withSlice(sliceModule).withSlice(duplicateSliceModule)
    ).toThrowError(WizWorldCompositionError)

    const ambiguousWorld = emptyWorld.withSlice(sliceModule).with(rootModule)
    const result = ambiguousWorld.dispatch(ambiguousWorld.initialState, {
      amount: 1,
      metadata: { sourceId: "slime" },
      type: "DAMAGE",
    })

    expect(result.error).toEqual({
      actionType: "DAMAGE",
      code: "AMBIGUOUS_ACTION",
      moduleNames: ["combat", "root-combat"],
    })
  })

  it("property builderでclass rootのprototypeを暗黙に破壊しない", () => {
    class ClassRoot {
      declare readonly [WIZ_IMMUTABLE_VALUE]: true
      readonly combat: CombatState

      constructor(combat: CombatState) {
        this.combat = Object.freeze({
          history: Object.freeze([...combat.history]),
          hp: combat.hp,
        })
        WizImmutableValue.freeze(this)
      }

      withCombat(combat: CombatState): ClassRoot {
        return new ClassRoot(combat)
      }
    }

    const propertyModule = WizWorldSliceModule.forRoot<ClassRoot>().at(
      "combat",
      {
        accepts: acceptsDamage,
        reduce: (combat, action) => ({
          accepted: true,
          state: { ...combat, hp: combat.hp - action.amount },
        }),
      }
    )
    const propertyWorld = WizWorld.create(
      new ClassRoot({ history: [], hp: 10 })
    ).withSlice(propertyModule)

    expect(() =>
      propertyWorld.dispatch(propertyWorld.initialState, {
        amount: 1,
        metadata: { sourceId: "slime" },
        type: "DAMAGE",
      })
    ).toThrow(
      "use WizWorldSliceModule.define() with an explicit update function"
    )

    const classModule = WizWorldSliceModule.define<
      ClassRoot,
      CombatState,
      DamageAction
    >({
      accepts: acceptsDamage,
      name: "class-combat",
      reduce: (combat, action) => ({
        accepted: true,
        state: { ...combat, hp: combat.hp - action.amount },
      }),
      select: (root) => root.combat,
      update: (root, combat) => root.withCombat(combat),
    })
    const classWorld = WizWorld.create(
      new ClassRoot({ history: [], hp: 10 })
    ).withSlice(classModule)
    const result = classWorld.dispatch(classWorld.initialState, {
      amount: 2,
      metadata: { sourceId: "slime" },
      type: "DAMAGE",
    })

    expect(result.state).toBeInstanceOf(ClassRoot)
    expect(result.state.combat.hp).toBe(8)
  })

  it("property builderがnull prototypeとsymbol・非enumerable data descriptorを保つ", () => {
    const metadataKey = Symbol("metadata")
    type DescriptorRoot = Readonly<{
      combat: CombatState
      hiddenChapter: number
      [metadataKey]: string
    }>
    const rootInput = Object.create(null) as DescriptorRoot
    Object.defineProperty(rootInput, "combat", {
      configurable: false,
      enumerable: false,
      value: { history: [], hp: 10 },
      writable: false,
    })
    Object.defineProperty(rootInput, "hiddenChapter", {
      configurable: false,
      enumerable: false,
      value: 3,
      writable: false,
    })
    Object.defineProperty(rootInput, metadataKey, {
      configurable: false,
      enumerable: true,
      value: "preserved",
      writable: false,
    })

    const combatModule = WizWorldSliceModule.forRoot<DescriptorRoot>().at(
      "combat",
      {
        accepts: acceptsDamage,
        reduce: (combat, action) => ({
          accepted: true,
          state: {
            history: [...combat.history, action.metadata.sourceId],
            hp: combat.hp - action.amount,
          },
        }),
      }
    )
    const world = WizWorld.create(rootInput).withSlice(combatModule)
    const result = world.dispatch(world.initialState, {
      amount: 2,
      metadata: { sourceId: "slime" },
      type: "DAMAGE",
    })

    expect(result.state).not.toBe(world.initialState)
    expect(Object.getPrototypeOf(result.state)).toBeNull()
    expect(Reflect.ownKeys(result.state)).toEqual([
      "combat",
      "hiddenChapter",
      metadataKey,
    ])
    expect(
      Object.getOwnPropertyDescriptor(result.state, "combat")
    ).toMatchObject({
      configurable: false,
      enumerable: false,
      value: { history: ["slime"], hp: 8 },
      writable: false,
    })
    expect(
      Object.getOwnPropertyDescriptor(result.state, "hiddenChapter")
    ).toEqual({
      configurable: false,
      enumerable: false,
      value: 3,
      writable: false,
    })
    expect(Object.getOwnPropertyDescriptor(result.state, metadataKey)).toEqual({
      configurable: false,
      enumerable: true,
      value: "preserved",
      writable: false,
    })
    expect(world.initialState.combat).toEqual({ history: [], hp: 10 })
  })
})
