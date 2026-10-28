import { z } from "zod"
import { WizAbility } from "@/lib/wiz/core/domain/values/ability"
import type { WizDeepReadonly } from "@/lib/wiz/core/immutable-value"

const zSemanticId = z
  .string()
  .refine(
    (value) => value.trim().length > 0 && value === value.trim(),
    "must be a non-blank string without surrounding whitespace"
  )

export const zWizBattleAbilityTarget = z.enum([
  "single",
  "group",
  "all",
  "self",
])

const zBattleAbilityBaseEffect = z.strictObject({
  target: zWizBattleAbilityTarget,
  side: z.enum(["allies", "opponents"]),
  element: zSemanticId.default("none"),
  power: z.number().finite().nonnegative(),
})

export const zWizBattleAbilityEffect = z.discriminatedUnion("type", [
  zBattleAbilityBaseEffect.extend({ type: z.literal("damage") }),
  zBattleAbilityBaseEffect.extend({ type: z.literal("heal") }),
  zBattleAbilityBaseEffect.extend({
    type: z.literal("effect"),
    effectId: zSemanticId,
    durationTurns: z.number().finite().int().positive().optional(),
    tags: z.array(zSemanticId).default([]),
    modifier: z
      .strictObject({
        attack: z.number().finite().optional(),
        defense: z.number().finite().optional(),
        speed: z.number().finite().optional(),
      })
      .optional(),
  }),
])

export type WizBattleAbilityTarget = z.infer<typeof zWizBattleAbilityTarget>
export type WizBattleAbilityEffect = WizDeepReadonly<
  z.infer<typeof zWizBattleAbilityEffect>
>
export type WizBattleAbilityCustom = Readonly<Record<string, unknown>>
export type WizBattleAbility = WizAbility<
  string,
  WizBattleAbilityEffect,
  WizBattleAbilityCustom,
  "mana"
>

export const zWizBattleAbilityDefinition = z.strictObject({
  id: zSemanticId,
  name: zSemanticId,
  description: z.string().default(""),
  tags: z.array(zSemanticId).default([]),
  costs: z
    .strictObject({
      mana: z.number().finite().nonnegative().optional(),
    })
    .default({}),
  effect: zWizBattleAbilityEffect,
  custom: z.record(z.string(), z.unknown()).default({}),
})

export type WizBattleAbilityDefinition = WizDeepReadonly<
  z.infer<typeof zWizBattleAbilityDefinition>
>

const compileBattleAbility = (
  definition: WizBattleAbilityDefinition,
  timing: Pick<
    WizAbility,
    | "castTimeMs"
    | "cooldownGroups"
    | "cooldownMs"
    | "maximumCharges"
    | "recoveryTimeMs"
  > = {
    castTimeMs: 0,
    cooldownGroups: Object.freeze({}),
    cooldownMs: 0,
    maximumCharges: 1,
    recoveryTimeMs: 0,
  }
): WizBattleAbility =>
  WizAbility.define<
    string,
    WizBattleAbilityEffect,
    WizBattleAbilityCustom,
    "mana"
  >({
    ...definition,
    ...timing,
  })

/**
 * 外部入力を標準battle用effectへ検証し、汎用`WizAbility`へcompileする。
 */
export const createBattleAbility = (input: unknown): WizBattleAbility => {
  if (input instanceof WizAbility) {
    WizAbility.require(input, "Battle ability")
    const properties = input.toProperties()
    const definition = zWizBattleAbilityDefinition.parse({
      costs: properties.costs,
      custom: properties.custom ?? {},
      description: properties.description,
      effect: properties.effect,
      id: properties.id,
      name: properties.name,
      tags: properties.tags,
    })
    return compileBattleAbility(definition, properties)
  }

  return compileBattleAbility(zWizBattleAbilityDefinition.parse(input))
}
