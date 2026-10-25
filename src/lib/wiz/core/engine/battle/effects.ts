import type { WizBattleAbility } from "@/lib/wiz/core/engine/battle/ability"
import type { WizEffectConfig } from "@/lib/wiz/core/config/battle/wiz-effect-config"
import {
  WizEffect,
  type WizEffectLifetime,
  WizEffectSet,
} from "@/lib/wiz/core/domain/values/effect-set"
import type { WizBattleActorState } from "@/lib/wiz/core/engine/battle/actor-state"
import type { WizDeepReadonly } from "@/lib/wiz/core/immutable-value"
import { assertTrimmedNonEmptyStringValue } from "@/lib/wiz/core/value-validation"

export const WIZ_BATTLE_EFFECT_TAG = Object.freeze({
  blocksAction: "battle.blocks-action",
  dead: "battle.dead",
  defending: "battle.defending",
  fled: "battle.fled",
  silenced: "battle.silenced",
})

export type WizBattleAttributeModifier = Readonly<{
  attack?: number
  defense?: number
  speed?: number
}>

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

const getFiniteNumber = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined

const readOwnDataProperty = (value: unknown, key: string): unknown => {
  if (typeof value !== "object" || value === null) return undefined
  const descriptor = Object.getOwnPropertyDescriptor(value, key)
  return descriptor !== undefined && "value" in descriptor ? descriptor.value : undefined
}

const readModifier = (value: unknown): WizBattleAttributeModifier | undefined => {
  if (typeof value !== "object" || value === null) return undefined
  const attack = getFiniteNumber(readOwnDataProperty(value, "attack"))
  const defense = getFiniteNumber(readOwnDataProperty(value, "defense"))
  const speed = getFiniteNumber(readOwnDataProperty(value, "speed"))
  if (attack === undefined && defense === undefined && speed === undefined) return undefined
  return Object.freeze({ attack, defense, speed })
}

const configuredModifier = (custom: unknown): WizBattleAttributeModifier | undefined =>
  readModifier(readOwnDataProperty(custom, "statusModifier"))

const defaultModifier = (effectId: string, power: number): WizBattleAttributeModifier => {
  if (!Number.isFinite(power)) return Object.freeze({})
  if (effectId === "attackUp") return Object.freeze({ attack: power })
  if (effectId === "attackDown") return Object.freeze({ attack: -power })
  if (effectId === "defenseUp") return Object.freeze({ defense: power })
  if (effectId === "defenseDown") return Object.freeze({ defense: -power })
  if (effectId === "speedUp") return Object.freeze({ speed: power })
  if (effectId === "speedDown") return Object.freeze({ speed: -power })
  return Object.freeze({})
}

const standardTags = (effectId: string): readonly string[] => {
  const tags: string[] = []
  if (
    effectId === "paralysis" ||
    effectId === "sleep" ||
    effectId === "dead" ||
    effectId === "fled"
  ) {
    tags.push(WIZ_BATTLE_EFFECT_TAG.blocksAction)
  }
  if (effectId === "dead") tags.push(WIZ_BATTLE_EFFECT_TAG.dead)
  if (effectId === "defending") tags.push(WIZ_BATTLE_EFFECT_TAG.defending)
  if (effectId === "fled") tags.push(WIZ_BATTLE_EFFECT_TAG.fled)
  if (effectId === "silence") tags.push(WIZ_BATTLE_EFFECT_TAG.silenced)
  return Object.freeze(tags)
}

/**
 * 標準battle用のeffect instanceを汎用`WizEffect`として定義する純粋factory。
 * effect IDは閉じたenumにせず、作品固有IDをそのまま受け付ける。
 */
export const createBattleEffect = (
  definition: WizBattleEffectDefinition,
): WizEffect<string, string, string, WizBattleEffectPayload> => {
  assertTrimmedNonEmptyStringValue("effect", "battle.name", definition.name)
  assertTrimmedNonEmptyStringValue("effect", "battle.source.kind", definition.source.kind)
  assertTrimmedNonEmptyStringValue("effect", "battle.source.id", definition.source.id)
  const tags = Object.freeze([
    ...new Set([...standardTags(definition.effectId), ...(definition.tags ?? [])]),
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

export const battleEffectRemainingTurns = (effect: WizEffect): number => {
  if (effect.lifetime.type === "permanent") return -1
  if (effect.lifetime.type === "turns") return effect.lifetime.remaining
  throw new TypeError(`Battle effect "${effect.instanceId}" must use turns or permanent lifetime`)
}

export const getBattleAbilityEffectId = (ability: WizBattleAbility): string => {
  if (ability.effect.type !== "effect") {
    throw new TypeError(`Battle ability "${ability.id}" does not apply an effect`)
  }
  return ability.effect.effectId
}

export const getBattleEffectInitialTurns = (effectId: string, config: WizEffectConfig): number => {
  if (effectId === "attackUp" || effectId === "defenseUp" || effectId === "speedUp") {
    return config.defaultBuffTurns
  }
  if (effectId === "attackDown" || effectId === "defenseDown" || effectId === "speedDown") {
    return config.defaultDebuffTurns
  }
  return config.defaultEffectTurns
}

export const getBattleEffectModifier = (effect: WizEffect): WizBattleAttributeModifier =>
  readModifier(readOwnDataProperty(effect.payload, "modifier")) ?? Object.freeze({})

/**
 * 基礎stateを変更せず、有効effectだけを汎用attribute setへ畳み込む。
 */
export const deriveEffectiveBattleState = <TCustom>(
  base: WizBattleActorState<TCustom>,
  effects: WizEffectSet,
): WizBattleActorState<TCustom> => {
  const modifier = effects.effects.reduce(
    (total, effect) => {
      const current = getBattleEffectModifier(effect)
      return {
        attack: total.attack + (current.attack ?? 0),
        defense: total.defense + (current.defense ?? 0),
        speed: total.speed + (current.speed ?? 0),
      }
    },
    { attack: 0, defense: 0, speed: 0 },
  )

  return base.withAttributes(
    base.attributes
      .withValue("attack", Math.max(0, base.attributes.value("attack") + modifier.attack))
      .withValue("defense", Math.max(0, base.attributes.value("defense") + modifier.defense))
      .withValue("speed", Math.max(0, base.attributes.value("speed") + modifier.speed)),
  )
}
