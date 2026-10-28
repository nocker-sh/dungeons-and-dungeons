import type { WizItemEffectEvent } from "@/lib/wiz/core/domain/services/item-effect-service"
import { createWizImmutableRecord } from "@/lib/wiz/core/create-wiz-immutable-record"
import { getWizImmutableRecordValue } from "@/lib/wiz/core/get-wiz-immutable-record-value"
import type {
  WizBattleEffectReference,
  WizBattleEffectRemoval,
  WizLogMessage,
} from "@/lib/wiz/core/types/wiz-log-message"

/**
 * メッセージキーごとのテンプレート関数集合。
 *
 * すべての `WizLogMessage` キーに対応する。i18n や言語切替は
 * このオブジェクトを差し替える形で実装する (例: `DEFAULT_MESSAGES_JA` を fork)。
 * 個別キーだけ上書きする場合は `Partial<WizEngineMessageTemplates>` でマージ。
 */
export type WizEngineMessageTemplates = Readonly<{
  WORLD_STARTED: () => string
  SEASON_CHANGED: (p: { seasonName: string }) => string
  HUNGER_DAMAGE: () => string
  AREA_UNLOCKED: (p: { areaName: string }) => string

  ITEM_EFFECT_APPLIED: (p: {
    itemName: string
    events: readonly WizItemEffectEvent[]
  }) => string
  EQUIPPED_WEAPON: (p: { weaponName: string }) => string
  EQUIPPED_ARMOR: (p: { armorName: string }) => string
  UNEQUIPPED_WEAPON: () => string
  UNEQUIPPED_ARMOR: () => string

  ENTERED_SHOP: (p: { shopName: string }) => string
  ENTERED_INN: () => string
  NOT_ENOUGH_AP: () => string
  ENTERED_AREA: (p: { areaName: string }) => string
  TALKED_TO_NPC: (p: { npcName: string }) => string

  PURCHASED_ITEM: (p: { itemName: string; price: number }) => string
  PURCHASED_WEAPON: (p: { weaponName: string; price: number }) => string
  PURCHASED_ARMOR: (p: { armorName: string; price: number }) => string
  SOLD_ITEM: (p: { itemName: string; price: number }) => string
  LEFT_SHOP: () => string
  HINT_DISCOVERED: (p: { hint: string }) => string

  INN_RESTED: (p: { planName: string }) => string
  INN_NOT_ENOUGH_GOLD: (p: { planName: string; required: number }) => string
  LEFT_INN: () => string

  RETURNED_TO_VILLAGE: () => string
  DISCOVERED_MONSTER: (p: { monsterName: string }) => string
  ENCOUNTER_MONSTERS: (p: { monsterNames: string }) => string
  GATHERED_ITEM: (p: { itemName: string }) => string
  EXPLORED_AREA: () => string
  EVENT_RESOLVED: (p: { succeeded: boolean }) => string
  RESTED: (p: { apRecovered: number }) => string
  NO_GATHERING_AVAILABLE: () => string
  NO_MONSTERS_AVAILABLE: () => string
  FACILITY_UNLOCKED: (p: { facilityName: string }) => string

  BATTLE_START: () => string
  FLED_BATTLE: () => string
  FLED_SUCCESS: () => string
  ACTOR_CANNOT_ACT: (p: { actorName: string }) => string
  BATTLE_VICTORY: (p: { exp: number; gold: number }) => string
  BATTLE_DEFEAT: () => string
  TURN_START: (p: { turnNumber: number }) => string

  BATTLE_ATTACK: (p: { actorName: string; targetName: string }) => string
  BATTLE_ABILITY: (p: {
    actorName: string
    abilityName: string
    targetName: string
  }) => string
  BATTLE_DEFEND: (p: { actorName: string }) => string
  BATTLE_ITEM: (p: {
    actorName: string
    itemName: string
    targetName: string
  }) => string
  BATTLE_FLEE: (p: { actorName: string }) => string
  BATTLE_FLEE_SUCCESS: (p: { actorName: string }) => string
  BATTLE_FLEE_FAILED: (p: { actorName: string }) => string

  BATTLE_DAMAGE: (p: { targetName: string; damage: number }) => string
  BATTLE_HEAL: (p: { targetName: string; amount: number }) => string
  BATTLE_MISS: (p: { actorName: string; targetName: string }) => string
  BATTLE_CRITICAL: (p: {
    actorName: string
    targetName: string
    damage: number
  }) => string
  BATTLE_EFFECT_APPLIED: (p: {
    targetName: string
    effectName: string
    effect: WizBattleEffectReference
  }) => string
  BATTLE_EFFECTS_REMOVED: (p: {
    targetName: string
    effectName: string
    removal: WizBattleEffectRemoval
  }) => string
  BATTLE_DEATH: (p: { targetName: string }) => string

  CRAFTED_ITEM: (p: { recipeName: string }) => string
  LEFT_CRAFTING: () => string

  QUEST_COMPLETED: (p: { questName: string }) => string
  QUEST_CHAIN_UNLOCKED: (p: { questName: string }) => string
  QUEST_REWARD_ITEM: (p: { itemName: string; quantity: number }) => string

  LEVEL_UP_POINTS_GRANTED: (p: { points: number }) => string
  LEVEL_UP: (p: { level: number }) => string
  ABILITY_LEARNED: (p: { abilityName: string }) => string

  AFFINITY_LEVEL_CHANGED: (p: { npcName: string; levelName: string }) => string
}>

export type WizEngineNameResolvers = Readonly<{
  season: (id: string) => string | undefined
  shop: (id: string) => string | undefined
  shopHint: (
    reference: Readonly<{ shopId: string; topicId: string }>
  ) => string | undefined
  innPlan: (id: string) => string | undefined
  npc: (id: string) => string | undefined
  area: (id: string) => string | undefined
  monster: (id: string) => string | undefined
  quest: (id: string) => string | undefined
  recipe: (id: string) => string | undefined
  ability: (id: string) => string | undefined
  facility: (id: string) => string | undefined
  affinityLevel: (id: string) => string | undefined
  battleActor: (id: string) => string | undefined
  battleItem: (id: string) => string | undefined
  battleEffect: (id: string) => string | undefined
  battleEffectScope: (scope: "all") => string | undefined
}>

export type WizEngineMessageContent = Readonly<{
  items: Readonly<Partial<Record<string, Readonly<{ name: string }>>>>
  weapons: Readonly<Partial<Record<string, Readonly<{ name: string }>>>>
  armors: Readonly<Partial<Record<string, Readonly<{ name: string }>>>>
}>

export type WizEngineMessageFormatterDefinition = Readonly<{
  readonly content: WizEngineMessageContent
  readonly templates: WizEngineMessageTemplates
  readonly resolvers?: Partial<WizEngineNameResolvers>
}>

type InternalResolvers = {
  readonly [K in keyof WizEngineNameResolvers]: (
    id: Parameters<WizEngineNameResolvers[K]>[0]
  ) => string
}

type FormatterMap = {
  readonly [K in WizLogMessage["key"]]: (
    msg: Extract<WizLogMessage, { key: K }>
  ) => string
}

type NamedContentRecord = WizEngineMessageContent["items"]

const ownNamedContentRecord = (
  record: NamedContentRecord
): NamedContentRecord =>
  createWizImmutableRecord(
    Object.entries(record).flatMap(([id, entry]) =>
      entry ? [[id, Object.freeze({ name: entry.name })] as const] : []
    )
  )

const ownMessageContent = (
  content: WizEngineMessageContent
): WizEngineMessageContent =>
  Object.freeze({
    items: ownNamedContentRecord(content.items),
    weapons: ownNamedContentRecord(content.weapons),
    armors: ownNamedContentRecord(content.armors),
  })

const resolveContentName = (
  record: NamedContentRecord,
  id: string
): string | undefined => getWizImmutableRecordValue(record, id)?.name

const ownFunctionTable = <TTable extends object>(
  table: TTable,
  label: string
): TTable => {
  const owned = Object.create(null) as TTable
  for (const key of Reflect.ownKeys(table)) {
    const descriptor = Object.getOwnPropertyDescriptor(table, key)
    if (!descriptor) {
      continue
    }
    if (!("value" in descriptor)) {
      throw new TypeError(`${label} must use data properties`)
    }
    Object.defineProperty(owned, key, {
      configurable: false,
      enumerable: descriptor.enumerable,
      value: descriptor.value,
      writable: false,
    })
  }
  return Object.freeze(owned)
}

export class WizEngineMessageFormatter {
  private readonly content: WizEngineMessageContent
  private readonly templates: WizEngineMessageTemplates
  private readonly resolvers: InternalResolvers
  private readonly formatters: FormatterMap

  constructor(dependencies: WizEngineMessageFormatterDefinition) {
    this.content = ownMessageContent(dependencies.content)
    this.templates = ownFunctionTable(
      dependencies.templates,
      "Message templates"
    )
    const resolverOverrides =
      dependencies.resolvers === undefined
        ? undefined
        : ownFunctionTable(dependencies.resolvers, "Message resolvers")
    this.resolvers = createInternalResolvers(resolverOverrides)
    this.formatters = ownFunctionTable(
      this.createFormatters(),
      "Message formatters"
    )
    Object.freeze(this)
  }

  readonly format = (msg: WizLogMessage): string => {
    const formatter = this.formatters[msg.key] as (m: WizLogMessage) => string

    return formatter(msg)
  }

  readonly formatAll = (
    messages: readonly WizLogMessage[]
  ): readonly string[] => {
    return Object.freeze(messages.map((m) => this.format(m)))
  }

  private createFormatters(): FormatterMap {
    const t = this.templates
    const r = this.resolvers
    const content = this.content

    return {
      WORLD_STARTED: () => t.WORLD_STARTED(),
      SEASON_CHANGED: (m) =>
        t.SEASON_CHANGED({ seasonName: r.season(m.season) }),
      HUNGER_DAMAGE: () => t.HUNGER_DAMAGE(),
      AREA_UNLOCKED: (m) => t.AREA_UNLOCKED({ areaName: r.area(m.areaId) }),

      ITEM_EFFECT_APPLIED: (m) =>
        t.ITEM_EFFECT_APPLIED({
          itemName: resolveContentName(content.items, m.itemId) ?? m.itemId,
          events: m.events,
        }),
      EQUIPPED_WEAPON: (m) =>
        t.EQUIPPED_WEAPON({
          weaponName:
            resolveContentName(content.weapons, m.weaponId) ?? m.weaponId,
        }),
      EQUIPPED_ARMOR: (m) =>
        t.EQUIPPED_ARMOR({
          armorName: resolveContentName(content.armors, m.armorId) ?? m.armorId,
        }),
      UNEQUIPPED_WEAPON: () => t.UNEQUIPPED_WEAPON(),
      UNEQUIPPED_ARMOR: () => t.UNEQUIPPED_ARMOR(),

      ENTERED_SHOP: (m) => t.ENTERED_SHOP({ shopName: r.shop(m.shopId) }),
      ENTERED_INN: () => t.ENTERED_INN(),
      NOT_ENOUGH_AP: () => t.NOT_ENOUGH_AP(),
      ENTERED_AREA: (m) => t.ENTERED_AREA({ areaName: r.area(m.areaId) }),
      TALKED_TO_NPC: (m) => t.TALKED_TO_NPC({ npcName: r.npc(m.npcId) }),

      PURCHASED_ITEM: (m) =>
        t.PURCHASED_ITEM({
          itemName: resolveContentName(content.items, m.itemId) ?? m.itemId,
          price: m.price,
        }),
      PURCHASED_WEAPON: (m) =>
        t.PURCHASED_WEAPON({
          weaponName:
            resolveContentName(content.weapons, m.weaponId) ?? m.weaponId,
          price: m.price,
        }),
      PURCHASED_ARMOR: (m) =>
        t.PURCHASED_ARMOR({
          armorName: resolveContentName(content.armors, m.armorId) ?? m.armorId,
          price: m.price,
        }),
      SOLD_ITEM: (m) =>
        t.SOLD_ITEM({
          itemName: resolveContentName(content.items, m.itemId) ?? m.itemId,
          price: m.price,
        }),
      LEFT_SHOP: () => t.LEFT_SHOP(),
      HINT_DISCOVERED: (m) =>
        t.HINT_DISCOVERED({
          hint: r.shopHint({ shopId: m.shopId, topicId: m.topicId }),
        }),

      INN_RESTED: (m) => t.INN_RESTED({ planName: r.innPlan(m.planId) }),
      INN_NOT_ENOUGH_GOLD: (m) =>
        t.INN_NOT_ENOUGH_GOLD({
          planName: r.innPlan(m.planId),
          required: m.required,
        }),
      LEFT_INN: () => t.LEFT_INN(),

      RETURNED_TO_VILLAGE: () => t.RETURNED_TO_VILLAGE(),
      DISCOVERED_MONSTER: (m) =>
        t.DISCOVERED_MONSTER({ monsterName: r.monster(m.monsterId) }),
      ENCOUNTER_MONSTERS: (m) =>
        t.ENCOUNTER_MONSTERS({
          monsterNames: m.monsterIds.map((id) => r.monster(id)).join(", "),
        }),
      GATHERED_ITEM: (m) =>
        t.GATHERED_ITEM({
          itemName: resolveContentName(content.items, m.itemId) ?? m.itemId,
        }),
      EXPLORED_AREA: () => t.EXPLORED_AREA(),
      EVENT_RESOLVED: (m) => t.EVENT_RESOLVED({ succeeded: m.succeeded }),
      RESTED: (m) => t.RESTED({ apRecovered: m.apRecovered }),
      NO_GATHERING_AVAILABLE: () => t.NO_GATHERING_AVAILABLE(),
      NO_MONSTERS_AVAILABLE: () => t.NO_MONSTERS_AVAILABLE(),
      FACILITY_UNLOCKED: (m) =>
        t.FACILITY_UNLOCKED({ facilityName: r.facility(m.facilityId) }),

      BATTLE_START: () => t.BATTLE_START(),
      FLED_BATTLE: () => t.FLED_BATTLE(),
      FLED_SUCCESS: () => t.FLED_SUCCESS(),
      ACTOR_CANNOT_ACT: (m) =>
        t.ACTOR_CANNOT_ACT({ actorName: r.battleActor(m.actorId) }),
      BATTLE_VICTORY: (m) => t.BATTLE_VICTORY({ exp: m.exp, gold: m.gold }),
      BATTLE_DEFEAT: () => t.BATTLE_DEFEAT(),
      TURN_START: (m) => t.TURN_START({ turnNumber: m.turnNumber }),

      BATTLE_ATTACK: (m) =>
        t.BATTLE_ATTACK({
          actorName: r.battleActor(m.actorId),
          targetName: r.battleActor(m.targetId),
        }),
      BATTLE_ABILITY: (m) =>
        t.BATTLE_ABILITY({
          actorName: r.battleActor(m.actorId),
          abilityName: r.ability(m.abilityId),
          targetName: r.battleActor(m.targetId),
        }),
      BATTLE_DEFEND: (m) =>
        t.BATTLE_DEFEND({ actorName: r.battleActor(m.actorId) }),
      BATTLE_ITEM: (m) =>
        t.BATTLE_ITEM({
          actorName: r.battleActor(m.actorId),
          itemName: r.battleItem(m.itemId),
          targetName: r.battleActor(m.targetId),
        }),
      BATTLE_FLEE: (m) =>
        t.BATTLE_FLEE({ actorName: r.battleActor(m.actorId) }),
      BATTLE_FLEE_SUCCESS: (m) =>
        t.BATTLE_FLEE_SUCCESS({ actorName: r.battleActor(m.actorId) }),
      BATTLE_FLEE_FAILED: (m) =>
        t.BATTLE_FLEE_FAILED({ actorName: r.battleActor(m.actorId) }),

      BATTLE_DAMAGE: (m) =>
        t.BATTLE_DAMAGE({
          targetName: r.battleActor(m.targetId),
          damage: m.damage,
        }),
      BATTLE_HEAL: (m) =>
        t.BATTLE_HEAL({
          targetName: r.battleActor(m.targetId),
          amount: m.amount,
        }),
      BATTLE_MISS: (m) =>
        t.BATTLE_MISS({
          actorName: r.battleActor(m.actorId),
          targetName: r.battleActor(m.targetId),
        }),
      BATTLE_CRITICAL: (m) =>
        t.BATTLE_CRITICAL({
          actorName: r.battleActor(m.actorId),
          targetName: r.battleActor(m.targetId),
          damage: m.damage,
        }),
      BATTLE_EFFECT_APPLIED: (m) => {
        const targetName = r.battleActor(m.targetId)
        const effectName = resolveBattleEffectName(m.effect, content, r)
        return t.BATTLE_EFFECT_APPLIED({
          targetName,
          effectName,
          effect: m.effect,
        })
      },
      BATTLE_EFFECTS_REMOVED: (m) => {
        const targetName = r.battleActor(m.targetId)
        const effectName = resolveBattleEffectRemovalName(m.removal, content, r)
        return t.BATTLE_EFFECTS_REMOVED({
          targetName,
          effectName,
          removal: m.removal,
        })
      },
      BATTLE_DEATH: (m) =>
        t.BATTLE_DEATH({ targetName: r.battleActor(m.targetId) }),

      CRAFTED_ITEM: (m) => t.CRAFTED_ITEM({ recipeName: r.recipe(m.recipeId) }),
      LEFT_CRAFTING: () => t.LEFT_CRAFTING(),

      QUEST_COMPLETED: (m) =>
        t.QUEST_COMPLETED({ questName: r.quest(m.questId) }),
      QUEST_CHAIN_UNLOCKED: (m) =>
        t.QUEST_CHAIN_UNLOCKED({ questName: r.quest(m.questId) }),
      QUEST_REWARD_ITEM: (m) =>
        t.QUEST_REWARD_ITEM({
          itemName: resolveContentName(content.items, m.itemId) ?? m.itemId,
          quantity: m.quantity,
        }),

      LEVEL_UP_POINTS_GRANTED: (m) =>
        t.LEVEL_UP_POINTS_GRANTED({ points: m.points }),
      LEVEL_UP: (m) => t.LEVEL_UP({ level: m.level }),
      ABILITY_LEARNED: (m) =>
        t.ABILITY_LEARNED({ abilityName: r.ability(m.abilityId) }),

      AFFINITY_LEVEL_CHANGED: (m) =>
        t.AFFINITY_LEVEL_CHANGED({
          npcName: r.npc(m.npcId),
          levelName: r.affinityLevel(m.level),
        }),
    }
  }
}

function createInternalResolvers(
  overrides?: Partial<WizEngineNameResolvers>
): InternalResolvers {
  return ownFunctionTable(
    {
      season: (id) => overrides?.season?.(id) ?? id,
      shop: (id) => overrides?.shop?.(id) ?? id,
      shopHint: (reference) =>
        overrides?.shopHint?.(reference) ??
        `${reference.shopId}:${reference.topicId}`,
      innPlan: (id) => overrides?.innPlan?.(id) ?? id,
      npc: (id) => overrides?.npc?.(id) ?? id,
      area: (id) => overrides?.area?.(id) ?? id,
      monster: (id) => overrides?.monster?.(id) ?? id,
      quest: (id) => overrides?.quest?.(id) ?? id,
      recipe: (id) => overrides?.recipe?.(id) ?? id,
      ability: (id) => overrides?.ability?.(id) ?? id,
      facility: (id) => overrides?.facility?.(id) ?? id,
      affinityLevel: (id) => overrides?.affinityLevel?.(id) ?? id,
      battleActor: (id) => overrides?.battleActor?.(id) ?? id,
      battleItem: (id) => overrides?.battleItem?.(id) ?? id,
      battleEffect: (id) => overrides?.battleEffect?.(id) ?? id,
      battleEffectScope: (scope) =>
        overrides?.battleEffectScope?.(scope) ?? scope,
    },
    "Internal message resolvers"
  )
}

function resolveBattleEffectName(
  effect: WizBattleEffectReference,
  content: WizEngineMessageContent,
  resolvers: InternalResolvers
): string {
  if (effect.source === "ability") {
    return resolvers.ability(effect.abilityId)
  }
  if (effect.source === "item") {
    return (
      resolveContentName(content.items, effect.itemId) ??
      resolvers.battleItem(effect.itemId)
    )
  }
  return resolvers.battleEffect(effect.effectType)
}

function resolveBattleEffectRemovalName(
  removal: WizBattleEffectRemoval,
  content: WizEngineMessageContent,
  resolvers: InternalResolvers
): string {
  if (removal.scope === "all") {
    return resolvers.battleEffectScope("all")
  }
  return resolveBattleEffectName(removal.effect, content, resolvers)
}

Object.freeze(WizEngineMessageFormatter.prototype)
Object.freeze(WizEngineMessageFormatter)
