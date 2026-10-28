import { describe, expect, it } from "vite-plus/test"
import { MOCK_VAULT } from "@/lib/wiz/core/mocks/mock-vault"
import {
  WorldSnapshot,
  zWorldSnapshotData,
} from "@/lib/wiz/core/save/world-snapshot"
import {
  zWizSeasonEffect,
  zWizTimeEffect,
  zWizWeatherEffect,
} from "@/lib/wiz/core/types/time"
import { zWizVault } from "@/lib/wiz/core/vault/schema"
import { WizVaultAreaStateSchema } from "@/lib/wiz/core/vault/states/area/schema"
import { WizVaultEventStateSchema } from "@/lib/wiz/core/vault/states/event/schema"
import {
  WizStandardEquipmentStateSchema,
  WizStandardInventoryStateSchema,
} from "@/lib/wiz/core/vault/standard-inventory"
import { WizVaultMonsterStateSchema } from "@/lib/wiz/core/vault/states/monster/schema"
import { WizVaultNpcSchema } from "@/lib/wiz/core/vault/states/npc/schema"
import {
  WizVaultPartyMemberStateSchema,
  WizVaultPlayerStateSchema,
} from "@/lib/wiz/core/vault/states/player/schema"
import { WizVaultQuestStateSchema } from "@/lib/wiz/core/vault/states/quest/schema"
import { zWizVaultTimeState } from "@/lib/wiz/core/vault/states/time/schema"

const attributes = {
  strength: 5,
  dexterity: 5,
  agility: 5,
  vitality: 5,
  wisdom: 5,
  charisma: 5,
}

const player = {
  name: "冒険者",
  level: 1,
  exp: 0,
  expToNextLevel: 50,
  hp: 50,
  maxHp: 50,
  hunger: 100,
  ap: 5,
  maxAp: 5,
  gold: 100,
  attributes,
  abilityIds: [],
}

const partyMember = {
  id: "guardian",
  name: "守護者",
  classId: "warrior",
  level: 1,
  hp: 60,
  maxHp: 60,
  mp: 10,
  maxMp: 10,
  attributes,
  abilityIds: [],
}

const monster = {
  id: "slime",
  name: "スライム",
  hp: 10,
  maxHp: 10,
  attack: 2,
  defense: 1,
  agility: 1,
  expReward: 3,
  goldReward: 1,
  drops: [],
}

const event = {
  id: "spring",
  description: "泉を見つけた",
  choices: [],
}

const inventory = {
  capacity: 20,
  entries: [
    {
      entryId: "herb-stack",
      contentType: "item",
      contentId: "herb",
      quantity: 1,
    },
  ],
}

const equipment = {
  mainHand: null,
}

const time = {
  day: 1,
  season: "spring",
  timeOfDay: "morning",
  weather: "sunny",
}

const area = {
  id: "forest",
  name: "森",
  description: "深い森",
  dangerLevel: 1,
  apCost: 1,
  progress: 0,
  unlocked: true,
  availableGathering: [],
  monsters: [],
  events: [],
}

const npc = {
  id: "elder",
  name: "長老",
  affinity: -25,
  dialogues: [
    {
      id: "greeting",
      minAffinity: 0,
      lines: [{ speaker: "長老", text: "ようこそ" }],
    },
  ],
  giftPreferences: {
    likes: ["herb"],
    dislikes: ["ore"],
  },
}

const quest = {
  id: "first_quest",
  name: "最初の依頼",
  description: "薬草を集める",
  giverNpcId: "elder",
  objective: {
    type: "gather",
    itemId: "herb",
    count: 3,
    current: 0,
  },
  reward: {
    gold: 10,
    exp: 5,
    affinityBonus: 1,
    items: [{ type: "item", itemId: "potion", quantity: 1 }],
  },
  completed: false,
  accepted: false,
}

describe("vault state schema strictness", () => {
  it("現在の state 形状を受理する", () => {
    expect(WizVaultPlayerStateSchema.safeParse(player).success).toBe(true)
    expect(WizVaultPartyMemberStateSchema.safeParse(partyMember).success).toBe(
      true
    )
    expect(WizVaultMonsterStateSchema.safeParse(monster).success).toBe(true)
    expect(WizVaultEventStateSchema.safeParse(event).success).toBe(true)
    expect(WizStandardInventoryStateSchema.safeParse(inventory).success).toBe(
      true
    )
    expect(WizStandardEquipmentStateSchema.safeParse(equipment).success).toBe(
      true
    )
    expect(zWizVaultTimeState.safeParse(time).success).toBe(true)
    expect(WizVaultAreaStateSchema.safeParse(area).success).toBe(true)
    expect(WizVaultNpcSchema.safeParse(npc).success).toBe(true)
    expect(WizVaultQuestStateSchema.safeParse(quest).success).toBe(true)
  })

  it("各 state のトップレベル余剰キーを拒否する", () => {
    expect(
      WizVaultPlayerStateSchema.safeParse({ ...player, unknown: true }).success
    ).toBe(false)
    expect(
      WizVaultPartyMemberStateSchema.safeParse({
        ...partyMember,
        unknown: true,
      }).success
    ).toBe(false)
    expect(
      WizVaultMonsterStateSchema.safeParse({ ...monster, unknown: true })
        .success
    ).toBe(false)
    expect(
      WizVaultEventStateSchema.safeParse({ ...event, unknown: true }).success
    ).toBe(false)
    expect(
      WizStandardInventoryStateSchema.safeParse({ ...inventory, unknown: true })
        .success
    ).toBe(false)
    expect(
      WizStandardEquipmentStateSchema.safeParse({ ...equipment, unknown: true })
        .success
    ).toBe(false)
    expect(
      zWizVaultTimeState.safeParse({ ...time, unknown: true }).success
    ).toBe(false)
    expect(
      WizVaultAreaStateSchema.safeParse({ ...area, unknown: true }).success
    ).toBe(false)
  })

  it("ネストした固定形オブジェクトの余剰キーを拒否する", () => {
    expect(
      WizVaultPlayerStateSchema.safeParse({
        ...player,
        attributes: { ...attributes, unknown: 1 },
      }).success
    ).toBe(false)
    expect(
      WizStandardInventoryStateSchema.safeParse({
        ...inventory,
        entries: [{ ...inventory.entries[0], unknown: true }],
      }).success
    ).toBe(false)
  })

  it("会話要件の重複と矛盾を保存状態でも拒否する", () => {
    const dialogue = npc.dialogues[0]

    expect(
      WizVaultNpcSchema.safeParse({
        ...npc,
        dialogues: [
          {
            ...dialogue,
            requirements: {
              requiredFlags: ["opened"],
              forbiddenFlags: ["opened"],
            },
          },
        ],
      }).success
    ).toBe(false)
    expect(
      WizVaultNpcSchema.safeParse({
        ...npc,
        dialogues: [
          {
            ...dialogue,
            requirements: {
              requiredItems: [
                { itemId: "herb", quantity: 1 },
                { itemId: "herb", quantity: 2 },
              ],
            },
          },
        ],
      }).success
    ).toBe(false)
  })

  it("NPC gift preferenceの重複と矛盾を保存状態でも拒否する", () => {
    expect(
      WizVaultNpcSchema.safeParse({
        ...npc,
        giftPreferences: {
          ...npc.giftPreferences,
          likes: ["herb", "herb"],
        },
      }).success
    ).toBe(false)
    expect(
      WizVaultNpcSchema.safeParse({
        ...npc,
        giftPreferences: {
          ...npc.giftPreferences,
          likes: ["herb"],
          dislikes: ["herb"],
        },
      }).success
    ).toBe(false)
  })

  it("クエスト報酬の必須値欠落と重複を保存状態でも拒否する", () => {
    const rewardWithoutAffinityBonus = {
      gold: quest.reward.gold,
      exp: quest.reward.exp,
      items: quest.reward.items,
    }

    expect(
      WizVaultQuestStateSchema.safeParse({
        ...quest,
        reward: rewardWithoutAffinityBonus,
      }).success
    ).toBe(false)
    expect(
      WizVaultQuestStateSchema.safeParse({
        ...quest,
        reward: {
          ...quest.reward,
          items: [
            { type: "item", itemId: "herb", quantity: 1 },
            { type: "item", itemId: "herb", quantity: 2 },
          ],
        },
      }).success
    ).toBe(false)
  })
})

describe("vault state invariants", () => {
  it("root vault と WorldSnapshot は canonical state schema を直接使う", () => {
    expect(zWizVault.shape.player).toBe(WizVaultPlayerStateSchema)
    expect(zWizVault.shape.partyMembers.element).toBe(
      WizVaultPartyMemberStateSchema
    )
    expect(zWizVault.shape.inventory).toBe(WizStandardInventoryStateSchema)
    expect(zWizVault.shape.equipment).toBe(WizStandardEquipmentStateSchema)
    expect(zWizVault.shape.time).toBe(zWizVaultTimeState)
    expect(zWizVault.shape.areas.element).toBe(WizVaultAreaStateSchema)
    expect(zWizVault.shape.npcs.element).toBe(WizVaultNpcSchema)
    expect(zWizVault.shape.quests.element).toBe(WizVaultQuestStateSchema)
    expect(zWorldSnapshotData.shape.player).toBe(WizVaultPlayerStateSchema)
    expect(zWorldSnapshotData.shape.partyMembers.element).toBe(
      WizVaultPartyMemberStateSchema
    )
    expect(zWorldSnapshotData.shape.inventory).toBe(
      WizStandardInventoryStateSchema
    )
    expect(zWorldSnapshotData.shape.time).toBe(zWizVaultTimeState)
  })

  it("player/party/monster の resource 上限と player MP pair を拒否する", () => {
    const playerResult = WizVaultPlayerStateSchema.safeParse({
      ...player,
      hp: 51,
      ap: 6,
      mp: 11,
      maxMp: 10,
    })
    const missingMpPair = WizVaultPlayerStateSchema.safeParse({
      ...player,
      mp: 10,
    })
    const partyResult = WizVaultPartyMemberStateSchema.safeParse({
      ...partyMember,
      hp: 61,
      mp: 11,
    })
    const monsterResult = WizVaultMonsterStateSchema.safeParse({
      ...monster,
      hp: 11,
    })

    expect(playerResult.success).toBe(false)
    expect(missingMpPair.success).toBe(false)
    expect(partyResult.success).toBe(false)
    expect(monsterResult.success).toBe(false)
    if (playerResult.success || partyResult.success) {
      return
    }
    expect(
      playerResult.error.issues.map((issue) => issue.path.join("."))
    ).toEqual(expect.arrayContaining(["hp", "ap", "mp"]))
    expect(
      partyResult.error.issues.map((issue) => issue.path.join("."))
    ).toEqual(expect.arrayContaining(["hp", "mp"]))
  })

  it("set semantics の重複は snapshot shape で保持し Vault root で拒否する", () => {
    expect(
      WizVaultPlayerStateSchema.safeParse({
        ...player,
        abilityIds: ["heal", "heal"],
      }).success
    ).toBe(true)
    expect(
      WizVaultPartyMemberStateSchema.safeParse({
        ...partyMember,
        abilityIds: ["guard", "guard"],
      }).success
    ).toBe(true)

    const vault = MOCK_VAULT.toPlain()
    const duplicatePlayerSkill = zWizVault.safeParse({
      ...vault,
      player: {
        ...vault.player,
        abilityIds: ["heal", "heal"],
      },
    })
    const duplicatePartySkill = zWizVault.safeParse({
      ...vault,
      partyMembers: [
        {
          ...partyMember,
          abilityIds: ["guard", "guard"],
        },
      ],
    })

    expect(duplicatePlayerSkill.success).toBe(false)
    expect(duplicatePartySkill.success).toBe(false)
    if (duplicatePlayerSkill.success || duplicatePartySkill.success) {
      return
    }
    expect(
      duplicatePlayerSkill.error.issues.map((issue) => issue.path.join("."))
    ).toContain("player.abilityIds.1")
    expect(
      duplicatePartySkill.error.issues.map((issue) => issue.path.join("."))
    ).toContain("partyMembers.0.abilityIds.1")
  })

  it("有限・非負・整数であるべき数値を拒否する", () => {
    expect(
      WizVaultPlayerStateSchema.safeParse({
        ...player,
        attributes: { ...attributes, wisdom: Number.POSITIVE_INFINITY },
      }).success
    ).toBe(false)
    expect(
      WizVaultPlayerStateSchema.safeParse({ ...player, level: 1.5 }).success
    ).toBe(false)
    expect(
      WizVaultPlayerStateSchema.safeParse({ ...player, gold: -1 }).success
    ).toBe(false)
    expect(
      WizVaultMonsterStateSchema.safeParse({ ...monster, attack: -1 }).success
    ).toBe(false)
    expect(
      WizVaultEventStateSchema.safeParse({
        ...event,
        choices: [
          {
            label: "調べる",
            difficulty: Number.POSITIVE_INFINITY,
            successText: "成功",
            failText: "失敗",
          },
        ],
      }).success
    ).toBe(false)
    expect(
      WizVaultEventStateSchema.safeParse({
        ...event,
        choices: [
          {
            label: "調べる",
            stat: "wisdom",
            difficulty: 0,
            successText: "成功",
            failText: "失敗",
          },
        ],
      }).success
    ).toBe(false)
    expect(
      WizStandardInventoryStateSchema.safeParse({
        ...inventory,
        entries: [{ ...inventory.entries[0], quantity: 0 }],
      }).success
    ).toBe(false)
    expect(
      WizStandardInventoryStateSchema.safeParse({
        ...inventory,
        entries: [{ ...inventory.entries[0], quantity: 1.5 }],
      }).success
    ).toBe(false)
    expect(
      WizStandardInventoryStateSchema.safeParse({
        ...inventory,
        capacity: -1,
      }).success
    ).toBe(false)
    expect(zWizVaultTimeState.safeParse({ ...time, day: 0 }).success).toBe(
      false
    )
    expect(
      WizVaultAreaStateSchema.safeParse({ ...area, apCost: -1 }).success
    ).toBe(false)
    expect(
      WizVaultAreaStateSchema.safeParse({ ...area, progress: 101 }).success
    ).toBe(false)
    expect(
      WizVaultNpcSchema.safeParse({ ...npc, affinity: Number.NaN }).success
    ).toBe(false)
    expect(
      WizVaultQuestStateSchema.safeParse({
        ...quest,
        objective: { ...quest.objective, current: 0.5 },
      }).success
    ).toBe(false)
    expect(
      WizVaultQuestStateSchema.safeParse({
        ...quest,
        reward: { ...quest.reward, gold: -1 },
      }).success
    ).toBe(false)
  })

  it("inventory slot 上限を state schema 自身で拒否する", () => {
    const result = WizStandardInventoryStateSchema.safeParse({
      entries: [
        { ...inventory.entries[0], entryId: "herb-stack" },
        {
          ...inventory.entries[0],
          entryId: "potion-stack",
          contentId: "potion",
        },
      ],
      capacity: 1,
    })

    expect(result.success).toBe(false)
    if (result.success) {
      return
    }
    expect(result.error.issues).toContainEqual(
      expect.objectContaining({
        path: ["entries"],
        message: expect.stringContaining("inventory.capacity"),
      })
    )
  })

  it.each(["", "   ", " id "])(
    "正規化されていない semantic ID を拒否する: %j",
    (id) => {
      expect(
        WizVaultPartyMemberStateSchema.safeParse({ ...partyMember, id }).success
      ).toBe(false)
      expect(
        WizStandardInventoryStateSchema.safeParse({
          ...inventory,
          entries: [{ ...inventory.entries[0], entryId: id }],
        }).success
      ).toBe(false)
      expect(
        WizVaultMonsterStateSchema.safeParse({ ...monster, id }).success
      ).toBe(false)
      expect(WizVaultEventStateSchema.safeParse({ ...event, id }).success).toBe(
        false
      )
      expect(
        WizVaultAreaStateSchema.safeParse({
          ...area,
          availableGathering: [id],
        }).success
      ).toBe(false)
      expect(
        WizVaultNpcSchema.safeParse({
          ...npc,
          dialogues: [{ ...npc.dialogues[0], id }],
        }).success
      ).toBe(false)
      expect(
        WizVaultQuestStateSchema.safeParse({ ...quest, giverNpcId: id }).success
      ).toBe(false)
    }
  )

  it("root schema は state schema と state 間の装備所有 invariant を適用する", () => {
    const valid = MOCK_VAULT.toPlain()
    const excessiveHp = {
      ...valid,
      player: {
        ...valid.player,
        hp: valid.player.maxHp + 1,
      },
    }
    const unownedEquipment = {
      ...valid,
      equipment: {
        ...valid.equipment,
        mainHand: "unowned-entry",
      },
    }
    const invalidRootId = {
      ...valid,
      unlockedFacilities: [" facility "],
    }

    expect(zWizVault.safeParse(excessiveHp).success).toBe(false)
    expect(zWizVault.safeParse(unownedEquipment).success).toBe(false)
    expect(zWizVault.safeParse(invalidRootId).success).toBe(false)
    expect(() => WorldSnapshot.fromVault(excessiveHp)).toThrow()
  })
})

describe("time effect schema strictness", () => {
  it("各 effect の余剰キーを拒否する", () => {
    expect(
      zWizSeasonEffect.safeParse({
        gatheringBonus: 1,
        hungerModifier: 1,
      }).success
    ).toBe(true)
    expect(
      zWizTimeEffect.safeParse({
        monsterEncounterRate: 1,
      }).success
    ).toBe(true)
    expect(
      zWizWeatherEffect.safeParse({
        gatheringBonus: 1,
        explorationBonus: 1,
        combatBonus: 1,
        hungerModifier: 1,
      }).success
    ).toBe(true)
    expect(
      zWizSeasonEffect.safeParse({
        gatheringBonus: 1,
        hungerModifier: 1,
        unknown: true,
      }).success
    ).toBe(false)
    expect(
      zWizTimeEffect.safeParse({
        monsterEncounterRate: 1,
        unknown: true,
      }).success
    ).toBe(false)
    expect(
      zWizWeatherEffect.safeParse({
        gatheringBonus: 1,
        explorationBonus: 1,
        combatBonus: 1,
        hungerModifier: 1,
        unknown: true,
      }).success
    ).toBe(false)
  })

  it("effect の非有限値と負の倍率を拒否する", () => {
    expect(
      zWizSeasonEffect.safeParse({
        gatheringBonus: Number.NaN,
        hungerModifier: 1,
      }).success
    ).toBe(false)
    expect(
      zWizSeasonEffect.safeParse({
        gatheringBonus: 0,
        hungerModifier: -1,
      }).success
    ).toBe(false)
    expect(
      zWizTimeEffect.safeParse({
        monsterEncounterRate: -1,
      }).success
    ).toBe(false)
    expect(
      zWizWeatherEffect.safeParse({
        gatheringBonus: 0,
        explorationBonus: Number.POSITIVE_INFINITY,
        combatBonus: 0,
        hungerModifier: 1,
      }).success
    ).toBe(false)
  })
})
