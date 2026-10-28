import type { WizItemEffectEvent } from "@/lib/wiz/core/domain/services/item-effect-service"

/**
 * 戦闘中に付与された効果の意味参照。
 *
 * `effectType` は組み込みstatusだけでなく利用側の追加statusも表せるようstringとする。
 * 表示名はこの値へ埋め込まず、message formatterのresolverで解決する。
 */
export type WizBattleEffectReference =
  | Readonly<{
      source: "system"
      effectType: string
    }>
  | Readonly<{
      source: "ability"
      abilityId: string
      effectType: string
    }>
  | Readonly<{
      source: "item"
      itemId: string
      effectType: string
    }>

/** 戦闘効果を解除する範囲。 */
export type WizBattleEffectRemoval =
  | Readonly<{ scope: "all" }>
  | Readonly<{
      scope: "effect"
      effect: WizBattleEffectReference
    }>

/**
 * 表示文字列を含まない、保存・再生可能な戦闘ログ。
 *
 * actor/target は戦闘インスタンス ID、ability/item は canonical content ID を保持する。
 */
export type WizBattleLogMessage =
  | Readonly<{ key: "BATTLE_ATTACK"; actorId: string; targetId: string }>
  | Readonly<{
      key: "BATTLE_ABILITY"
      actorId: string
      abilityId: string
      targetId: string
    }>
  | Readonly<{ key: "BATTLE_DEFEND"; actorId: string }>
  | Readonly<{
      key: "BATTLE_ITEM"
      actorId: string
      itemId: string
      targetId: string
    }>
  | Readonly<{ key: "BATTLE_FLEE"; actorId: string }>
  | Readonly<{ key: "BATTLE_FLEE_SUCCESS"; actorId: string }>
  | Readonly<{ key: "BATTLE_FLEE_FAILED"; actorId: string }>
  | Readonly<{ key: "BATTLE_DAMAGE"; targetId: string; damage: number }>
  | Readonly<{ key: "BATTLE_HEAL"; targetId: string; amount: number }>
  | Readonly<{ key: "BATTLE_MISS"; actorId: string; targetId: string }>
  | Readonly<{
      key: "BATTLE_CRITICAL"
      actorId: string
      targetId: string
      damage: number
    }>
  | Readonly<{
      key: "BATTLE_EFFECT_APPLIED"
      targetId: string
      effect: WizBattleEffectReference
    }>
  | Readonly<{
      key: "BATTLE_EFFECTS_REMOVED"
      targetId: string
      removal: WizBattleEffectRemoval
    }>
  | Readonly<{ key: "BATTLE_DEATH"; targetId: string }>
  | Readonly<{ key: "ACTOR_CANNOT_ACT"; actorId: string }>

/**
 * ログメッセージの型定義
 *
 * ライブラリ内では ID ベースでログを発行し、
 * 表示時に WizEngineMessageFormatter で名前解決 + テンプレート適用する。
 */
export type WizLogMessage = Readonly<
  // System
  | { key: "WORLD_STARTED" }
  | { key: "SEASON_CHANGED"; season: string }
  | { key: "HUNGER_DAMAGE" }
  | { key: "AREA_UNLOCKED"; areaId: string }

  // Inventory
  | {
      key: "ITEM_EFFECT_APPLIED"
      itemId: string
      events: readonly WizItemEffectEvent[]
    }
  | { key: "EQUIPPED_WEAPON"; weaponId: string }
  | { key: "EQUIPPED_ARMOR"; armorId: string }
  | { key: "UNEQUIPPED_WEAPON" }
  | { key: "UNEQUIPPED_ARMOR" }

  // Village
  | { key: "ENTERED_SHOP"; shopId: string }
  | { key: "ENTERED_INN" }
  | { key: "NOT_ENOUGH_AP" }
  | { key: "ENTERED_AREA"; areaId: string }
  | { key: "TALKED_TO_NPC"; npcId: string }

  // Shop
  | { key: "PURCHASED_ITEM"; itemId: string; price: number }
  | { key: "PURCHASED_WEAPON"; weaponId: string; price: number }
  | { key: "PURCHASED_ARMOR"; armorId: string; price: number }
  | { key: "SOLD_ITEM"; itemId: string; price: number }
  | { key: "LEFT_SHOP" }
  | { key: "HINT_DISCOVERED"; shopId: string; topicId: string }

  // Inn
  | { key: "INN_RESTED"; planId: string }
  | { key: "INN_NOT_ENOUGH_GOLD"; planId: string; required: number }
  | { key: "LEFT_INN" }

  // Exploration
  | { key: "RETURNED_TO_VILLAGE" }
  | { key: "DISCOVERED_MONSTER"; monsterId: string }
  | { key: "ENCOUNTER_MONSTERS"; monsterIds: readonly string[] }
  | { key: "GATHERED_ITEM"; itemId: string }
  | { key: "EXPLORED_AREA" }
  | { key: "EVENT_RESOLVED"; eventId: string; succeeded: boolean }
  | { key: "RESTED"; apRecovered: number }
  | { key: "NO_GATHERING_AVAILABLE" }
  | { key: "NO_MONSTERS_AVAILABLE" }
  | { key: "FACILITY_UNLOCKED"; facilityId: string }

  // Battle
  | { key: "BATTLE_START" }
  | { key: "BATTLE_VICTORY"; exp: number; gold: number }
  | { key: "BATTLE_DEFEAT" }
  | { key: "TURN_START"; turnNumber: number }
  | WizBattleLogMessage
  | { key: "FLED_BATTLE" }
  | { key: "FLED_SUCCESS" }

  // Crafting
  | { key: "CRAFTED_ITEM"; recipeId: string }
  | { key: "LEFT_CRAFTING" }

  // Quest
  | { key: "QUEST_COMPLETED"; questId: string }
  | { key: "QUEST_CHAIN_UNLOCKED"; questId: string }
  | { key: "QUEST_REWARD_ITEM"; itemId: string; quantity: number }

  // Level Up
  | { key: "LEVEL_UP_POINTS_GRANTED"; points: number }
  | { key: "LEVEL_UP"; level: number }
  | { key: "ABILITY_LEARNED"; abilityId: string }

  // NPC
  | { key: "AFFINITY_LEVEL_CHANGED"; npcId: string; level: string }
>

const requireSemanticId = (value: string, field: string): string => {
  if (value.length === 0 || value.trim() !== value) {
    throw new TypeError(`${field} must be a non-empty semantic ID without surrounding whitespace`)
  }
  return value
}

const requireBattleAmount = (value: number, field: string): number => {
  if (!Number.isFinite(value) || value < 0) {
    throw new TypeError(`${field} must be a finite non-negative number`)
  }
  return value
}

const ownBattleEffectReference = (effect: WizBattleEffectReference): WizBattleEffectReference => {
  switch (effect.source) {
    case "system":
      return Object.freeze({
        source: "system",
        effectType: requireSemanticId(effect.effectType, "effect.effectType"),
      })
    case "ability":
      return Object.freeze({
        source: "ability",
        abilityId: requireSemanticId(effect.abilityId, "effect.abilityId"),
        effectType: requireSemanticId(effect.effectType, "effect.effectType"),
      })
    case "item":
      return Object.freeze({
        source: "item",
        itemId: requireSemanticId(effect.itemId, "effect.itemId"),
        effectType: requireSemanticId(effect.effectType, "effect.effectType"),
      })
    default:
      throw new TypeError("effect.source must identify a canonical battle effect")
  }
}

/**
 * semantic ID を検証し、immutable な canonical 戦闘ログを作る stateless factory。
 */
export class WizBattleLog {
  private constructor() {
    throw new TypeError("WizBattleLog is a static-only factory")
  }

  static effect(effectType: string): WizBattleEffectReference {
    return Object.freeze({
      source: "system",
      effectType: requireSemanticId(effectType, "effectType"),
    })
  }

  static abilityEffect(abilityId: string, effectType: string): WizBattleEffectReference {
    return Object.freeze({
      source: "ability",
      abilityId: requireSemanticId(abilityId, "abilityId"),
      effectType: requireSemanticId(effectType, "effectType"),
    })
  }

  static itemEffect(itemId: string, effectType: string): WizBattleEffectReference {
    return Object.freeze({
      source: "item",
      itemId: requireSemanticId(itemId, "itemId"),
      effectType: requireSemanticId(effectType, "effectType"),
    })
  }

  static removeEffect(effect: WizBattleEffectReference): WizBattleEffectRemoval {
    return Object.freeze({
      scope: "effect",
      effect: ownBattleEffectReference(effect),
    })
  }

  static removeAllEffects(): WizBattleEffectRemoval {
    return Object.freeze({ scope: "all" })
  }

  static attack(
    actorId: string,
    targetId: string,
  ): Extract<WizBattleLogMessage, { key: "BATTLE_ATTACK" }> {
    return Object.freeze({
      key: "BATTLE_ATTACK",
      actorId: requireSemanticId(actorId, "actorId"),
      targetId: requireSemanticId(targetId, "targetId"),
    })
  }

  static ability(
    actorId: string,
    abilityId: string,
    targetId: string,
  ): Extract<WizBattleLogMessage, { key: "BATTLE_ABILITY" }> {
    return Object.freeze({
      key: "BATTLE_ABILITY",
      actorId: requireSemanticId(actorId, "actorId"),
      abilityId: requireSemanticId(abilityId, "abilityId"),
      targetId: requireSemanticId(targetId, "targetId"),
    })
  }

  static defend(actorId: string): Extract<WizBattleLogMessage, { key: "BATTLE_DEFEND" }> {
    return Object.freeze({
      key: "BATTLE_DEFEND",
      actorId: requireSemanticId(actorId, "actorId"),
    })
  }

  static item(
    actorId: string,
    itemId: string,
    targetId: string,
  ): Extract<WizBattleLogMessage, { key: "BATTLE_ITEM" }> {
    return Object.freeze({
      key: "BATTLE_ITEM",
      actorId: requireSemanticId(actorId, "actorId"),
      itemId: requireSemanticId(itemId, "itemId"),
      targetId: requireSemanticId(targetId, "targetId"),
    })
  }

  static flee(actorId: string): Extract<WizBattleLogMessage, { key: "BATTLE_FLEE" }> {
    return Object.freeze({
      key: "BATTLE_FLEE",
      actorId: requireSemanticId(actorId, "actorId"),
    })
  }

  static fleeSuccess(
    actorId: string,
  ): Extract<WizBattleLogMessage, { key: "BATTLE_FLEE_SUCCESS" }> {
    return Object.freeze({
      key: "BATTLE_FLEE_SUCCESS",
      actorId: requireSemanticId(actorId, "actorId"),
    })
  }

  static fleeFailed(actorId: string): Extract<WizBattleLogMessage, { key: "BATTLE_FLEE_FAILED" }> {
    return Object.freeze({
      key: "BATTLE_FLEE_FAILED",
      actorId: requireSemanticId(actorId, "actorId"),
    })
  }

  static damage(
    targetId: string,
    damage: number,
  ): Extract<WizBattleLogMessage, { key: "BATTLE_DAMAGE" }> {
    return Object.freeze({
      key: "BATTLE_DAMAGE",
      targetId: requireSemanticId(targetId, "targetId"),
      damage: requireBattleAmount(damage, "damage"),
    })
  }

  static heal(
    targetId: string,
    amount: number,
  ): Extract<WizBattleLogMessage, { key: "BATTLE_HEAL" }> {
    return Object.freeze({
      key: "BATTLE_HEAL",
      targetId: requireSemanticId(targetId, "targetId"),
      amount: requireBattleAmount(amount, "amount"),
    })
  }

  static miss(
    actorId: string,
    targetId: string,
  ): Extract<WizBattleLogMessage, { key: "BATTLE_MISS" }> {
    return Object.freeze({
      key: "BATTLE_MISS",
      actorId: requireSemanticId(actorId, "actorId"),
      targetId: requireSemanticId(targetId, "targetId"),
    })
  }

  static critical(
    actorId: string,
    targetId: string,
    damage: number,
  ): Extract<WizBattleLogMessage, { key: "BATTLE_CRITICAL" }> {
    return Object.freeze({
      key: "BATTLE_CRITICAL",
      actorId: requireSemanticId(actorId, "actorId"),
      targetId: requireSemanticId(targetId, "targetId"),
      damage: requireBattleAmount(damage, "damage"),
    })
  }

  static effectApplied(
    targetId: string,
    effect: WizBattleEffectReference,
  ): Extract<WizBattleLogMessage, { key: "BATTLE_EFFECT_APPLIED" }> {
    return Object.freeze({
      key: "BATTLE_EFFECT_APPLIED",
      targetId: requireSemanticId(targetId, "targetId"),
      effect: ownBattleEffectReference(effect),
    })
  }

  static effectsRemoved(
    targetId: string,
    removal: WizBattleEffectRemoval,
  ): Extract<WizBattleLogMessage, { key: "BATTLE_EFFECTS_REMOVED" }> {
    return Object.freeze({
      key: "BATTLE_EFFECTS_REMOVED",
      targetId: requireSemanticId(targetId, "targetId"),
      removal:
        removal.scope === "all"
          ? WizBattleLog.removeAllEffects()
          : WizBattleLog.removeEffect(removal.effect),
    })
  }

  static death(targetId: string): Extract<WizBattleLogMessage, { key: "BATTLE_DEATH" }> {
    return Object.freeze({
      key: "BATTLE_DEATH",
      targetId: requireSemanticId(targetId, "targetId"),
    })
  }

  static actorCannotAct(
    actorId: string,
  ): Extract<WizBattleLogMessage, { key: "ACTOR_CANNOT_ACT" }> {
    return Object.freeze({
      key: "ACTOR_CANNOT_ACT",
      actorId: requireSemanticId(actorId, "actorId"),
    })
  }
}

Object.freeze(WizBattleLog.prototype)
Object.freeze(WizBattleLog)
