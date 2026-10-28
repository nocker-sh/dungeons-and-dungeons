import { WizEffect } from "@/lib/wiz/core/domain/values/effect-set"
import type { WizEffectLifetime } from "@/lib/wiz/core/domain/values/effect-set"
import type { WizDeepReadonly } from "@/lib/wiz/core/immutable-value"
import { assertTrimmedNonEmptyStringValue } from "@/lib/wiz/core/assert-trimmed-non-empty-string-value"
import type { WizBattleAttributeModifier } from "@/lib/wiz/core/engine/battle/effects"
import { standardTags } from "@/lib/wiz/core/engine/battle/standard-tags"
import { configuredModifier } from "@/lib/wiz/core/engine/battle/configured-modifier"
import { defaultModifier } from "@/lib/wiz/core/engine/battle/default-modifier"

export type WizBattleEffectSource = Readonly<{
  kind: "item" | "ability" | "system"
  id: string
}>

export type WizBattleEffectPayload = Readonly<{
  name: string
  modifier: WizBattleAttributeModifier
  source: WizBattleEffectSource
  custom?: WizDeepReadonly<unknown>
}>

export type WizBattleEffectDefinition = Readonly<{
  instanceId: string
  effectId: string
  source: WizBattleEffectSource
  name: string
  lifetime: WizEffectLifetime
  power?: number
  modifier?: WizBattleAttributeModifier
  custom?: unknown
  tags?: readonly string[]
}>

/**
 * 標準battle用のeffect instanceを汎用`WizEffect`として定義する純粋factory。
 * effect IDは閉じたenumにせず、作品固有IDをそのまま受け付ける。
 */
export const createBattleEffect = (
  definition: WizBattleEffectDefinition
): WizEffect<string, string, string, WizBattleEffectPayload> => {
  assertTrimmedNonEmptyStringValue("effect", "battle.name", definition.name)
  assertTrimmedNonEmptyStringValue(
    "effect",
    "battle.source.kind",
    definition.source.kind
  )
  assertTrimmedNonEmptyStringValue(
    "effect",
    "battle.source.id",
    definition.source.id
  )
  const tags = Object.freeze([
    ...new Set([
      ...standardTags(definition.effectId),
      ...(definition.tags ?? []),
    ]),
  ])
  return WizEffect.define({
    effectId: definition.effectId,
    instanceId: definition.instanceId,
    lifetime: definition.lifetime,
    payload: {
      name: definition.name,
      modifier:
        definition.modifier ??
        configuredModifier(definition.custom) ??
        defaultModifier(definition.effectId, definition.power ?? 0),
      source: definition.source,
      ...(definition.custom === undefined ? {} : { custom: definition.custom }),
    },
    sourceId: definition.source.id,
    tags,
  })
}
