import { describe, expect, it } from "vite-plus/test"
import { withMockInventory } from "@/lib/wiz/core/mocks/mock-inventory"
import { MOCK_VAULT } from "@/lib/wiz/core/mocks/mock-vault"
import { WizVaultPlayer } from "@/lib/wiz/core/vault/states/player/value"
import { WizVaultValue } from "@/lib/wiz/core/vault/value"

describe("ownership", () => {
  it("constructor inputを変更せず、defensive copyしたstateを保持する", () => {
    const input = JSON.parse(JSON.stringify(MOCK_VAULT.toPlain()))
    const vault = WizVaultValue.fromPlain(input)

    input.player.hp = 0
    input.flags.push("external")

    expect(vault.player.hp).toBeGreaterThan(0)
    expect(vault.flags).not.toContain("external")
    expect(Object.isFrozen(input)).toBe(false)
    expect(Object.isFrozen(vault.toPlain())).toBe(true)
    expect(Object.isFrozen(vault.toPlain().player)).toBe(true)
  })

  it("private constructor と prototype 偽装では値を生成できない", () => {
    expect(() =>
      Reflect.construct(WizVaultValue, [Symbol("invalid"), MOCK_VAULT.toPlain()]),
    ).toThrow(TypeError)

    const forged = Object.create(WizVaultValue.prototype)
    expect(() => WizVaultValue.assertAuthentic(forged)).toThrow(TypeError)
  })

  it("class と prototype は実行時にも変更できない", () => {
    expect(Object.isFrozen(WizVaultValue)).toBe(true)
    expect(Object.isFrozen(WizVaultValue.prototype)).toBe(true)
    expect(Reflect.set(WizVaultValue.prototype, "toPlain", () => MOCK_VAULT.toPlain())).toBe(false)
  })
})

describe("getters", () => {
  it("player を WizPlayerEntity として取得", () => {
    const vault = MOCK_VAULT
    const player = vault.player

    expect(player).toBeInstanceOf(WizVaultPlayer)
    expect(player.name).toBe(vault.toPlain().player.name)
  })

  it("プリミティブなプロパティを取得できる", () => {
    const vault = MOCK_VAULT

    expect(vault.log).toBeDefined()
    expect(vault.isEnded).toBe(false)
    expect(vault.flags).toEqual([])
  })
})

describe("updatePlayer", () => {
  it("プレイヤーをイミュータブルに更新", () => {
    const vault = MOCK_VAULT
    const updated = vault.updatePlayer((p) => p.damage(10))

    expect(updated.player.hp).toBe(vault.player.hp - 10)
    expect(vault.player.hp).toBe(MOCK_VAULT.player.hp) // 元は変更されない
  })

  it("チェーンで複数の更新ができる", () => {
    const vault = MOCK_VAULT
    const updated = vault.updatePlayer((p) => p.damage(10).addGold(50))

    expect(updated.player.hp).toBe(vault.player.hp - 10)
    expect(updated.player.gold).toBe(vault.player.gold + 50)
  })
})

describe("updateInventory", () => {
  it("インベントリをイミュータブルに更新", () => {
    const vault = MOCK_VAULT
    const updated = withMockInventory(vault, [
      { contentType: "item", contentId: "herb", quantity: 3 },
    ])

    expect(updated.inventory.totalQuantity("item", "herb") > 0).toBe(true)
    expect(updated.inventory.totalQuantity("item", "herb")).toBe(3)
  })
})

describe("withPlayer / withInventory", () => {
  it("withPlayer で直接プレイヤーを設定", () => {
    const vault = MOCK_VAULT
    const newPlayer = vault.player.damage(20)
    const updated = vault.withPlayer(newPlayer)

    expect(updated.player.hp).toBe(vault.player.hp - 20)
  })
})

describe("withLog / addLog", () => {
  it("addLog でログを追加", () => {
    const vault = MOCK_VAULT
    const updated = vault.addLog({ key: "AREA_UNLOCKED", areaId: "forest" })

    expect(updated.log).toContainEqual({
      key: "AREA_UNLOCKED",
      areaId: "forest",
    })
  })

  it("ログは50件まで保持される", () => {
    let vault = MOCK_VAULT.withLog([])

    for (let i = 0; i < 60; i++) {
      vault = vault.addLog({ key: "SEASON_CHANGED", season: `season-${i}` })
    }

    expect(vault.log).toHaveLength(50)
    expect(vault.log[0]).toEqual({ key: "SEASON_CHANGED", season: "season-10" })
    expect(vault.log[49]).toEqual({ key: "SEASON_CHANGED", season: "season-59" })
  })
})

describe("withEnded", () => {
  it("world終了状態を設定", () => {
    const vault = MOCK_VAULT
    const updated = vault.withEnded(true)

    expect(updated.isEnded).toBe(true)
    expect(vault.isEnded).toBe(false)
  })
})

describe("flags", () => {
  it("addFlag でフラグを追加", () => {
    const vault = MOCK_VAULT
    const updated = vault.addFlag("test_flag")

    expect(updated.hasFlag("test_flag")).toBe(true)
    expect(vault.hasFlag("test_flag")).toBe(false)
  })

  it("重複フラグは追加されない", () => {
    const vault = MOCK_VAULT.addFlag("test_flag")
    const updated = vault.addFlag("test_flag")

    expect(updated.flags.filter((f) => f === "test_flag")).toHaveLength(1)
  })

  it("removeFlag でフラグを削除", () => {
    const vault = MOCK_VAULT.addFlag("test_flag")
    const updated = vault.removeFlag("test_flag")

    expect(updated.hasFlag("test_flag")).toBe(false)
  })
})

describe("updateQuest", () => {
  it("クエストを更新できる", () => {
    const vault = MOCK_VAULT
    const questId = vault.quests[0]?.id

    if (questId) {
      const updated = vault.updateQuest(questId, (q) => ({
        ...q,
        accepted: true,
      }))
      const quest = updated.quests.find((q) => q.id === questId)

      expect(quest?.accepted).toBe(true)
    }
  })
})

describe("updateArea", () => {
  it("エリアを更新できる", () => {
    const vault = MOCK_VAULT
    const areaId = vault.areas[0]?.id

    if (areaId) {
      const updated = vault.updateArea(areaId, (a) => ({
        ...a,
        progress: 50,
      }))
      const area = updated.areas.find((a) => a.id === areaId)

      expect(area?.progress).toBe(50)
    }
  })
})

describe("updateNpc", () => {
  it("NPCを更新できる", () => {
    const vault = MOCK_VAULT
    const npcId = vault.npcs[0]?.id

    if (npcId) {
      const updated = vault.updateNpc(npcId, (n) => ({
        ...n,
        affinity: 100,
      }))
      const npc = updated.npcs.find((n) => n.id === npcId)

      expect(npc?.affinity).toBe(100)
    }
  })
})

describe("find メソッド", () => {
  it("findNpc", () => {
    const vault = MOCK_VAULT
    const npcId = vault.npcs[0]?.id

    if (npcId) {
      const npc = vault.findNpc(npcId)
      expect(npc?.id).toBe(npcId)
    }

    expect(vault.findNpc("nonexistent")).toBeUndefined()
  })

  it("findQuest", () => {
    const vault = MOCK_VAULT
    const questId = vault.quests[0]?.id

    if (questId) {
      const quest = vault.findQuest(questId)
      expect(quest?.id).toBe(questId)
    }

    expect(vault.findQuest("nonexistent")).toBeUndefined()
  })

  it("findArea", () => {
    const vault = MOCK_VAULT
    const areaId = vault.areas[0]?.id

    if (areaId) {
      const area = vault.findArea(areaId)
      expect(area?.id).toBe(areaId)
    }

    expect(vault.findArea("nonexistent")).toBeUndefined()
  })
})

describe("equipment", () => {
  it("任意のスロットへ所持entryを設定できる", () => {
    const inventoryVault = withMockInventory(MOCK_VAULT, [
      { contentType: "weapon", contentId: "iron_sword" },
      { contentType: "armor", contentId: "iron_armor" },
    ])
    const swordEntry = inventoryVault.inventory.entriesFor("weapon", "iron_sword")[0]
    const armorEntry = inventoryVault.inventory.entriesFor("armor", "iron_armor")[0]
    if (!swordEntry || !armorEntry) throw new Error("equipment fixture is required")
    const updated = inventoryVault.withEquipment(
      inventoryVault.equipment
        .equip("mainHand", swordEntry.entryId, inventoryVault.inventory)
        .equip("body", armorEntry.entryId, inventoryVault.inventory),
    )

    expect(updated.equippedAt("mainHand")).toBe(swordEntry.entryId)
    expect(updated.equippedAt("body")).toBe(armorEntry.entryId)
  })

  it("指定したスロットだけを外す", () => {
    const inventoryVault = withMockInventory(MOCK_VAULT, [
      { contentType: "weapon", contentId: "iron_sword" },
      { contentType: "armor", contentId: "iron_armor" },
    ])
    const swordEntry = inventoryVault.inventory.entriesFor("weapon", "iron_sword")[0]
    const armorEntry = inventoryVault.inventory.entriesFor("armor", "iron_armor")[0]
    if (!swordEntry || !armorEntry) throw new Error("equipment fixture is required")
    const equipped = inventoryVault.withEquipment(
      inventoryVault.equipment
        .equip("mainHand", swordEntry.entryId, inventoryVault.inventory)
        .equip("body", armorEntry.entryId, inventoryVault.inventory),
    )
    const updated = equipped.withEquipment(equipped.equipment.unequip("mainHand"))

    expect(updated.equippedAt("mainHand")).toBeNull()
    expect(updated.equippedAt("body")).toBe(armorEntry.entryId)
  })

  it("withEquipment で装備を直接設定", () => {
    const inventoryVault = withMockInventory(MOCK_VAULT, [
      { contentType: "weapon", contentId: "mythril_sword" },
      { contentType: "armor", contentId: "mythril_armor" },
    ])
    const swordEntry = inventoryVault.inventory.entriesFor("weapon", "mythril_sword")[0]
    const armorEntry = inventoryVault.inventory.entriesFor("armor", "mythril_armor")[0]
    if (!swordEntry || !armorEntry) throw new Error("equipment fixture is required")
    const updated = inventoryVault.withEquipment(
      inventoryVault.equipment
        .equip("mainHand", swordEntry.entryId, inventoryVault.inventory)
        .equip("body", armorEntry.entryId, inventoryVault.inventory),
    )

    expect(updated.equipment.entryAt("mainHand")).toBe(swordEntry.entryId)
    expect(updated.equipment.entryAt("body")).toBe(armorEntry.entryId)
  })
})

describe("time", () => {
  it("withTime で時間を設定", () => {
    const vault = MOCK_VAULT
    const updated = vault.withTime({
      day: 10,
      season: "winter",
      timeOfDay: "night",
      weather: "snowy",
    })

    expect(updated.time.day).toBe(10)
    expect(updated.time.season).toBe("winter")
    expect(updated.time.timeOfDay).toBe("night")
    expect(updated.time.weather).toBe("snowy")
  })
})

describe("withPartyMembers", () => {
  it("パーティメンバーを一括設定", () => {
    const vault = MOCK_VAULT
    const members = [
      {
        id: "elena",
        name: "エレナ",
        classId: "healer" as const,
        level: 3,
        hp: 40,
        maxHp: 40,
        mp: 35,
        maxMp: 35,
        attributes: {
          strength: 3,
          dexterity: 4,
          agility: 4,
          vitality: 4,
          wisdom: 10,
          charisma: 8,
        },
        abilityIds: ["heal"],
      },
    ]
    const updated = vault.withPartyMembers(members)

    expect(updated.partyMembers).toHaveLength(1)
    expect(updated.partyMembers[0].name).toBe("エレナ")
    expect(updated.partyMembers[0].level).toBe(3)
  })
})

describe("incrementAreaProgress", () => {
  it("エリア進捗を増加", () => {
    const vault = MOCK_VAULT
    const areaId = vault.areas[0]?.id
    if (!areaId) return

    const updated = vault.incrementAreaProgress(areaId, 15)
    const area = updated.areas.find((a) => a.id === areaId)

    expect(area?.progress).toBe(15)
  })

  it("進捗は100を超えない", () => {
    const vault = MOCK_VAULT
    const areaId = vault.areas[0]?.id
    if (!areaId) return

    const updated = vault.incrementAreaProgress(areaId, 150)
    const area = updated.areas.find((a) => a.id === areaId)

    expect(area?.progress).toBe(100)
  })

  it("負数と非有限の増分を拒否する", () => {
    const areaId = MOCK_VAULT.areas[0]?.id
    if (!areaId) return

    expect(() => MOCK_VAULT.incrementAreaProgress(areaId, -1)).toThrow(RangeError)
    expect(() => MOCK_VAULT.incrementAreaProgress(areaId, Number.NaN)).toThrow(RangeError)
    expect(() => MOCK_VAULT.incrementAreaProgress(areaId, Number.POSITIVE_INFINITY)).toThrow(
      RangeError,
    )
  })
})

describe("updateQuestProgressDefeat", () => {
  it("討伐クエストの進捗を更新", () => {
    const vault = MOCK_VAULT
    const defeatQuest = vault.quests.find((q) => q.objective.type === "defeat" && !q.completed)
    if (!defeatQuest) return

    const accepted = vault.updateQuest(defeatQuest.id, (q) => ({
      ...q,
      accepted: true,
    }))
    const updated = accepted.updateQuestProgressDefeat(
      defeatQuest.objective.type === "defeat" ? defeatQuest.objective.monsterId : "",
    )
    const quest = updated.findQuest(defeatQuest.id)

    if (quest?.objective.type === "defeat") {
      expect(quest.objective.current).toBeGreaterThan(0)
    }
  })
})

describe("updateQuestProgressGather", () => {
  it("採集クエストの進捗を更新", () => {
    const vault = MOCK_VAULT
    const gatherQuest = vault.quests.find((q) => q.objective.type === "gather" && !q.completed)
    if (!gatherQuest) return

    const itemId = gatherQuest.objective.type === "gather" ? gatherQuest.objective.itemId : ""
    const accepted = withMockInventory(
      vault.updateQuest(gatherQuest.id, (q) => ({ ...q, accepted: true })),
      [{ contentType: "item", contentId: itemId, quantity: 5 }],
    )
    const updated = accepted.updateQuestProgressGather(itemId)
    const quest = updated.findQuest(gatherQuest.id)

    if (quest?.objective.type === "gather") {
      expect(quest.objective.current).toBe(Math.min(5, quest.objective.count))
    }
  })
})

describe("withAreas / withNpcs / withQuests / withFlags", () => {
  it("withAreas で一括設定", () => {
    const vault = MOCK_VAULT
    const updated = vault.withAreas([])

    expect(updated.areas).toHaveLength(0)
  })

  it("withNpcs で一括設定", () => {
    const vault = MOCK_VAULT
    const updated = vault.withNpcs([])

    expect(updated.npcs).toHaveLength(0)
  })

  it("withQuests で一括設定", () => {
    const vault = MOCK_VAULT
    const updated = vault.withQuests([])

    expect(updated.quests).toHaveLength(0)
  })

  it("withFlags で一括設定", () => {
    const vault = MOCK_VAULT
    const updated = vault.withFlags(["flag_a", "flag_b"])

    expect(updated.flags).toEqual(["flag_a", "flag_b"])
  })
})

describe("toPlain", () => {
  it("プレーンオブジェクトを返す", () => {
    const vault = MOCK_VAULT
    const plain = vault.toPlain()

    expect(plain.player).toBeDefined()
    expect(plain.inventory).toBeDefined()
    expect(plain.log).toBeDefined()
    expect(plain.isEnded).toBe(false)
  })
})

describe("fromPlain", () => {
  it("toPlain のラウンドトリップでデータが保持される", () => {
    const vault = withMockInventory(
      MOCK_VAULT.updatePlayer((p) => p.damage(10).addGold(100)),
      [{ contentType: "item", contentId: "herb", quantity: 3 }],
    )
      .addFlag("test_flag")
      .addLog({ key: "WORLD_STARTED" })

    const plain = vault.toPlain()
    const restored = WizVaultValue.fromPlain(plain)

    expect(restored.player.hp).toBe(vault.player.hp)
    expect(restored.player.gold).toBe(vault.player.gold)
    expect(restored.inventory.totalQuantity("item", "herb")).toBe(3)
    expect(restored.hasFlag("test_flag")).toBe(true)
    expect(restored.log).toEqual(vault.log)
    expect(restored.isEnded).toBe(false)
  })

  it("JSON シリアライズ/デシリアライズでデータが保持される", () => {
    const vault = MOCK_VAULT.updatePlayer((p) => p.addExp(50).addGold(200)).addLog({
      key: "BATTLE_VICTORY",
      exp: 30,
      gold: 50,
    })

    const json = JSON.stringify(vault.toPlain())
    const restored = WizVaultValue.fromPlain(JSON.parse(json))

    expect(restored.player.exp).toBe(vault.player.exp)
    expect(restored.player.gold).toBe(vault.player.gold)
    expect(restored.log).toEqual(vault.log)
    expect(restored.areas).toHaveLength(vault.areas.length)
    expect(restored.npcs).toHaveLength(vault.npcs.length)
    expect(restored.quests).toHaveLength(vault.quests.length)
  })

  it("意味的な item effect / level-up / affinity log を検証して復元する", () => {
    const vault = MOCK_VAULT.addLog({
      key: "ITEM_EFFECT_APPLIED",
      itemId: "ether",
      events: [{ type: "mp_restored", amount: 8 }],
    })
      .addLog({
        key: "LEVEL_UP_POINTS_GRANTED",
        points: 3,
      })
      .addLog({
        key: "AFFINITY_LEVEL_CHANGED",
        npcId: "elda",
        level: "bonded",
      })

    const restored = WizVaultValue.fromPlain(JSON.parse(JSON.stringify(vault.toPlain())))

    expect(restored.log.slice(-3)).toEqual([
      {
        key: "ITEM_EFFECT_APPLIED",
        itemId: "ether",
        events: [{ type: "mp_restored", amount: 8 }],
      },
      {
        key: "LEVEL_UP_POINTS_GRANTED",
        points: 3,
      },
      {
        key: "AFFINITY_LEVEL_CHANGED",
        npcId: "elda",
        level: "bonded",
      },
    ])
  })

  it("復元後も updatePlayer などのメソッドが正常に動作する", () => {
    const vault = MOCK_VAULT
    const restored = WizVaultValue.fromPlain(vault.toPlain())
    const updated = restored.updatePlayer((p) => p.addGold(99))

    expect(updated.player.gold).toBe(vault.player.gold + 99)
  })

  it("壊れた field type を root schema で拒否する", () => {
    const broken = {
      ...MOCK_VAULT.toPlain(),
      player: {
        ...MOCK_VAULT.toPlain().player,
        hp: "50",
      },
    }

    expect(() => WizVaultValue.fromPlain(broken)).toThrow()
  })

  it("必須 field の欠損と未知 root field を拒否する", () => {
    const { inventory: _inventory, ...withoutInventory } = MOCK_VAULT.toPlain()
    const withUnknownRootField = {
      ...MOCK_VAULT.toPlain(),
      unexpected: true,
    }

    expect(() => WizVaultValue.fromPlain(withoutInventory)).toThrow()
    expect(() => WizVaultValue.fromPlain(withUnknownRootField)).toThrow()
  })

  it("key だけ合う壊れた log payload を拒否する", () => {
    const broken = {
      ...MOCK_VAULT.toPlain(),
      log: [{ key: "BATTLE_VICTORY", exp: "30", gold: 10 }],
    }

    expect(() => WizVaultValue.fromPlain(broken)).toThrow()
  })

  it("重複した canonical ID と set-like 値を拒否する", () => {
    const plain = MOCK_VAULT.toPlain()

    expect(() =>
      WizVaultValue.fromPlain({
        ...plain,
        areas: [plain.areas[0], plain.areas[0]],
      }),
    ).toThrow()
    expect(() =>
      WizVaultValue.fromPlain({
        ...plain,
        flags: ["same_flag", "same_flag"],
      }),
    ).toThrow()
    expect(() =>
      WizVaultValue.fromPlain({
        ...plain,
        inventory: {
          ...plain.inventory,
          entries: [
            {
              entryId: "duplicate-entry",
              contentType: "item",
              contentId: "herb",
              quantity: 1,
            },
            {
              entryId: "duplicate-entry",
              contentType: "item",
              contentId: "herb",
              quantity: 2,
            },
          ],
        },
      }),
    ).toThrow()
  })

  it("更新 callback が返した壊れた状態を拒否し、元の値を変更しない", () => {
    const area = MOCK_VAULT.areas[0]
    const quest = MOCK_VAULT.quests.find(
      (candidate) => candidate.objective.type === "defeat" || candidate.objective.type === "gather",
    )
    if (!area || !quest || !("current" in quest.objective)) return

    expect(() =>
      MOCK_VAULT.updateArea(area.id, (currentArea) => ({
        ...currentArea,
        progress: Number.NaN,
      })),
    ).toThrow()
    expect(() =>
      MOCK_VAULT.updateQuest(quest.id, (currentQuest) => {
        if (!("current" in currentQuest.objective)) return currentQuest
        return {
          ...currentQuest,
          objective: {
            ...currentQuest.objective,
            current: currentQuest.objective.count + 1,
          },
        }
      }),
    ).toThrow()
    expect(MOCK_VAULT.findArea(area.id)?.progress).toBe(area.progress)
    expect(MOCK_VAULT.findQuest(quest.id)?.objective).toEqual(quest.objective)
  })
})

describe("メソッドチェーン", () => {
  it("複数の操作をチェーンできる", () => {
    const vault = MOCK_VAULT

    const updated = withMockInventory(
      vault.updatePlayer((p) => p.damage(10).addGold(50)),
      [{ contentType: "item", contentId: "herb", quantity: 3 }],
    )
      .addLog({ key: "AREA_UNLOCKED", areaId: "forest" })
      .addFlag("test_flag")

    expect(updated.player.hp).toBe(vault.player.hp - 10)
    expect(updated.player.gold).toBe(vault.player.gold + 50)
    expect(updated.inventory.totalQuantity("item", "herb")).toBe(3)
    expect(updated.log).toContainEqual({
      key: "AREA_UNLOCKED",
      areaId: "forest",
    })
    expect(updated.hasFlag("test_flag")).toBe(true)
  })
})
