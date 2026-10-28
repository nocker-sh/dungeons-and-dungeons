import { describe, expect, it } from "vite-plus/test"
import {
  type WizEngineMessageContent,
  WizEngineMessageFormatter,
  type WizEngineMessageTemplates,
  type WizEngineNameResolvers,
} from "@/lib/wiz/core/engine/message/wiz-message-formatter"
import { DEFAULT_MESSAGES_JA } from "@/lib/wiz/core/presets/create-message-templates"
import type { WizLogMessage } from "@/lib/wiz/core/types/wiz-log-message"

const mockContent = Object.freeze({
  items: {
    herb: {
      id: "herb",
      name: "薬草",
      description: "HPを回復する",
      itemType: "consumable",
      price: 10,
      sellPrice: 5,
    },
    potion: {
      id: "potion",
      name: "ポーション",
      description: "HPを大きく回復する",
      itemType: "consumable",
      price: 50,
      sellPrice: 25,
    },
  },
  weapons: {
    sword: {
      id: "sword",
      name: "鉄の剣",
      description: "基本的な剣",
      attack: 10,
      dexterityBonus: 0,
      slotId: "mainHand",
      price: 100,
      sellPrice: 50,
    },
  },
  armors: {
    leather: {
      id: "leather",
      name: "革の鎧",
      description: "基本的な防具",
      defense: 5,
      agilityPenalty: 0,
      slotId: "body",
      price: 80,
      sellPrice: 40,
    },
  },
}) satisfies WizEngineMessageContent

const mockResolvers = {
  season: (s: string) => {
    const map: Record<string, string> = { spring: "春", summer: "夏" }
    return map[s] ?? s
  },
  shop: (s: string) => {
    const map: Record<string, string> = {
      item_shop: "道具屋",
      weapon_shop: "武器屋",
    }
    return map[s] ?? s
  },
  shopHint: ({
    shopId,
    topicId,
  }: Readonly<{ shopId: string; topicId: string }>) => {
    const map: Record<string, string> = {
      "item_shop:forest_treasure": "森の奥に宝箱がある",
    }
    return map[`${shopId}:${topicId}`] ?? `${shopId}:${topicId}`
  },
  innPlan: (s: string) => {
    const map: Record<string, string> = {
      standard: "通常プラン",
      deluxe: "豪華プラン",
    }
    return map[s] ?? s
  },
  npc: (s: string) => {
    const map: Record<string, string> = { elder: "村長", merchant: "商人" }
    return map[s] ?? s
  },
  area: (s: string) => {
    const map: Record<string, string> = { forest: "森", cave: "洞窟" }
    return map[s] ?? s
  },
  monster: (s: string) => {
    const map: Record<string, string> = {
      slime: "スライム",
      goblin: "ゴブリン",
    }
    return map[s] ?? s
  },
  quest: (s: string) => {
    const map: Record<string, string> = { defeat_slime: "スライム討伐" }
    return map[s] ?? s
  },
  recipe: (s: string) => {
    const map: Record<string, string> = { herb_tea: "薬草茶" }
    return map[s] ?? s
  },
  ability: (s: string) => {
    const map: Record<string, string> = {
      heal: "ヒール",
      fireball: "ファイアボール",
    }
    return map[s] ?? s
  },
  facility: (s: string) => {
    const map: Record<string, string> = { alchemy: "錬金術室" }
    return map[s] ?? s
  },
  affinityLevel: (s: string) => {
    const map: Record<string, string> = { friend: "友人" }
    return map[s] ?? s
  },
  battleActor: (s: string) => {
    const map: Record<string, string> = { hero: "勇者", goblin: "ゴブリン" }
    return map[s] ?? s
  },
  battleItem: (s: string) => {
    const map: Record<string, string> = { potion: "ポーション" }
    return map[s] ?? s
  },
}

describe("content ownership", () => {
  it("構築元recordとentryの変更から表示名を所有分離する", () => {
    const item = { name: "Original" }
    const items: Record<string, { name: string }> = { potion: item }
    const formatter = new WizEngineMessageFormatter({
      content: {
        items,
        weapons: {},
        armors: {},
      },
      templates: DEFAULT_MESSAGES_JA,
    })
    item.name = "Changed"
    items.potion = { name: "Replaced" }

    expect(
      formatter.format({
        key: "PURCHASED_ITEM",
        itemId: "potion",
        price: 10,
      })
    ).toBe("Originalを10Gで購入した。")
  })

  it("inherited propertyをcontent IDとして解決しない", () => {
    const formatter = new WizEngineMessageFormatter({
      content: {
        items: {},
        weapons: {},
        armors: {},
      },
      templates: DEFAULT_MESSAGES_JA,
    })

    expect(
      formatter.format({
        key: "PURCHASED_ITEM",
        itemId: "toString",
        price: 10,
      })
    ).toBe("toStringを10Gで購入した。")
  })
})

describe("format() - System messages", () => {
  const formatter = new WizEngineMessageFormatter({
    content: mockContent,
    templates: DEFAULT_MESSAGES_JA,
    resolvers: mockResolvers,
  })

  it("WORLD_STARTED をフォーマットできる", () => {
    const msg: WizLogMessage = { key: "WORLD_STARTED" }

    const result = formatter.format(msg)

    expect(result).toBe("新しい冒険が始まった!")
  })

  it("SEASON_CHANGED をフォーマットできる", () => {
    const msg: WizLogMessage = { key: "SEASON_CHANGED", season: "spring" }

    const result = formatter.format(msg)

    expect(result).toBe("季節が春に変わった。")
  })

  it("HUNGER_DAMAGE をフォーマットできる", () => {
    const msg: WizLogMessage = { key: "HUNGER_DAMAGE" }

    const result = formatter.format(msg)

    expect(result).toBe("空腹でHPが減少している...")
  })

  it("AREA_UNLOCKED をフォーマットできる", () => {
    const msg: WizLogMessage = { key: "AREA_UNLOCKED", areaId: "forest" }

    const result = formatter.format(msg)

    expect(result).toBe("新しいエリア「森」が開放された!")
  })
})

describe("format() - Inventory messages", () => {
  const formatter = new WizEngineMessageFormatter({
    content: mockContent,
    templates: DEFAULT_MESSAGES_JA,
    resolvers: mockResolvers,
  })

  it("ITEM_EFFECT_APPLIED の意味イベントを日本語へ整形する", () => {
    const msg: WizLogMessage = {
      key: "ITEM_EFFECT_APPLIED",
      itemId: "herb",
      events: [{ type: "mp_restored", amount: 8 }],
    }

    const result = formatter.format(msg)

    expect(result).toBe("薬草を使った。MPが8回復した")
  })

  it("EQUIPPED_WEAPON をフォーマットできる", () => {
    const msg: WizLogMessage = {
      key: "EQUIPPED_WEAPON",
      weaponId: "sword",
    }

    const result = formatter.format(msg)

    expect(result).toBe("鉄の剣を装備した。")
  })

  it("EQUIPPED_WEAPON で未知の weaponId はそのまま表示", () => {
    const msg: WizLogMessage = {
      key: "EQUIPPED_WEAPON",
      weaponId: "unknown_weapon",
    }

    const result = formatter.format(msg)

    expect(result).toBe("unknown_weaponを装備した。")
  })

  it("EQUIPPED_ARMOR をフォーマットできる", () => {
    const msg: WizLogMessage = {
      key: "EQUIPPED_ARMOR",
      armorId: "leather",
    }

    const result = formatter.format(msg)

    expect(result).toBe("革の鎧を装備した。")
  })

  it("EQUIPPED_ARMOR で未知の armorId はそのまま表示", () => {
    const msg: WizLogMessage = {
      key: "EQUIPPED_ARMOR",
      armorId: "unknown_armor",
    }

    const result = formatter.format(msg)

    expect(result).toBe("unknown_armorを装備した。")
  })

  it("UNEQUIPPED_WEAPON をフォーマットできる", () => {
    const msg: WizLogMessage = { key: "UNEQUIPPED_WEAPON" }

    const result = formatter.format(msg)

    expect(result).toBe("武器を外した。")
  })

  it("UNEQUIPPED_ARMOR をフォーマットできる", () => {
    const msg: WizLogMessage = { key: "UNEQUIPPED_ARMOR" }

    const result = formatter.format(msg)

    expect(result).toBe("防具を外した。")
  })
})

describe("format() - Village messages", () => {
  const formatter = new WizEngineMessageFormatter({
    content: mockContent,
    templates: DEFAULT_MESSAGES_JA,
    resolvers: mockResolvers,
  })

  it("ENTERED_SHOP をフォーマットできる", () => {
    const msg: WizLogMessage = { key: "ENTERED_SHOP", shopId: "item_shop" }

    const result = formatter.format(msg)

    expect(result).toBe("道具屋に入った。")
  })

  it("ENTERED_INN をフォーマットできる", () => {
    const msg: WizLogMessage = { key: "ENTERED_INN" }

    const result = formatter.format(msg)

    expect(result).toBe("宿屋に入った。")
  })

  it("NOT_ENOUGH_AP をフォーマットできる", () => {
    const msg: WizLogMessage = { key: "NOT_ENOUGH_AP" }

    const result = formatter.format(msg)

    expect(result).toBe("APが足りない...")
  })

  it("ENTERED_AREA をフォーマットできる", () => {
    const msg: WizLogMessage = { key: "ENTERED_AREA", areaId: "cave" }

    const result = formatter.format(msg)

    expect(result).toBe("洞窟に向かった。")
  })

  it("TALKED_TO_NPC をフォーマットできる", () => {
    const msg: WizLogMessage = { key: "TALKED_TO_NPC", npcId: "elder" }

    const result = formatter.format(msg)

    expect(result).toBe("村長に話しかけた。")
  })
})

describe("format() - Shop messages", () => {
  const formatter = new WizEngineMessageFormatter({
    content: mockContent,
    templates: DEFAULT_MESSAGES_JA,
    resolvers: mockResolvers,
  })

  it("PURCHASED_ITEM をフォーマットできる", () => {
    const msg: WizLogMessage = {
      key: "PURCHASED_ITEM",
      itemId: "potion",
      price: 50,
    }

    const result = formatter.format(msg)

    expect(result).toBe("ポーションを50Gで購入した。")
  })

  it("PURCHASED_WEAPON をフォーマットできる", () => {
    const msg: WizLogMessage = {
      key: "PURCHASED_WEAPON",
      weaponId: "sword",
      price: 100,
    }

    const result = formatter.format(msg)

    expect(result).toBe("鉄の剣を100Gで購入した。")
  })

  it("PURCHASED_ARMOR をフォーマットできる", () => {
    const msg: WizLogMessage = {
      key: "PURCHASED_ARMOR",
      armorId: "leather",
      price: 80,
    }

    const result = formatter.format(msg)

    expect(result).toBe("革の鎧を80Gで購入した。")
  })

  it("LEFT_SHOP をフォーマットできる", () => {
    const msg: WizLogMessage = { key: "LEFT_SHOP" }

    const result = formatter.format(msg)

    expect(result).toBe("店を出た。")
  })

  it("HINT_DISCOVERED をshop/topic参照からフォーマットできる", () => {
    const msg: WizLogMessage = {
      key: "HINT_DISCOVERED",
      shopId: "item_shop",
      topicId: "forest_treasure",
    }

    const result = formatter.format(msg)

    expect(result).toBe("ヒント: 森の奥に宝箱がある")
  })
})

describe("format() - Inn messages", () => {
  const formatter = new WizEngineMessageFormatter({
    content: mockContent,
    templates: DEFAULT_MESSAGES_JA,
    resolvers: mockResolvers,
  })

  it("INN_RESTED をフォーマットできる", () => {
    const msg: WizLogMessage = { key: "INN_RESTED", planId: "standard" }

    const result = formatter.format(msg)

    expect(result).toBe("通常プランで休んだ。翌朝になった。")
  })

  it("LEFT_INN をフォーマットできる", () => {
    const msg: WizLogMessage = { key: "LEFT_INN" }

    const result = formatter.format(msg)

    expect(result).toBe("宿屋を出た。")
  })
})

describe("format() - Exploration messages", () => {
  const formatter = new WizEngineMessageFormatter({
    content: mockContent,
    templates: DEFAULT_MESSAGES_JA,
    resolvers: mockResolvers,
  })

  it("RETURNED_TO_VILLAGE をフォーマットできる", () => {
    const msg: WizLogMessage = { key: "RETURNED_TO_VILLAGE" }

    const result = formatter.format(msg)

    expect(result).toBe("村に戻った。")
  })

  it("DISCOVERED_MONSTER をフォーマットできる", () => {
    const msg: WizLogMessage = {
      key: "DISCOVERED_MONSTER",
      monsterId: "slime",
    }

    const result = formatter.format(msg)

    expect(result).toBe("スライムを発見した!")
  })

  it("ENCOUNTER_MONSTERS をフォーマットできる (複数モンスター)", () => {
    const msg: WizLogMessage = {
      key: "ENCOUNTER_MONSTERS",
      monsterIds: ["slime", "goblin"],
    }

    const result = formatter.format(msg)

    expect(result).toBe("スライム, ゴブリンが現れた!")
  })

  it("ENCOUNTER_MONSTERS をフォーマットできる (単体)", () => {
    const msg: WizLogMessage = {
      key: "ENCOUNTER_MONSTERS",
      monsterIds: ["slime"],
    }

    const result = formatter.format(msg)

    expect(result).toBe("スライムが現れた!")
  })

  it("GATHERED_ITEM をフォーマットできる", () => {
    const msg: WizLogMessage = { key: "GATHERED_ITEM", itemId: "herb" }

    const result = formatter.format(msg)

    expect(result).toBe("薬草を採集した!")
  })

  it("EXPLORED_AREA をフォーマットできる", () => {
    const msg: WizLogMessage = { key: "EXPLORED_AREA" }

    const result = formatter.format(msg)

    expect(result).toBe("探索を進めた。")
  })

  it("EVENT_RESOLVED の成否をフォーマットできる", () => {
    expect(
      formatter.format({
        key: "EVENT_RESOLVED",
        eventId: "forest_herbs",
        succeeded: true,
      })
    ).toBe("探索中の出来事をうまく切り抜けた!")
    expect(
      formatter.format({
        key: "EVENT_RESOLVED",
        eventId: "forest_herbs",
        succeeded: false,
      })
    ).toBe("探索中の出来事で失敗した...")
  })

  it("NO_GATHERING_AVAILABLE をフォーマットできる", () => {
    const msg: WizLogMessage = { key: "NO_GATHERING_AVAILABLE" }

    const result = formatter.format(msg)

    expect(result).toBe("このエリアでは採集できるものがない。")
  })

  it("NO_MONSTERS_AVAILABLE をフォーマットできる", () => {
    const msg: WizLogMessage = { key: "NO_MONSTERS_AVAILABLE" }

    const result = formatter.format(msg)

    expect(result).toBe("このエリアにモンスターはいない。")
  })

  it("FACILITY_UNLOCKED は注入されたresolverで表示名を解決する", () => {
    const result = formatter.format({
      key: "FACILITY_UNLOCKED",
      facilityId: "alchemy",
    })

    expect(result).toBe("施設「錬金術室」が利用可能になった!")
  })
})

describe("format() - Battle messages", () => {
  const formatter = new WizEngineMessageFormatter({
    content: mockContent,
    templates: DEFAULT_MESSAGES_JA,
    resolvers: mockResolvers,
  })

  it("BATTLE_START をフォーマットできる", () => {
    const msg: WizLogMessage = { key: "BATTLE_START" }

    const result = formatter.format(msg)

    expect(result).toBe("戦闘開始!")
  })

  it("FLED_BATTLE をフォーマットできる", () => {
    const msg: WizLogMessage = { key: "FLED_BATTLE" }

    const result = formatter.format(msg)

    expect(result).toBe("逃げ出した!")
  })

  it("FLED_SUCCESS をフォーマットできる", () => {
    const msg: WizLogMessage = { key: "FLED_SUCCESS" }

    const result = formatter.format(msg)

    expect(result).toBe("逃走に成功した!")
  })

  it("ACTOR_CANNOT_ACT をフォーマットできる", () => {
    const msg: WizLogMessage = {
      key: "ACTOR_CANNOT_ACT",
      actorId: "hero",
    }

    const result = formatter.format(msg)

    expect(result).toBe("勇者は行動できない。")
  })

  it("BATTLE_VICTORY をフォーマットできる", () => {
    const msg: WizLogMessage = {
      key: "BATTLE_VICTORY",
      exp: 100,
      gold: 50,
    }

    const result = formatter.format(msg)

    expect(result).toBe("勝利! 経験値+100 ゴールド+50")
  })

  it("BATTLE_DEFEAT をフォーマットできる", () => {
    const msg: WizLogMessage = { key: "BATTLE_DEFEAT" }

    const result = formatter.format(msg)

    expect(result).toBe("全滅した...")
  })

  it("TURN_START をフォーマットできる", () => {
    const msg: WizLogMessage = { key: "TURN_START", turnNumber: 3 }

    const result = formatter.format(msg)

    expect(result).toBe("ターン 3 開始")
  })

  it("canonicalな戦闘IDをresolverで表示名へ変換する", () => {
    const messages: readonly WizLogMessage[] = [
      { key: "BATTLE_ATTACK", actorId: "hero", targetId: "goblin" },
      {
        key: "BATTLE_ABILITY",
        actorId: "hero",
        abilityId: "fireball",
        targetId: "goblin",
      },
      { key: "BATTLE_DEFEND", actorId: "hero" },
      {
        key: "BATTLE_ITEM",
        actorId: "hero",
        itemId: "potion",
        targetId: "hero",
      },
      { key: "BATTLE_FLEE", actorId: "hero" },
      { key: "BATTLE_FLEE_SUCCESS", actorId: "hero" },
      { key: "BATTLE_FLEE_FAILED", actorId: "hero" },
      { key: "BATTLE_DAMAGE", targetId: "goblin", damage: 12 },
      { key: "BATTLE_HEAL", targetId: "hero", amount: 8 },
      { key: "BATTLE_MISS", actorId: "hero", targetId: "goblin" },
      {
        key: "BATTLE_CRITICAL",
        actorId: "hero",
        targetId: "goblin",
        damage: 20,
      },
      { key: "BATTLE_DEATH", targetId: "goblin" },
    ]

    expect(formatter.formatAll(messages)).toEqual([
      "勇者の攻撃! → ゴブリン",
      "勇者のファイアボール! → ゴブリン",
      "勇者は防御した",
      "勇者はポーションを使った → 勇者",
      "勇者は逃げようとしている...",
      "勇者は逃げ出した!",
      "勇者は逃げられなかった!",
      "ゴブリンに12のダメージ!",
      "勇者のHPが8回復した",
      "勇者の攻撃はゴブリンに当たらなかった",
      "クリティカルヒット! ゴブリンに20のダメージ!",
      "ゴブリンは倒れた!",
    ])
  })

  it("semanticな組み込み効果IDを日本語表示へ変換する", () => {
    const msg: WizLogMessage = {
      key: "BATTLE_EFFECT_APPLIED",
      targetId: "hero",
      effect: {
        source: "system",
        effectType: "defending",
      },
    }

    expect(formatter.format(msg)).toBe("勇者に防御の効果が付与された")
  })

  it("semanticなskill参照をresolverで表示名へ変換する", () => {
    const msg: WizLogMessage = {
      key: "BATTLE_EFFECT_APPLIED",
      targetId: "goblin",
      effect: {
        source: "ability",
        abilityId: "fireball",
        effectType: "attackDown",
      },
    }

    expect(formatter.format(msg)).toBe(
      "ゴブリンにファイアボールの効果が付与された"
    )
  })

  it("semanticな全効果解除scopeを日本語表示へ変換する", () => {
    const msg: WizLogMessage = {
      key: "BATTLE_EFFECTS_REMOVED",
      targetId: "hero",
      removal: { scope: "all" },
    }

    expect(formatter.format(msg)).toBe("勇者の全ての状態効果が解除された")
  })
})

describe("format() - Crafting messages", () => {
  const formatter = new WizEngineMessageFormatter({
    content: mockContent,
    templates: DEFAULT_MESSAGES_JA,
    resolvers: mockResolvers,
  })

  it("CRAFTED_ITEM をフォーマットできる", () => {
    const msg: WizLogMessage = {
      key: "CRAFTED_ITEM",
      recipeId: "herb_tea",
    }

    const result = formatter.format(msg)

    expect(result).toBe("薬草茶を作成した!")
  })

  it("LEFT_CRAFTING をフォーマットできる", () => {
    const msg: WizLogMessage = { key: "LEFT_CRAFTING" }

    const result = formatter.format(msg)

    expect(result).toBe("製作場を離れた。")
  })
})

describe("format() - Quest messages", () => {
  const formatter = new WizEngineMessageFormatter({
    content: mockContent,
    templates: DEFAULT_MESSAGES_JA,
    resolvers: mockResolvers,
  })

  it("QUEST_COMPLETED をフォーマットできる", () => {
    const msg: WizLogMessage = {
      key: "QUEST_COMPLETED",
      questId: "defeat_slime",
    }

    const result = formatter.format(msg)

    expect(result).toBe("スライム討伐を完了した!")
  })
})

describe("format() - Level Up messages", () => {
  const formatter = new WizEngineMessageFormatter({
    content: mockContent,
    templates: DEFAULT_MESSAGES_JA,
    resolvers: mockResolvers,
  })

  it("LEVEL_UP_POINTS_GRANTED をフォーマットできる", () => {
    const msg: WizLogMessage = {
      key: "LEVEL_UP_POINTS_GRANTED",
      points: 3,
    }

    const result = formatter.format(msg)

    expect(result).toBe("レベルアップ! 能力値ポイントを3獲得!")
  })

  it("LEVEL_UP をフォーマットできる", () => {
    const msg: WizLogMessage = { key: "LEVEL_UP", level: 5 }

    const result = formatter.format(msg)

    expect(result).toBe("レベル5になった!")
  })

  it("ABILITY_LEARNED をフォーマットできる (resolver で名前解決)", () => {
    const msg: WizLogMessage = { key: "ABILITY_LEARNED", abilityId: "heal" }

    const result = formatter.format(msg)

    expect(result).toContain("ヒール")
  })

  it("ABILITY_LEARNED で未知の abilityId は ID がそのまま表示される", () => {
    const msg: WizLogMessage = {
      key: "ABILITY_LEARNED",
      abilityId: "unknown_skill",
    }

    const result = formatter.format(msg)

    expect(result).toContain("unknown_skill")
  })
})

describe("format() - NPC messages", () => {
  const formatter = new WizEngineMessageFormatter({
    content: mockContent,
    templates: DEFAULT_MESSAGES_JA,
    resolvers: mockResolvers,
  })

  it("semantic affinity levelをresolverで表示名へ変換する", () => {
    const result = formatter.format({
      key: "AFFINITY_LEVEL_CHANGED",
      npcId: "elder",
      level: "friend",
    })

    expect(result).toBe("村長との関係が「友人」になった!")
  })
})

describe("resolvers なしの場合", () => {
  const formatter = new WizEngineMessageFormatter({
    content: mockContent,
    templates: DEFAULT_MESSAGES_JA,
  })

  it("resolver がない場合は ID がそのまま表示される", () => {
    const msg: WizLogMessage = { key: "SEASON_CHANGED", season: "spring" }

    const result = formatter.format(msg)

    expect(result).toBe("季節がspringに変わった。")
  })

  it("content records から名前を解決する", () => {
    const msg: WizLogMessage = {
      key: "EQUIPPED_WEAPON",
      weaponId: "sword",
    }

    const result = formatter.format(msg)

    expect(result).toBe("鉄の剣を装備した。")
  })

  it("facility resolver がない場合は言語非依存の ID にフォールバックする", () => {
    const result = formatter.format({
      key: "FACILITY_UNLOCKED",
      facilityId: "alchemy",
    })

    expect(result).toBe("施設「alchemy」が利用可能になった!")
  })
})

describe("dependency ownership", () => {
  const verifyReadonlyTables = (
    templates: WizEngineMessageTemplates,
    resolvers: WizEngineNameResolvers
  ): void => {
    // @ts-expect-error template table callbackはreadonly。
    templates.WORLD_STARTED = () => "changed"
    // @ts-expect-error resolver table callbackはreadonly。
    resolvers.season = () => "changed"
  }

  void verifyReadonlyTables

  it("template・resolver・内部formatter tableを構築後に差し替えられない", () => {
    const templates = { ...DEFAULT_MESSAGES_JA }
    const resolvers = {
      season: (id: string) => `owned:${id}`,
    }
    const formatter = new WizEngineMessageFormatter({
      content: mockContent,
      resolvers,
      templates,
    })
    const internals = formatter as unknown as {
      templates: { WORLD_STARTED: () => string }
      resolvers: { season: (id: string) => string }
      formatters: {
        WORLD_STARTED: (message: { key: "WORLD_STARTED" }) => string
      }
    }

    templates.WORLD_STARTED = () => "changed source template"
    resolvers.season = () => "changed source resolver"
    expect(
      Reflect.set(
        internals.templates,
        "WORLD_STARTED",
        () => "changed owned template"
      )
    ).toBe(false)
    expect(
      Reflect.set(internals.resolvers, "season", () => "changed owned resolver")
    ).toBe(false)
    expect(
      Reflect.set(
        internals.formatters,
        "WORLD_STARTED",
        () => "changed internal formatter"
      )
    ).toBe(false)

    expect(Object.getPrototypeOf(internals.templates)).toBeNull()
    expect(Object.getPrototypeOf(internals.resolvers)).toBeNull()
    expect(Object.getPrototypeOf(internals.formatters)).toBeNull()
    expect(Object.isFrozen(internals.templates)).toBe(true)
    expect(Object.isFrozen(internals.resolvers)).toBe(true)
    expect(Object.isFrozen(internals.formatters)).toBe(true)
    expect(formatter.format({ key: "WORLD_STARTED" })).toBe(
      "新しい冒険が始まった!"
    )
    expect(formatter.format({ key: "SEASON_CHANGED", season: "spring" })).toBe(
      "季節がowned:springに変わった。"
    )
  })
})

describe("formatAll()", () => {
  const formatter = new WizEngineMessageFormatter({
    content: mockContent,
    templates: DEFAULT_MESSAGES_JA,
    resolvers: mockResolvers,
  })

  it("複数のメッセージを一括フォーマットできる", () => {
    const messages: readonly WizLogMessage[] = [
      { key: "WORLD_STARTED" },
      { key: "ENTERED_AREA", areaId: "forest" },
      { key: "DISCOVERED_MONSTER", monsterId: "slime" },
    ]

    const { formatAll } = formatter
    const result = formatAll(messages)

    expect(result).toHaveLength(3)
    expect(result[0]).toBe("新しい冒険が始まった!")
    expect(result[1]).toBe("森に向かった。")
    expect(result[2]).toBe("スライムを発見した!")
    expect(Object.isFrozen(result)).toBe(true)

    const verifyReadonlyResult = (values: readonly string[]): void => {
      // @ts-expect-error formatAll resultはreadonly。
      values.push("changed")
    }
    void verifyReadonlyResult
  })

  it("空の配列を渡すと空の配列を返す", () => {
    const messages: readonly WizLogMessage[] = []

    const result = formatter.formatAll(messages)

    expect(result).toHaveLength(0)
    expect(Object.isFrozen(result)).toBe(true)
  })
})
