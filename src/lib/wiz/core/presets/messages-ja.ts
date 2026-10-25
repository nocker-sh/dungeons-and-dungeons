import type { WizGiftReaction } from "@/lib/wiz/core/engine/conversation/affinity-system"
import type { WizEngineMessageTemplates } from "@/lib/wiz/core/engine/message/wiz-message-formatter"
import { formatWizItemEffectEventsJa } from "@/lib/wiz/core/engine/inventory/wiz-item-effect-message-ja"
import type { WizSceneConversationHistoryEntry } from "@/lib/wiz/core/runtime/scenes/conversation/types"
import type { WizSceneCraftingMessage } from "@/lib/wiz/core/runtime/scenes/crafting/state"
import type {
  WizBattleEffectReference,
  WizBattleEffectRemoval,
} from "@/lib/wiz/core/types/wiz-log-message"
import type { WizStandardAffinityLevel } from "@/lib/wiz/core/config/conversation/wiz-conversation-config"

export const WIZ_AFFINITY_LEVEL_NAMES_JA: Readonly<Record<WizStandardAffinityLevel, string>> =
  Object.freeze({
    stranger: "見知らぬ人",
    acquaintance: "知り合い",
    friend: "友人",
    close_friend: "親友",
    best_friend: "無二の親友",
  })

export const WIZ_FACILITY_NAMES_JA: Readonly<Record<string, string>> = Object.freeze({
  blacksmith: "鍛冶場",
  alchemy: "錬金術室",
  magic_tower: "魔塔",
  church: "教会",
})

export const WIZ_BATTLE_EFFECT_NAMES_JA: Readonly<Record<string, string>> = Object.freeze({
  poison: "毒",
  paralysis: "麻痺",
  sleep: "睡眠",
  silence: "沈黙",
  confusion: "混乱",
  blind: "暗闇",
  dead: "戦闘不能",
  fled: "逃走",
  defending: "防御",
  attackUp: "攻撃力上昇",
  attackDown: "攻撃力低下",
  defenseUp: "防御力上昇",
  defenseDown: "防御力低下",
  speedUp: "速度上昇",
  speedDown: "速度低下",
})

function formatWizBattleEffectNameJa(
  effect: WizBattleEffectReference,
  fallbackName: string,
): string {
  if (effect.source !== "system") {
    return fallbackName
  }
  return WIZ_BATTLE_EFFECT_NAMES_JA[effect.effectType] ?? fallbackName
}

function formatWizBattleEffectRemovalNameJa(
  removal: WizBattleEffectRemoval,
  fallbackName: string,
): string {
  if (removal.scope === "all") {
    return "全ての状態効果"
  }
  return formatWizBattleEffectNameJa(removal.effect, fallbackName)
}

export function formatWizGiftReactionJa(reaction: WizGiftReaction): string {
  if (reaction === "love") return "わあ、大好き! ありがとう!"
  if (reaction === "dislike") return "うーん...これは..."
  return "ありがとう。"
}

export type WizConversationHistoryPresentationJa = Readonly<{
  speaker: string
  text: string
}>

export type WizConversationHistoryPresentationJaOptions = Readonly<{
  npcName: string
  resolveItemName?: (itemId: string) => string | undefined
  resolveNpcSpeakerName?: (sourceSpeaker: string) => string | undefined
  playerName?: string
  narratorName?: string
}>

export function formatWizConversationHistoryEntryJa(
  entry: WizSceneConversationHistoryEntry,
  options: WizConversationHistoryPresentationJaOptions,
): WizConversationHistoryPresentationJa {
  if (entry.type === "gift_presented") {
    const itemName = options.resolveItemName?.(entry.itemId) ?? "アイテム"
    return Object.freeze({
      speaker: options.playerName ?? "あなた",
      text: `${itemName}をプレゼントした`,
    })
  }

  if (entry.type === "gift_reaction") {
    return Object.freeze({
      speaker: options.npcName,
      text: formatWizGiftReactionJa(entry.reaction),
    })
  }

  const speaker =
    entry.speaker === "player"
      ? (options.playerName ?? "あなた")
      : entry.speaker === "narrator"
        ? (options.narratorName ?? "語り手")
        : ((entry.sourceSpeaker
            ? options.resolveNpcSpeakerName?.(entry.sourceSpeaker)
            : undefined) ?? options.npcName)

  return Object.freeze({ speaker, text: entry.text })
}

export type WizCraftingMessageJaResolvers = Readonly<{
  recipe?: (recipeId: string) => string | undefined
}>

export function formatWizCraftingMessageJa(
  message: WizSceneCraftingMessage,
  resolvers: WizCraftingMessageJaResolvers = {},
): string {
  if (message.type === "missing_facility") return "必要な施設がない..."
  if (message.type === "missing_materials") return "素材が足りない..."
  if (message.type === "craft_failed") return "製作に失敗した... 素材を失った"

  const recipeName = resolvers.recipe?.(message.recipeId) ?? message.recipeId
  const qualityText = message.quality === "high" ? "会心の出来!" : ""
  return `${recipeName}の製作に成功! ${qualityText}`
}

/**
 * 意味ログだけを表示する、不変な日本語template。
 *
 * 利用側はこの値を展開して一部または全部を上書きできる。
 */
export const DEFAULT_MESSAGES_JA: WizEngineMessageTemplates = Object.freeze({
  // System
  WORLD_STARTED: () => "新しい冒険が始まった!",
  SEASON_CHANGED: (p) => `季節が${p.seasonName}に変わった。`,
  HUNGER_DAMAGE: () => "空腹でHPが減少している...",
  AREA_UNLOCKED: (p) => `新しいエリア「${p.areaName}」が開放された!`,

  // Inventory
  ITEM_EFFECT_APPLIED: (p) => `${p.itemName}を使った。${formatWizItemEffectEventsJa(p.events)}`,
  EQUIPPED_WEAPON: (p) => `${p.weaponName}を装備した。`,
  EQUIPPED_ARMOR: (p) => `${p.armorName}を装備した。`,
  UNEQUIPPED_WEAPON: () => "武器を外した。",
  UNEQUIPPED_ARMOR: () => "防具を外した。",

  // Village
  ENTERED_SHOP: (p) => `${p.shopName}に入った。`,
  ENTERED_INN: () => "宿屋に入った。",
  NOT_ENOUGH_AP: () => "APが足りない...",
  ENTERED_AREA: (p) => `${p.areaName}に向かった。`,
  TALKED_TO_NPC: (p) => `${p.npcName}に話しかけた。`,

  // Shop
  PURCHASED_ITEM: (p) => `${p.itemName}を${p.price}Gで購入した。`,
  PURCHASED_WEAPON: (p) => `${p.weaponName}を${p.price}Gで購入した。`,
  PURCHASED_ARMOR: (p) => `${p.armorName}を${p.price}Gで購入した。`,
  SOLD_ITEM: (p) => `${p.itemName}を${p.price}Gで売却した。`,
  LEFT_SHOP: () => "店を出た。",
  HINT_DISCOVERED: (p) => `ヒント: ${p.hint}`,

  // Inn
  INN_RESTED: (p) => `${p.planName}で休んだ。翌朝になった。`,
  INN_NOT_ENOUGH_GOLD: (p) => `${p.planName}に泊まる金がない。あと${p.required}G必要だ。`,
  LEFT_INN: () => "宿屋を出た。",

  // Exploration
  RETURNED_TO_VILLAGE: () => "村に戻った。",
  DISCOVERED_MONSTER: (p) => `${p.monsterName}を発見した!`,
  ENCOUNTER_MONSTERS: (p) => `${p.monsterNames}が現れた!`,
  GATHERED_ITEM: (p) => `${p.itemName}を採集した!`,
  EXPLORED_AREA: () => "探索を進めた。",
  EVENT_RESOLVED: (p) =>
    p.succeeded ? "探索中の出来事をうまく切り抜けた!" : "探索中の出来事で失敗した...",
  RESTED: (p) => `休憩してAPが${p.apRecovered}回復した。`,
  NO_GATHERING_AVAILABLE: () => "このエリアでは採集できるものがない。",
  NO_MONSTERS_AVAILABLE: () => "このエリアにモンスターはいない。",
  FACILITY_UNLOCKED: (p) => `施設「${p.facilityName}」が利用可能になった!`,

  // Battle - Scene
  BATTLE_START: () => "戦闘開始!",
  FLED_BATTLE: () => "逃げ出した!",
  FLED_SUCCESS: () => "逃走に成功した!",
  ACTOR_CANNOT_ACT: (p) => `${p.actorName}は行動できない。`,
  BATTLE_VICTORY: (p) => `勝利! 経験値+${p.exp} ゴールド+${p.gold}`,
  BATTLE_DEFEAT: () => "全滅した...",
  TURN_START: (p) => `ターン ${p.turnNumber} 開始`,

  // Battle - Actions
  BATTLE_ATTACK: (p) => `${p.actorName}の攻撃! → ${p.targetName}`,
  BATTLE_ABILITY: (p) => `${p.actorName}の${p.abilityName}! → ${p.targetName}`,
  BATTLE_DEFEND: (p) => `${p.actorName}は防御した`,
  BATTLE_ITEM: (p) => `${p.actorName}は${p.itemName}を使った → ${p.targetName}`,
  BATTLE_FLEE: (p) => `${p.actorName}は逃げようとしている...`,
  BATTLE_FLEE_SUCCESS: (p) => `${p.actorName}は逃げ出した!`,
  BATTLE_FLEE_FAILED: (p) => `${p.actorName}は逃げられなかった!`,

  // Battle - Results
  BATTLE_DAMAGE: (p) => `${p.targetName}に${p.damage}のダメージ!`,
  BATTLE_HEAL: (p) => `${p.targetName}のHPが${p.amount}回復した`,
  BATTLE_MISS: (p) => `${p.actorName}の攻撃は${p.targetName}に当たらなかった`,
  BATTLE_CRITICAL: (p) => `クリティカルヒット! ${p.targetName}に${p.damage}のダメージ!`,
  BATTLE_EFFECT_APPLIED: (p) =>
    `${p.targetName}に${formatWizBattleEffectNameJa(p.effect, p.effectName)}の効果が付与された`,
  BATTLE_EFFECTS_REMOVED: (p) =>
    `${p.targetName}の${formatWizBattleEffectRemovalNameJa(p.removal, p.effectName)}が解除された`,
  BATTLE_DEATH: (p) => `${p.targetName}は倒れた!`,

  // Crafting
  CRAFTED_ITEM: (p) => `${p.recipeName}を作成した!`,
  LEFT_CRAFTING: () => "製作場を離れた。",

  // Quest
  QUEST_COMPLETED: (p) => `${p.questName}を完了した!`,
  QUEST_CHAIN_UNLOCKED: (p) => `新しい依頼「${p.questName}」が解放された!`,
  QUEST_REWARD_ITEM: (p) => `報酬: ${p.itemName} x${p.quantity} を入手した!`,

  // Level Up
  LEVEL_UP_POINTS_GRANTED: (p) => `レベルアップ! 能力値ポイントを${p.points}獲得!`,
  LEVEL_UP: (p) => `レベル${p.level}になった!`,
  ABILITY_LEARNED: (p) => `新しいスキル「${p.abilityName}」を習得した!`,

  // NPC
  AFFINITY_LEVEL_CHANGED: (p) => `${p.npcName}との関係が「${p.levelName}」になった!`,
} satisfies WizEngineMessageTemplates)

/**
 * メッセージテンプレートを作成
 *
 * デフォルトの日本語テンプレートに、カスタムテンプレートをマージする。
 */
export function createMessageTemplates(
  overrides?: Partial<WizEngineMessageTemplates>,
): WizEngineMessageTemplates {
  if (!overrides) return DEFAULT_MESSAGES_JA
  return Object.freeze({ ...DEFAULT_MESSAGES_JA, ...overrides })
}
