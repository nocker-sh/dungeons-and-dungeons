import { describe, expect, expectTypeOf, it } from "vite-plus/test"
import { WIZ_IMMUTABLE_VALUE, WizImmutableValue } from "@/lib/wiz/core/immutable-value"
import type { WizStandardSchemaDefinition } from "@/lib/wiz/core/standard-schema"
import { WizWorld, type WizWorldModule } from "@/lib/wiz/core/world/world"
import { WizWorldRules } from "@/lib/wiz/core/world/world-rules"

class ProgressState {
  declare readonly [WIZ_IMMUTABLE_VALUE]: true

  constructor(
    readonly experience: number,
    readonly isLocked: boolean,
  ) {
    WizImmutableValue.freeze(this)
  }

  withExperience(experience: number): ProgressState {
    return new ProgressState(experience, this.isLocked)
  }
}

class OtherState {
  declare readonly [WIZ_IMMUTABLE_VALUE]: true

  constructor(readonly label: string) {
    WizImmutableValue.freeze(this)
  }
}

type GainExperienceAction = Readonly<{
  type: "GAIN_EXPERIENCE"
  amount: number
}>

type ExperienceGainedEvent = Readonly<{
  type: "EXPERIENCE_GAINED"
  amount: number
}>

type ExperienceSetEvent = Readonly<{
  type: "EXPERIENCE_SET"
  amount: number
}>

type LevelChangedEvent = Readonly<{
  type: "LEVEL_CHANGED"
  experience: number
}>

const isGainExperienceAction = (action: unknown): action is GainExperienceAction =>
  typeof action === "object" &&
  action !== null &&
  "type" in action &&
  action.type === "GAIN_EXPERIENCE" &&
  "amount" in action &&
  typeof action.amount === "number"

const isExperienceGainedEvent = (event: unknown): event is ExperienceGainedEvent =>
  typeof event === "object" &&
  event !== null &&
  "type" in event &&
  event.type === "EXPERIENCE_GAINED" &&
  "amount" in event &&
  typeof event.amount === "number"

type RawSetExperienceAction = Readonly<{
  type: "SET_EXPERIENCE"
  amount: string
}>

type ParsedSetExperienceAction = Readonly<{
  type: "SET_EXPERIENCE"
  amount: number
}>

const setExperienceSchema: WizStandardSchemaDefinition<
  RawSetExperienceAction,
  ParsedSetExperienceAction
> = Object.freeze({
  "~standard": Object.freeze({
    validate: (input: unknown) => {
      if (
        typeof input !== "object" ||
        input === null ||
        !("type" in input) ||
        input.type !== "SET_EXPERIENCE" ||
        !("amount" in input) ||
        typeof input.amount !== "string"
      ) {
        return {
          issues: [{ message: "Invalid experience", path: ["amount"] }],
        }
      }
      const parsedAction: ParsedSetExperienceAction = {
        type: "SET_EXPERIENCE",
        amount: Number(input.amount),
      }

      return { value: parsedAction }
    },
    vendor: "world-rules-test",
    version: 1,
  }),
})

describe("WizWorldRules", () => {
  it("private tokenで構築するstate-bound immutable classにする", () => {
    const rules = WizWorldRules.forState<ProgressState>()

    expectTypeOf(rules).toEqualTypeOf<WizWorldRules<ProgressState>>()
    expect(Object.isFrozen(rules)).toBe(true)
    expect(() => Reflect.construct(WizWorldRules, [Symbol("forged")])).toThrow(TypeError)
  })

  it("guard moduleのaction・event・stable reasonをreducerから推論する", () => {
    const rules = WizWorldRules.forState<ProgressState>()
    const module = rules.module({
      name: "gain-experience",
      accepts: isGainExperienceAction,
      reduce: (state, action) => {
        const amount: number = action.amount
        void amount

        const verifyBoundTypes = () => {
          // @ts-expect-error stateはforStateで束縛したclass state。
          const invalidLabel = state.label
          // @ts-expect-error guardで推論したaction amountはnumber。
          const invalidAmount: string = action.amount
          void invalidLabel
          void invalidAmount
        }
        void verifyBoundTypes

        if (state.isLocked) {
          return {
            accepted: false,
            reason: "PROGRESS_LOCKED",
          }
        }

        return {
          accepted: true,
          events: [{ type: "EXPERIENCE_GAINED", amount: action.amount }],
          state: state.withExperience(state.experience + action.amount),
        }
      },
    })
    const typedModule: WizWorldModule<
      ProgressState,
      GainExperienceAction,
      ExperienceGainedEvent,
      "PROGRESS_LOCKED"
    > = module
    const world = WizWorld.create(new ProgressState(1, false)).with(module)
    const accepted = world.dispatch(world.initialState, {
      type: "GAIN_EXPERIENCE",
      amount: 2,
    })
    const lockedWorld = WizWorld.create(new ProgressState(1, true)).with(module)
    const rejected = lockedWorld.dispatch(lockedWorld.initialState, {
      type: "GAIN_EXPERIENCE",
      amount: 2,
    })

    void typedModule
    expect(accepted.state.experience).toBe(3)
    expect(accepted.events).toEqual([{ type: "EXPERIENCE_GAINED", amount: 2 }])
    expect(rejected.error).toMatchObject({
      code: "ACTION_REJECTED",
      reason: "PROGRESS_LOCKED",
    })

    const wrongWorld = WizWorld.create(new OtherState("other"))
    const verifyWrongComposition = () => {
      // @ts-expect-error state-bound moduleは別stateのworldへ合成できない。
      wrongWorld.with(module)
      // @ts-expect-error guard actionのamountはnumber。
      world.dispatch(world.initialState, { type: "GAIN_EXPERIENCE", amount: "2" })
    }
    void verifyWrongComposition
  })

  it("Standard Schema input/outputとevent/reasonを明示genericなしで推論する", () => {
    const rules = WizWorldRules.forState<ProgressState>()
    const module = rules.schema({
      name: "set-experience",
      schema: setExperienceSchema,
      reduce: (state, action) => {
        const parsedAmount: number = action.amount
        void parsedAmount

        const verifyOutput = () => {
          // @ts-expect-error reducerにはschema outputのnumberが渡る。
          const rawAmount: string = action.amount
          void rawAmount
        }
        void verifyOutput

        if (action.amount < 0) {
          return {
            accepted: false,
            reason: "NEGATIVE_EXPERIENCE",
          }
        }

        return {
          accepted: true,
          events: [{ type: "EXPERIENCE_SET", amount: action.amount }],
          state: state.withExperience(action.amount),
        }
      },
    })
    const typedModule: WizWorldModule<
      ProgressState,
      RawSetExperienceAction,
      ExperienceSetEvent,
      "NEGATIVE_EXPERIENCE"
    > = module
    const world = WizWorld.create(new ProgressState(1, false)).with(module)
    const accepted = world.dispatch(world.initialState, {
      type: "SET_EXPERIENCE",
      amount: "4",
    })

    void typedModule
    expect(accepted.state.experience).toBe(4)
    expect(accepted.events).toEqual([{ type: "EXPERIENCE_SET", amount: 4 }])

    const verifySchemaInput = () => {
      // @ts-expect-error dispatchはschema outputでなくinputのstringを受け取る。
      world.dispatch(world.initialState, { type: "SET_EXPERIENCE", amount: 4 })
    }
    void verifySchemaInput
  })

  it("event guard reactionのemitted event/reasonを推論しworld unionへ合成する", () => {
    const rules = WizWorldRules.forState<ProgressState>()
    const module = rules.module({
      name: "gain-experience",
      accepts: isGainExperienceAction,
      reduce: (state, action) => ({
        accepted: true,
        events: [{ type: "EXPERIENCE_GAINED", amount: action.amount }],
        state: state.withExperience(state.experience + action.amount),
      }),
    })
    const reaction = rules.reaction({
      name: "level-change",
      accepts: isExperienceGainedEvent,
      react: (state, event) => {
        if (event.amount > 5) {
          return {
            accepted: false,
            reason: "REACTION_LIMIT",
          }
        }

        return {
          accepted: true,
          events: [{ type: "LEVEL_CHANGED", experience: state.experience }],
          state,
        }
      },
    })
    const world = WizWorld.create(new ProgressState(1, false)).with(module).withReaction(reaction)
    const typedWorld: WizWorld<
      ProgressState,
      GainExperienceAction,
      ExperienceGainedEvent | LevelChangedEvent,
      "REACTION_LIMIT"
    > = world
    const accepted = world.dispatch(world.initialState, {
      type: "GAIN_EXPERIENCE",
      amount: 2,
    })
    const rejected = world.dispatch(world.initialState, {
      type: "GAIN_EXPERIENCE",
      amount: 6,
    })

    void typedWorld
    expect(accepted.events).toEqual([
      { type: "EXPERIENCE_GAINED", amount: 2 },
      { type: "LEVEL_CHANGED", experience: 3 },
    ])
    expect(rejected.state.experience).toBe(1)
    expect(rejected.error).toMatchObject({
      code: "REACTION_REJECTED",
      reason: "REACTION_LIMIT",
    })
  })
})
