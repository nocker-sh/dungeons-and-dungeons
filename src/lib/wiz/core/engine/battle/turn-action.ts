import { z } from "zod"
import type { WizEngineBattleTurnActionType } from "@/lib/wiz/core/engine/battle/types"
import {
  WIZ_IMMUTABLE_VALUE,
  type WizDeepReadonly,
  WizImmutableValue,
} from "@/lib/wiz/core/immutable-value"

const wizEngineBattleTurnActionConstructionToken = Symbol("WizEngineBattleTurnAction.constructor")
const authenticWizEngineBattleTurnActions = new WeakSet<object>()

const zBattleTurnActionId = z
  .string()
  .refine(
    (value) => value.trim().length > 0 && value === value.trim(),
    "must be a non-blank string without surrounding whitespace",
  )

const zBattleTurnActionTargetIds = (minimum: number, maximum?: number) =>
  z
    .array(zBattleTurnActionId)
    .min(minimum)
    .max(maximum ?? Number.MAX_SAFE_INTEGER)
    .superRefine((targetIds, context) => {
      if (new Set(targetIds).size !== targetIds.length) {
        context.addIssue({
          code: "custom",
          message: "must not contain duplicate target IDs",
        })
      }
    })

const zWizEngineBattleTurnAction = z
  .discriminatedUnion("type", [
    z.strictObject({
      id: zBattleTurnActionId,
      type: z.literal("attack"),
      actorId: zBattleTurnActionId,
      targetIds: zBattleTurnActionTargetIds(1),
      abilityId: z.null(),
      itemId: z.null(),
    }),
    z.strictObject({
      id: zBattleTurnActionId,
      type: z.literal("ability"),
      actorId: zBattleTurnActionId,
      targetIds: zBattleTurnActionTargetIds(1),
      abilityId: zBattleTurnActionId,
      itemId: z.null(),
    }),
    z.strictObject({
      id: zBattleTurnActionId,
      type: z.literal("defend"),
      actorId: zBattleTurnActionId,
      targetIds: zBattleTurnActionTargetIds(1, 1),
      abilityId: z.null(),
      itemId: z.null(),
    }),
    z.strictObject({
      id: zBattleTurnActionId,
      type: z.literal("item"),
      actorId: zBattleTurnActionId,
      targetIds: zBattleTurnActionTargetIds(1),
      abilityId: z.null(),
      itemId: zBattleTurnActionId,
    }),
    z.strictObject({
      id: zBattleTurnActionId,
      type: z.literal("flee"),
      actorId: zBattleTurnActionId,
      targetIds: zBattleTurnActionTargetIds(0, 0),
      abilityId: z.null(),
      itemId: z.null(),
    }),
  ])
  .superRefine((properties, context) => {
    if (properties.type === "defend" && properties.targetIds[0] !== properties.actorId) {
      context.addIssue({
        code: "custom",
        message: "defend action must target its actor",
        path: ["targetIds"],
      })
    }
  })

export type WizEngineBattleTurnActionProperties = WizDeepReadonly<
  z.infer<typeof zWizEngineBattleTurnAction>
>

export type WizEngineBattleTurnActionValue<
  TType extends WizEngineBattleTurnActionType,
  TActionId extends string,
  TActorId extends string,
  TTargetIds extends readonly string[],
  TAbilityId extends string | null,
  TItemId extends string | null,
> = WizEngineBattleTurnAction &
  Readonly<{
    id: TActionId
    type: TType
    actorId: TActorId
    targetIds: Readonly<TTargetIds>
    abilityId: TAbilityId
    itemId: TItemId
  }>

/**
 * 実行要求を表す immutable な ID command。
 *
 * ability/item の効果定義は保持せず、実行時に battle content から解決される。
 */
export class WizEngineBattleTurnAction {
  declare readonly [WIZ_IMMUTABLE_VALUE]: true
  readonly id: string
  readonly type: WizEngineBattleTurnActionType
  readonly actorId: string
  readonly targetIds: readonly string[]
  readonly abilityId: string | null
  readonly itemId: string | null

  private constructor(
    token: typeof wizEngineBattleTurnActionConstructionToken,
    properties: WizEngineBattleTurnActionProperties,
  ) {
    if (token !== wizEngineBattleTurnActionConstructionToken) {
      throw new TypeError(
        "WizEngineBattleTurnAction must be created with its public factories or fromUnknown()",
      )
    }
    this.id = properties.id
    this.type = properties.type
    this.actorId = properties.actorId
    this.targetIds = Object.freeze([...properties.targetIds])
    this.abilityId = properties.abilityId
    this.itemId = properties.itemId
    authenticWizEngineBattleTurnActions.add(this)
    WizImmutableValue.freeze(this)
  }

  static fromUnknown(input: unknown): WizEngineBattleTurnAction {
    return new WizEngineBattleTurnAction(
      wizEngineBattleTurnActionConstructionToken,
      zWizEngineBattleTurnAction.parse(input),
    )
  }

  /** @internal battle authority boundary only. */
  static assertAuthentic(action: unknown): asserts action is WizEngineBattleTurnAction {
    if (
      typeof action !== "object" ||
      action === null ||
      !authenticWizEngineBattleTurnActions.has(action)
    ) {
      throw new TypeError("Battle action must be an authentic WizEngineBattleTurnAction")
    }
  }

  static attack<
    const TActorId extends string,
    const TTargetId extends string,
    const TActionId extends string,
  >(
    actorId: TActorId,
    targetId: TTargetId,
    actionId: TActionId,
  ): WizEngineBattleTurnActionValue<
    "attack",
    TActionId,
    TActorId,
    readonly [TTargetId],
    null,
    null
  > {
    return WizEngineBattleTurnAction.fromUnknown({
      id: actionId,
      type: "attack",
      actorId,
      targetIds: [targetId],
      abilityId: null,
      itemId: null,
    }) as WizEngineBattleTurnActionValue<
      "attack",
      TActionId,
      TActorId,
      readonly [TTargetId],
      null,
      null
    >
  }

  static attackMultiple<
    const TActorId extends string,
    const TTargetIds extends readonly string[],
    const TActionId extends string,
  >(
    actorId: TActorId,
    targetIds: TTargetIds,
    actionId: TActionId,
  ): WizEngineBattleTurnActionValue<"attack", TActionId, TActorId, TTargetIds, null, null> {
    return WizEngineBattleTurnAction.fromUnknown({
      id: actionId,
      type: "attack",
      actorId,
      targetIds,
      abilityId: null,
      itemId: null,
    }) as WizEngineBattleTurnActionValue<"attack", TActionId, TActorId, TTargetIds, null, null>
  }

  static ability<
    const TActorId extends string,
    const TAbilityId extends string,
    const TTargetIds extends readonly string[],
    const TActionId extends string,
  >(
    actorId: TActorId,
    abilityId: TAbilityId,
    targetIds: TTargetIds,
    actionId: TActionId,
  ): WizEngineBattleTurnActionValue<"ability", TActionId, TActorId, TTargetIds, TAbilityId, null> {
    return WizEngineBattleTurnAction.fromUnknown({
      id: actionId,
      type: "ability",
      actorId,
      targetIds,
      abilityId,
      itemId: null,
    }) as WizEngineBattleTurnActionValue<
      "ability",
      TActionId,
      TActorId,
      TTargetIds,
      TAbilityId,
      null
    >
  }

  static item<
    const TActorId extends string,
    const TItemId extends string,
    const TTargetIds extends readonly string[],
    const TActionId extends string,
  >(
    actorId: TActorId,
    itemId: TItemId,
    targetIds: TTargetIds,
    actionId: TActionId,
  ): WizEngineBattleTurnActionValue<"item", TActionId, TActorId, TTargetIds, null, TItemId> {
    return WizEngineBattleTurnAction.fromUnknown({
      id: actionId,
      type: "item",
      actorId,
      targetIds,
      abilityId: null,
      itemId,
    }) as WizEngineBattleTurnActionValue<"item", TActionId, TActorId, TTargetIds, null, TItemId>
  }

  static defend<const TActorId extends string, const TActionId extends string>(
    actorId: TActorId,
    actionId: TActionId,
  ): WizEngineBattleTurnActionValue<
    "defend",
    TActionId,
    TActorId,
    readonly [TActorId],
    null,
    null
  > {
    return WizEngineBattleTurnAction.fromUnknown({
      id: actionId,
      type: "defend",
      actorId,
      targetIds: [actorId],
      abilityId: null,
      itemId: null,
    }) as WizEngineBattleTurnActionValue<
      "defend",
      TActionId,
      TActorId,
      readonly [TActorId],
      null,
      null
    >
  }

  static flee<const TActorId extends string, const TActionId extends string>(
    actorId: TActorId,
    actionId: TActionId,
  ): WizEngineBattleTurnActionValue<"flee", TActionId, TActorId, readonly [], null, null> {
    return WizEngineBattleTurnAction.fromUnknown({
      id: actionId,
      type: "flee",
      actorId,
      targetIds: [],
      abilityId: null,
      itemId: null,
    }) as WizEngineBattleTurnActionValue<"flee", TActionId, TActorId, readonly [], null, null>
  }

  toProperties(): WizEngineBattleTurnActionProperties {
    WizEngineBattleTurnAction.assertAuthentic(this)

    return {
      id: this.id,
      type: this.type,
      actorId: this.actorId,
      targetIds: this.targetIds,
      abilityId: this.abilityId,
      itemId: this.itemId,
    } as WizEngineBattleTurnActionProperties
  }
}

Object.freeze(WizEngineBattleTurnAction.prototype)
Object.freeze(WizEngineBattleTurnAction)
