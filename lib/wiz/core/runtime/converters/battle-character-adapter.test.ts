import { describe, expect, it } from "vite-plus/test"
import { WizBattleCharacter } from "@/lib/wiz/core/engine/battle/actors/character"
import { WizBattleParty } from "@/lib/wiz/core/engine/battle/actors/party"
import { WorldContent } from "@/lib/wiz/core/content/world-content"
import { WizSceneBattleCharacterAdapter } from "@/lib/wiz/core/runtime/converters/battle-character-adapter"
import { WizSceneBattleStatusConversionService } from "@/lib/wiz/core/runtime/converters/wiz-status-conversion-service"
import type {
  WizVaultPartyMemberState,
  WizVaultPlayerState,
} from "@/lib/wiz/core/vault/states/player/schema"
import type {
  WizStandardEquipmentState,
  WizStandardInventoryState,
  WizVaultObject,
} from "@/lib/wiz/core/vault/types"
import type { WizDefaultBattleStatus } from "@/lib/wiz/core/types/wiz-types"

type MagicBattleStatus = WizDefaultBattleStatus & {
  readonly magic: number
}

const createPlayerState = (overrides: Partial<WizVaultPlayerState> = {}): WizVaultPlayerState => ({
  name: "TestHero",
  level: 5,
  exp: 200,
  expToNextLevel: 300,
  hp: 80,
  maxHp: 100,
  mp: 20,
  maxMp: 30,
  hunger: 80,
  ap: 5,
  maxAp: 5,
  gold: 500,
  attributes: {
    strength: 10,
    dexterity: 8,
    agility: 7,
    vitality: 9,
    wisdom: 6,
    charisma: 5,
  },
  abilityIds: [],
  ...overrides,
})

const createPartyMemberState = (
  overrides: Partial<WizVaultPartyMemberState> = {},
): WizVaultPartyMemberState => ({
  id: "elena",
  name: "Elena",
  classId: "healer" as const,
  level: 3,
  hp: 35,
  maxHp: 35,
  mp: 30,
  maxMp: 30,
  attributes: {
    strength: 3,
    dexterity: 4,
    agility: 4,
    vitality: 4,
    wisdom: 8,
    charisma: 6,
  },
  abilityIds: ["heal"],
  ...overrides,
})

const createMinimalVault = (
  player: WizVaultPlayerState,
  partyMembers: WizVaultPartyMemberState[] = [],
  inventory: WizStandardInventoryState = { capacity: 20, entries: [] },
  equipment: WizStandardEquipmentState = {},
): WizVaultObject => ({
  player,
  partyMembers,
  inventory,
  equipment,
  time: { day: 1, season: "spring", timeOfDay: "morning", weather: "sunny" },
  areas: [],
  npcs: [],
  quests: [],
  flags: [],
  log: [],
  unlockedFacilities: [],
  isEnded: false,
})

describe("WizSceneBattleCharacterAdapter", () => {
  describe("fromPlayer", () => {
    it("vault のプレイヤーデータから WizBattleCharacter に変換できる", () => {
      const adapter = WizSceneBattleCharacterAdapter.createDefault()
      const player = createPlayerState()

      const character = adapter.fromPlayer(player)

      expect(character).toBeInstanceOf(WizBattleCharacter)
      expect(character.id).toBe("player")
      expect(character.name).toBe("TestHero")
      expect(character.status.resources.current("health")).toBe(80)
      expect(character.status.resources.maximum("health")).toBe(100)
      expect(character.status.resources.current("mana")).toBe(20)
      expect(character.status.resources.maximum("mana")).toBe(30)
      expect(character.custom).toEqual({ abilityIds: [] })
      expect(character.effects.effects).toHaveLength(0)
    })

    it("ステータス変換サービスの計算式が適用される", () => {
      const service = WizSceneBattleStatusConversionService.createDefault()
      const adapter = new WizSceneBattleCharacterAdapter(service)
      const player = createPlayerState({
        attributes: {
          strength: 10,
          dexterity: 8,
          agility: 7,
          vitality: 9,
          wisdom: 6,
          charisma: 5,
        },
      })

      const character = adapter.fromPlayer(player)

      // DEFAULT_STATUS_CONVERSION_CONFIG:
      // attack = 10 + strength * 2 = 10 + 10*2 = 30
      // defense = 5 + vitality * 1 = 5 + 9*1 = 14
      // speed = 0 + agility * 1 = 0 + 7*1 = 7
      expect(character.status.attributes.value("attack")).toBe(30)
      expect(character.status.attributes.value("defense")).toBe(14)
      expect(character.status.attributes.value("speed")).toBe(7)
    })

    it("customAttributesから型付きBattleStatusを生成する", () => {
      const service = new WizSceneBattleStatusConversionService<MagicBattleStatus>({
        attackBase: 10,
        attackPerStrength: 2,
        defenseBase: 5,
        defensePerVitality: 1,
        speedBase: 0,
        speedPerAgility: 1,
        maxHpBase: 30,
        maxHpPerVitality: 4,
        maxMpBase: 10,
        maxMpPerWisdom: 3,
        customStatusFormula: (input) => ({
          magic: (input.wisdom ?? 0) + (input.customAttributes?.luck ?? 0),
        }),
      })
      const adapter = new WizSceneBattleCharacterAdapter<MagicBattleStatus>(service)
      const player = createPlayerState({
        customAttributes: { luck: 10 },
      })

      const character = adapter.fromPlayer(player)

      expect(character.status.custom.magic).toBe(16)
      expect(character.status.toFormulaView().magic).toBe(16)
    })
  })

  describe("fromPartyMember", () => {
    it("パーティメンバーも変換できる", () => {
      const adapter = WizSceneBattleCharacterAdapter.createDefault()
      const member = createPartyMemberState()

      const character = adapter.fromPartyMember(member)

      expect(character).toBeInstanceOf(WizBattleCharacter)
      expect(character.id).toBe("elena")
      expect(character.name).toBe("Elena")
      expect(character.status.resources.current("health")).toBe(35)
      expect(character.status.resources.maximum("health")).toBe(35)
      expect(character.status.resources.current("mana")).toBe(30)
      expect(character.status.resources.maximum("mana")).toBe(30)
      expect(character.custom).toEqual({ classId: "healer", abilityIds: ["heal"] })
    })

    it("パーティメンバーのステータスが計算される", () => {
      const adapter = WizSceneBattleCharacterAdapter.createDefault()
      const member = createPartyMemberState({
        attributes: {
          strength: 3,
          dexterity: 4,
          agility: 4,
          vitality: 4,
          wisdom: 8,
          charisma: 6,
        },
      })

      const character = adapter.fromPartyMember(member)

      // attack = 10 + 3*2 = 16
      // defense = 5 + 4*1 = 9
      // speed = 0 + 4*1 = 4
      expect(character.status.attributes.value("attack")).toBe(16)
      expect(character.status.attributes.value("defense")).toBe(9)
      expect(character.status.attributes.value("speed")).toBe(4)
    })
  })

  describe("partyFromVault", () => {
    it("装備のステータスボーナスが反映される", () => {
      const content = WorldContent.create({
        weapons: [
          {
            id: "iron-sword",
            name: "Iron Sword",
            description: "A basic sword",
            price: 100,
            sellPrice: 50,
            attack: 5,
            dexterityBonus: 2,
            slotId: "mainHand",
          },
        ],
        armors: [
          {
            id: "leather-armor",
            name: "Leather Armor",
            description: "Basic armor",
            price: 80,
            sellPrice: 40,
            defense: 3,
            agilityPenalty: 1,
            slotId: "body",
          },
        ],
      })

      const adapter = new WizSceneBattleCharacterAdapter(
        WizSceneBattleStatusConversionService.createDefault(),
        content,
      )

      const player = createPlayerState({
        attributes: {
          strength: 10,
          dexterity: 8,
          agility: 7,
          vitality: 9,
          wisdom: 6,
          charisma: 5,
        },
      })

      const vault = createMinimalVault(
        player,
        [],
        {
          capacity: 2,
          entries: [
            {
              entryId: "iron-sword-entry",
              contentType: "weapon",
              contentId: "iron-sword",
              quantity: 1,
            },
            {
              entryId: "leather-armor-entry",
              contentType: "armor",
              contentId: "leather-armor",
              quantity: 1,
            },
          ],
        },
        {
          mainHand: "iron-sword-entry",
          body: "leather-armor-entry",
        },
      )

      const party = adapter.partyFromVault(vault)

      expect(party).toBeInstanceOf(WizBattleParty)
      expect(party.members.length).toBe(1)

      const playerChar = party.members[0]
      // base attack = 10 + 10*2 = 30, + weapon bonus 5 = 35
      expect(playerChar.status.attributes.value("attack")).toBe(35)
      // base defense = 5 + 9*1 = 14, + armor bonus 3 = 17
      expect(playerChar.status.attributes.value("defense")).toBe(17)
      // base speed = 0 + (7 + dexBonus 2 - agiPenalty 1)*1 = 8
      expect(playerChar.status.attributes.value("speed")).toBe(8)
    })

    it("装備なしの場合は基本ステータスのみ", () => {
      const adapter = WizSceneBattleCharacterAdapter.createDefault()
      const player = createPlayerState()
      const vault = createMinimalVault(player)

      const party = adapter.partyFromVault(vault)

      expect(party.members.length).toBe(1)
      expect(party.members[0].id).toBe("player")
    })

    it("HP が 0 のパーティメンバーは除外される", () => {
      const adapter = WizSceneBattleCharacterAdapter.createDefault()
      const player = createPlayerState()
      const deadMember = createPartyMemberState({ id: "dead-member", hp: 0 })
      const aliveMember = createPartyMemberState({ id: "alive-member", hp: 30 })

      const vault = createMinimalVault(player, [deadMember, aliveMember])

      const party = adapter.partyFromVault(vault)

      // player + alive member = 2 (dead member excluded)
      expect(party.members.length).toBe(2)
      const memberIds = party.members.map((m) => m.id)
      expect(memberIds).toContain("player")
      expect(memberIds).toContain("alive-member")
      expect(memberIds).not.toContain("dead-member")
    })

    it("duplicate actor ID を battle party へ変換しない", () => {
      const adapter = WizSceneBattleCharacterAdapter.createDefault()
      const player = createPlayerState()
      const first = createPartyMemberState({ id: "duplicate" })
      const second = createPartyMemberState({ id: "duplicate" })

      expect(() => adapter.partyFromVault(createMinimalVault(player, [first, second]))).toThrow(
        'Duplicate party actor ID "duplicate"',
      )
    })

    it("canonical player と衝突する party member ID を変換しない", () => {
      const adapter = WizSceneBattleCharacterAdapter.createDefault()
      const player = createPlayerState()
      const reserved = createPartyMemberState({ id: "player" })

      expect(() => adapter.partyFromVault(createMinimalVault(player, [reserved]))).toThrow(
        'partyMembers[0].id cannot be "player"',
      )
    })
  })

  describe("partyFromPlayer", () => {
    it("プレイヤーのみのパーティを作成できる", () => {
      const adapter = WizSceneBattleCharacterAdapter.createDefault()
      const player = createPlayerState()

      const party = adapter.partyFromPlayer(player)

      expect(party).toBeInstanceOf(WizBattleParty)
      expect(party.members.length).toBe(1)
      expect(party.members[0].id).toBe("player")
      expect(party.members[0].name).toBe("TestHero")
    })
  })

  it("偽装したstatus conversion serviceを受け入れない", () => {
    const forged = Object.create(WizSceneBattleStatusConversionService.prototype)

    expect(() => Reflect.construct(WizSceneBattleCharacterAdapter, [forged])).toThrow(
      "was not created by its constructor",
    )
  })

  it("classとprototypeを固定する", () => {
    expect(Object.isFrozen(WizSceneBattleCharacterAdapter)).toBe(true)
    expect(Object.isFrozen(WizSceneBattleCharacterAdapter.prototype)).toBe(true)
  })
})
