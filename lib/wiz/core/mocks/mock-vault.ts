import type { WizContentArea } from "@/lib/wiz/core/definition/area/area"
import type { WizContentEvent } from "@/lib/wiz/core/definition/event/event"
import type { WizContentMonster } from "@/lib/wiz/core/definition/monster/monster"
import type { WizContentNpc } from "@/lib/wiz/core/definition/npc/npc"
import type { WizContentQuest } from "@/lib/wiz/core/definition/quest/quest"
import { WorldContent } from "@/lib/wiz/core/content/world-content"
import type { WizContext } from "@/lib/wiz/core/context"
import { WizEngineShopDialogueService } from "@/lib/wiz/core/engine/shop/wiz-shop-scene-dialogue-service"
import type { WizDeepReadonly } from "@/lib/wiz/core/immutable-value"
import { toVillageScene } from "@/lib/wiz/core/runtime/to-village-scene"
import { WizVaultFactory } from "@/lib/wiz/core/vault/factory/factory"
import type { WizVaultValue } from "@/lib/wiz/core/vault/value"

const MOCK_MONSTERS = [
  {
    id: "slime",
    name: "スライム",
    hp: 12,
    attack: 3,
    defense: 1,
    agility: 4,
    expReward: 5,
    goldReward: 2,
    drops: [],
  },
  {
    id: "goblin",
    name: "ゴブリン",
    hp: 20,
    attack: 5,
    defense: 2,
    agility: 8,
    expReward: 10,
    goldReward: 5,
    drops: [{ itemId: "herb", chance: 30 }],
  },
  {
    id: "wolf",
    name: "オオカミ",
    hp: 25,
    attack: 7,
    defense: 3,
    agility: 12,
    expReward: 15,
    goldReward: 8,
    drops: [],
  },
] as const satisfies readonly WizDeepReadonly<WizContentMonster>[]

const MOCK_EVENTS = [
  {
    id: "found_herbs",
    description: "薬草を見つけた",
    choices: [
      {
        label: "採取する",
        stat: "dexterity",
        difficulty: 3,
        successText: "薬草を採取した!",
        failText: "うまく採れなかった",
        successReward: { items: [{ itemId: "herb", quantity: 1 }] },
      },
    ],
  },
] as const satisfies readonly WizDeepReadonly<WizContentEvent>[]

const MOCK_AREAS = [
  {
    id: "forest",
    name: "森",
    description: "静かな森",
    dangerLevel: 1,
    apCost: 1,
    unlocked: true,
    monsterIds: ["goblin", "wolf"],
    eventIds: ["found_herbs"],
    availableGathering: ["herb"],
  },
  {
    id: "cave",
    name: "洞窟",
    description: "暗い洞窟",
    dangerLevel: 2,
    apCost: 2,
    unlocked: false,
    unlockCondition: { areaId: "forest", requiredProgress: 100 },
    monsterIds: [],
    eventIds: [],
    availableGathering: [],
  },
  {
    id: "road",
    name: "街道",
    description: "村への道",
    dangerLevel: 1,
    apCost: 1,
    unlocked: true,
    monsterIds: ["wolf"],
    eventIds: [],
    availableGathering: [],
  },
] as const satisfies readonly WizDeepReadonly<WizContentArea>[]

const MOCK_NPCS = [
  {
    id: "elda",
    name: "エルダ",
    occupation: "薬師",
    personality: "優しい",
    initialAffinity: 0,
    likes: ["herb"],
    dislikes: [],
    dialogues: [
      {
        id: "elda_greeting",
        minAffinity: 0,
        lines: ["いらっしゃい。", "何かお探し?"],
      },
    ],
  },
  {
    id: "gald",
    name: "ガルド",
    occupation: "冒険者ギルド長",
    personality: "厳格",
    initialAffinity: 0,
    likes: [],
    dislikes: [],
    dialogues: [
      {
        id: "gald_greeting",
        minAffinity: 0,
        lines: ["依頼を探しているのか?"],
      },
    ],
  },
] as const satisfies readonly WizDeepReadonly<WizContentNpc>[]

const MOCK_QUESTS = [
  {
    id: "gather_herbs",
    name: "薬草を集めて",
    description: "エルダに薬草を届ける",
    giverNpcId: "elda",
    objective: { type: "gather" as const, itemId: "herb", count: 3 },
    reward: { exp: 50, gold: 30, affinityBonus: 5 },
  },
  {
    id: "defeat_goblins",
    name: "ゴブリン退治",
    description: "森のゴブリンを倒す",
    giverNpcId: "elda",
    objective: { type: "defeat" as const, monsterId: "goblin", count: 3 },
    reward: { exp: 100, gold: 50, affinityBonus: 10 },
  },
  {
    id: "quest_slime_hunt",
    name: "スライム退治",
    description: "街道に出没するスライムを3匹退治してほしい。",
    giverNpcId: "elda",
    objective: { type: "defeat" as const, monsterId: "slime", count: 3 },
    reward: { gold: 50, exp: 30, affinityBonus: 5 },
  },
  {
    id: "quest_herb_gather",
    name: "薬草集め",
    description: "傷薬の材料になる薬草を5つ集めてきてほしい。",
    giverNpcId: "elda",
    objective: { type: "gather" as const, itemId: "herb", count: 5 },
    reward: { gold: 30, exp: 20, affinityBonus: 3 },
  },
  {
    id: "quest_explore_forest",
    name: "森林調査",
    description: "森林を50%以上探索して、様子を報告してほしい。",
    giverNpcId: "gald",
    objective: {
      type: "explore" as const,
      areaId: "forest",
      requiredProgress: 50,
    },
    reward: { gold: 100, exp: 50, affinityBonus: 10 },
  },
] as const satisfies readonly WizDeepReadonly<WizContentQuest>[]

const factory = new WizVaultFactory({
  monsters: MOCK_MONSTERS,
  events: MOCK_EVENTS,
  areas: MOCK_AREAS,
  npcs: MOCK_NPCS,
  quests: MOCK_QUESTS,
  equipmentSlotIds: ["mainHand", "body"],
})

export const MOCK_VAULT: WizVaultValue = factory.createInitialVault()

export const MOCK_INITIAL_STATE = toVillageScene(MOCK_VAULT)

const MOCK_ITEMS = [
  {
    id: "herb",
    name: "薬草",
    description: "HP回復",
    itemType: "consumable",
    price: 10,
    sellPrice: 5,
    effect: { type: "heal", value: 20 },
  },
  {
    id: "potion",
    name: "回復薬",
    description: "HPを15回復する",
    itemType: "consumable",
    price: 20,
    sellPrice: 10,
    effect: { type: "heal", value: 15 },
  },
  {
    id: "high_potion",
    name: "上質な回復薬",
    description: "HPを40回復する",
    itemType: "consumable",
    price: 50,
    sellPrice: 25,
    effect: { type: "heal", value: 40 },
  },
  {
    id: "bread",
    name: "パン",
    description: "空腹回復",
    itemType: "consumable",
    price: 5,
    sellPrice: 2,
    effect: { type: "food", hungerRestore: 20 },
  },
  {
    id: "antidote",
    name: "解毒薬",
    description: "毒を治す",
    itemType: "consumable",
    price: 15,
    sellPrice: 7,
    effect: { type: "cure", effectId: "poison" },
  },
  {
    id: "rare_herb",
    name: "珍しい薬草",
    description: "希少な薬草",
    itemType: "material",
    price: 30,
    sellPrice: 15,
  },
  {
    id: "honey",
    name: "蜂蜜",
    description: "甘い蜂蜜",
    itemType: "material",
    price: 20,
    sellPrice: 10,
  },
] as const

const MOCK_WEAPONS = [
  {
    id: "wooden_sword",
    name: "木の剣",
    description: "初心者用の剣",
    attack: 5,
    dexterityBonus: 0,
    slotId: "mainHand",
    price: 50,
    sellPrice: 25,
  },
  {
    id: "iron_sword",
    name: "鉄の剣",
    description: "鉄製の剣",
    attack: 12,
    dexterityBonus: 1,
    slotId: "mainHand",
    price: 200,
    sellPrice: 100,
  },
] as const

const MOCK_ARMORS = [
  {
    id: "leather_armor",
    name: "革の鎧",
    description: "革製の鎧",
    defense: 3,
    agilityPenalty: 0,
    slotId: "body",
    price: 80,
    sellPrice: 40,
  },
  {
    id: "cloth_robe",
    name: "布のローブ",
    description: "軽い防具",
    defense: 1,
    agilityPenalty: 0,
    slotId: "body",
    price: 30,
    sellPrice: 15,
  },
] as const

const MOCK_RECIPES = [
  {
    id: "potion",
    name: "回復薬",
    description: "薬草から作る",
    difficulty: 6,
    materials: [{ type: "item" as const, itemId: "herb", quantity: 2 }],
    result: { type: "item" as const, itemId: "potion" },
  },
  {
    id: "high_potion",
    name: "上質な回復薬",
    description: "薬草から作る上質な薬",
    difficulty: 10,
    materials: [{ type: "item" as const, itemId: "herb", quantity: 5 }],
    result: { type: "item" as const, itemId: "high_potion" },
  },
  {
    id: "super_potion",
    name: "特効薬",
    description: "珍しい薬草から作る特効薬",
    difficulty: 12,
    requiresFacility: "alchemy",
    materials: [
      { type: "item" as const, itemId: "rare_herb", quantity: 3 },
      { type: "item" as const, itemId: "honey", quantity: 1 },
    ],
    result: { type: "item" as const, itemId: "high_potion" },
  },
] as const

export const MOCK_CONTENT = WorldContent.create({
  areas: MOCK_AREAS,
  events: MOCK_EVENTS,
  items: MOCK_ITEMS,
  monsters: MOCK_MONSTERS,
  npcs: MOCK_NPCS,
  quests: MOCK_QUESTS,
  weapons: MOCK_WEAPONS,
  armors: MOCK_ARMORS,
  recipes: MOCK_RECIPES,
  facilities: [
    {
      facilityId: "alchemy",
      type: "area_progress",
      areaId: "forest",
      requiredProgress: 50,
    },
  ],
  innPlans: [
    {
      id: "basic",
      price: 20,
      hpRecovery: { fixed: 30 },
      apRecovery: "full",
    },
    {
      id: "meal",
      price: 50,
      hpRecovery: { fixed: 50 },
      mpRecovery: { fixed: 10 },
      hungerRecovery: 50,
      apRecovery: "full",
    },
    {
      id: "deluxe",
      price: 100,
      hpRecovery: { percent: 100 },
      mpRecovery: { percent: 100 },
      hungerRecovery: 100,
      apRecovery: "full",
    },
  ],
})

export const MOCK_CONTEXT: WizContext = Object.freeze({
  initialVault: MOCK_VAULT,
  initialWorldState: MOCK_INITIAL_STATE,
})

const MOCK_SHOP_DIALOGUES = [
  {
    shopId: "item_shop",
    shopkeeperName: "道具屋の主人",
    greeting: "いらっしゃい!",
    products: {
      itemIds: MOCK_ITEMS.map((item) => item.id),
      weaponIds: [],
      armorIds: [],
    },
    topics: [
      {
        id: "about_shop",
        label: "この店について",
        lines: [
          { speaker: "shopkeeper", text: "うちは道具屋だよ。" },
          { speaker: "shopkeeper", text: "何でも揃ってるよ。" },
        ],
      },
      {
        id: "village_news",
        label: "村の噂",
        lines: [
          {
            speaker: "shopkeeper",
            text: "最近、森でモンスターが増えているらしい。",
          },
          { speaker: "shopkeeper", text: "気をつけたほうがいいよ。" },
        ],
        effects: { setFlag: "heard_forest_rumor" },
      },
      {
        id: "herb_gathering",
        label: "薬草について",
        lines: [
          { speaker: "shopkeeper", text: "森で薬草が採れるよ。" },
          { speaker: "shopkeeper", text: "探索してみるといい。" },
        ],
        effects: { giveHint: "森で薬草が採れる" },
      },
    ],
  },
  {
    shopId: "weapon_shop",
    shopkeeperName: "武器屋の主人",
    greeting: "いい武器があるぞ!",
    products: {
      itemIds: [],
      weaponIds: MOCK_WEAPONS.map((weapon) => weapon.id),
      armorIds: [],
    },
    topics: [],
  },
  {
    shopId: "armor_shop",
    shopkeeperName: "防具屋の主人",
    greeting: "防具はいかが?",
    products: {
      itemIds: [],
      weaponIds: [],
      armorIds: MOCK_ARMORS.map((armor) => armor.id),
    },
    topics: [],
  },
]

export const MOCK_SHOP_DIALOGUE_SERVICE = new WizEngineShopDialogueService(
  MOCK_SHOP_DIALOGUES
)
