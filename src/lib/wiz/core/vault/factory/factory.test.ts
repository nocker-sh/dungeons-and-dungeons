import { expect, test } from "vite-plus/test"
import type { WizContentArea } from "@/lib/wiz/core/definition/area/area"
import type { WizContentEvent } from "@/lib/wiz/core/definition/event/event"
import type { WizContentMonster } from "@/lib/wiz/core/definition/monster/monster"
import type { WizContentNpc } from "@/lib/wiz/core/definition/npc/npc"
import type { WizContentQuest } from "@/lib/wiz/core/definition/quest/quest"
import { WizVaultFactory } from "@/lib/wiz/core/vault/factory/factory"

const mockMonsters: WizContentMonster[] = [
  {
    id: "slime",
    name: "Slime",
    hp: 10,
    attack: 3,
    defense: 1,
    agility: 5,
    expReward: 5,
    goldReward: 3,
    drops: [],
  },
]

const mockEvents: WizContentEvent[] = [{ id: "event1", description: "Test event", choices: [] }]

const mockAreas: WizContentArea[] = [
  {
    id: "forest",
    name: "Forest",
    description: "A forest",
    dangerLevel: 1,
    apCost: 1,
    unlocked: true,
    monsterIds: ["slime"],
    eventIds: ["event1"],
    availableGathering: [],
  },
]

const mockNpcs: WizContentNpc[] = [
  {
    id: "elder",
    name: "Elder",
    occupation: "Village Elder",
    personality: "wise",
    initialAffinity: 50,
    dialogues: [],
    likes: [],
    dislikes: [],
  },
]

const mockQuests: WizContentQuest[] = [
  {
    id: "quest1",
    name: "Defeat Slimes",
    description: "Defeat 3 slimes",
    giverNpcId: "elder",
    objective: { type: "defeat", monsterId: "slime", count: 3 },
    reward: { gold: 100, exp: 50, affinityBonus: 10, items: [] },
  },
]

test("createInitialVault は WizVaultValue を返す", () => {
  const factory = new WizVaultFactory({
    monsters: mockMonsters,
    events: mockEvents,
    areas: mockAreas,
    npcs: mockNpcs,
    quests: mockQuests,
    equipmentSlotIds: ["mainHand", "body"],
  })

  const vault = factory.createInitialVault()

  expect(vault).toBeDefined()
  expect(vault.isEnded).toBe(false)
  expect(vault.flags).toEqual([])
  expect(vault.log).toHaveLength(1)
  expect(vault.log[0]).toEqual({ key: "WORLD_STARTED" })
  expect(vault.equipment.toPlain()).toEqual({ mainHand: null, body: null })
})

test("getMonsters はモンスター一覧を返す", () => {
  const factory = new WizVaultFactory({
    monsters: mockMonsters,
    events: mockEvents,
    areas: mockAreas,
    npcs: mockNpcs,
    quests: mockQuests,
    equipmentSlotIds: [],
  })

  const monsters = factory.getMonsters()

  expect(monsters.slime).toBeDefined()
  expect(monsters.slime.name).toBe("Slime")
})

test("getAreas はエリア一覧を返す", () => {
  const factory = new WizVaultFactory({
    monsters: mockMonsters,
    events: mockEvents,
    areas: mockAreas,
    npcs: mockNpcs,
    quests: mockQuests,
    equipmentSlotIds: [],
  })

  const areas = factory.getAreas()

  expect(areas).toHaveLength(1)
  expect(areas[0].id).toBe("forest")
})

test("getNpcs は NPC 一覧を返す", () => {
  const factory = new WizVaultFactory({
    monsters: mockMonsters,
    events: mockEvents,
    areas: mockAreas,
    npcs: mockNpcs,
    quests: mockQuests,
    equipmentSlotIds: [],
  })

  const npcs = factory.getNpcs()

  expect(npcs).toHaveLength(1)
  expect(npcs[0].id).toBe("elder")
})

test("getQuests はクエスト一覧を返す", () => {
  const factory = new WizVaultFactory({
    monsters: mockMonsters,
    events: mockEvents,
    areas: mockAreas,
    npcs: mockNpcs,
    quests: mockQuests,
    equipmentSlotIds: [],
  })

  const quests = factory.getQuests()

  expect(quests).toHaveLength(1)
  expect(quests[0].id).toBe("quest1")
  expect(quests[0].completed).toBe(false)
  expect(quests[0].accepted).toBe(false)
})

test("全 getter は source と getter の変更から隔離した canonical graph を返す", () => {
  const monsters = structuredClone(mockMonsters)
  const events = structuredClone(mockEvents)
  const areas = structuredClone(mockAreas)
  const npcs = structuredClone(mockNpcs)
  const quests = structuredClone(mockQuests)
  const factory = new WizVaultFactory({
    monsters,
    events,
    areas,
    npcs,
    quests,
    equipmentSlotIds: [],
  })

  monsters[0].name = "Changed"
  events[0].description = "Changed"
  areas[0].name = "Changed"
  npcs[0].name = "Changed"
  quests[0].name = "Changed"

  const ownedMonsters = factory.getMonsters()
  const ownedEvents = factory.getEvents()
  const ownedAreas = factory.getAreas()
  const ownedNpcs = factory.getNpcs()
  const ownedQuests = factory.getQuests()

  expect(Object.getPrototypeOf(ownedMonsters)).toBeNull()
  expect(Object.getPrototypeOf(ownedEvents)).toBeNull()
  expect(Object.isFrozen(ownedMonsters)).toBe(true)
  expect(Object.isFrozen(ownedEvents)).toBe(true)
  expect(Object.isFrozen(ownedAreas)).toBe(true)
  expect(Object.isFrozen(ownedNpcs)).toBe(true)
  expect(Object.isFrozen(ownedQuests)).toBe(true)
  expect(factory.getMonsters()).toBe(ownedMonsters)
  expect(factory.getEvents()).toBe(ownedEvents)
  expect(factory.getAreas()).toBe(ownedAreas)
  expect(factory.getNpcs()).toBe(ownedNpcs)
  expect(factory.getQuests()).toBe(ownedQuests)
  expect(ownedAreas[0].monsters[0]).toBe(ownedMonsters.slime)
  expect(ownedAreas[0].events[0]).toBe(ownedEvents.event1)
  expect(ownedMonsters.slime.name).toBe("Slime")
  expect(ownedEvents.event1.description).toBe("Test event")
  expect(ownedAreas[0].name).toBe("Forest")
  expect(ownedNpcs[0].name).toBe("Elder")
  expect(ownedQuests[0].name).toBe("Defeat Slimes")

  expect(Reflect.set(ownedMonsters.slime, "name", "Changed through getter")).toBe(false)
  expect(Reflect.set(ownedEvents.event1, "description", "Changed through getter")).toBe(false)
  expect(Reflect.set(ownedAreas[0], "name", "Changed through getter")).toBe(false)
  expect(Reflect.set(ownedNpcs[0], "name", "Changed through getter")).toBe(false)
  expect(Reflect.set(ownedQuests[0], "name", "Changed through getter")).toBe(false)

  expect(factory.getMonsters().slime.name).toBe("Slime")
  expect(factory.getEvents().event1.description).toBe("Test event")
  expect(factory.getAreas()[0].name).toBe("Forest")
  expect(factory.getNpcs()[0].name).toBe("Elder")
  expect(factory.getQuests()[0].name).toBe("Defeat Slimes")
})
