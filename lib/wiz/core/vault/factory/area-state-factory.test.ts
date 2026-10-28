import { expect, test } from "vite-plus/test"
import { WizVaultAreaStateFactory } from "@/lib/wiz/core/vault/factory/area-state-factory"
import { WizVaultEventStateFactory } from "@/lib/wiz/core/vault/factory/event-state-factory"
import { WizVaultMonsterStateFactory } from "@/lib/wiz/core/vault/factory/monster-state-factory"

const mockMonsters = [
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

const mockEvents = [{ id: "event1", description: "Test event", choices: [] }]

const mockAreas = [
  {
    id: "forest",
    name: "Forest",
    description: "A dense forest",
    dangerLevel: 1,
    apCost: 1,
    unlocked: true,
    monsterIds: ["slime"],
    eventIds: ["event1"],
    availableGathering: ["herb"],
  },
  {
    id: "cave",
    name: "Cave",
    description: "A dark cave",
    dangerLevel: 3,
    apCost: 2,
    unlocked: false,
    unlockCondition: { areaId: "forest", requiredProgress: 50 },
    monsterIds: [],
    eventIds: [],
    availableGathering: [],
  },
]

test("getAll はエリア一覧を返す", () => {
  const monsterFactory = new WizVaultMonsterStateFactory({ defs: mockMonsters })
  const eventFactory = new WizVaultEventStateFactory({ defs: mockEvents })
  const factory = new WizVaultAreaStateFactory({
    defs: mockAreas,
    monsterFactory,
    eventFactory,
  })

  const areas = factory.getAll()

  expect(areas).toHaveLength(2)
  expect(areas[0].id).toBe("forest")
  expect(areas[1].id).toBe("cave")
})

test("エリアの progress は 0 で初期化される", () => {
  const monsterFactory = new WizVaultMonsterStateFactory({ defs: mockMonsters })
  const eventFactory = new WizVaultEventStateFactory({ defs: mockEvents })
  const factory = new WizVaultAreaStateFactory({
    defs: mockAreas,
    monsterFactory,
    eventFactory,
  })

  const areas = factory.getAll()

  expect(areas[0].progress).toBe(0)
  expect(areas[1].progress).toBe(0)
})

test("エリアにモンスターが紐づく", () => {
  const monsterFactory = new WizVaultMonsterStateFactory({ defs: mockMonsters })
  const eventFactory = new WizVaultEventStateFactory({ defs: mockEvents })
  const factory = new WizVaultAreaStateFactory({
    defs: mockAreas,
    monsterFactory,
    eventFactory,
  })

  const areas = factory.getAll()

  expect(areas[0].monsters).toHaveLength(1)
  expect(areas[0].monsters[0].id).toBe("slime")
})

test("エリアにイベントが紐づく", () => {
  const monsterFactory = new WizVaultMonsterStateFactory({ defs: mockMonsters })
  const eventFactory = new WizVaultEventStateFactory({ defs: mockEvents })
  const factory = new WizVaultAreaStateFactory({
    defs: mockAreas,
    monsterFactory,
    eventFactory,
  })

  const areas = factory.getAll()

  expect(areas[0].events).toHaveLength(1)
  expect(areas[0].events[0].id).toBe("event1")
})

test("unlockCondition が保持される", () => {
  const monsterFactory = new WizVaultMonsterStateFactory({ defs: mockMonsters })
  const eventFactory = new WizVaultEventStateFactory({ defs: mockEvents })
  const factory = new WizVaultAreaStateFactory({
    defs: mockAreas,
    monsterFactory,
    eventFactory,
  })

  const areas = factory.getAll()
  const cave = areas.find((a) => a.id === "cave")

  expect(cave?.unlockCondition).toBeDefined()
  expect(cave?.unlockCondition?.areaId).toBe("forest")
  expect(cave?.unlockCondition?.requiredProgress).toBe(50)
})

test("source と getter から変更できない canonical owned graph を返す", () => {
  const monsterDefs = [
    {
      id: "slime",
      name: "Slime",
      hp: 10,
      attack: 3,
      defense: 1,
      agility: 5,
      expReward: 5,
      goldReward: 3,
      drops: [{ itemId: "herb", chance: 25 }],
    },
  ]
  const eventDefs = [
    {
      id: "event1",
      description: "Test event",
      choices: [],
    },
  ]
  const areaDefs = [
    {
      id: "forest",
      name: "Forest",
      description: "A dense forest",
      dangerLevel: 1,
      apCost: 1,
      unlocked: true,
      unlockCondition: { areaId: "village", requiredProgress: 10 },
      monsterIds: ["slime"],
      eventIds: ["event1"],
      availableGathering: ["herb"],
    },
  ]
  const monsterFactory = new WizVaultMonsterStateFactory({ defs: monsterDefs })
  const eventFactory = new WizVaultEventStateFactory({ defs: eventDefs })
  const factory = new WizVaultAreaStateFactory({
    defs: areaDefs,
    monsterFactory,
    eventFactory,
  })

  monsterDefs[0].name = "Changed"
  eventDefs[0].description = "Changed"
  areaDefs[0].name = "Changed"
  areaDefs[0].availableGathering[0] = "ore"
  areaDefs[0].unlockCondition.requiredProgress = 99

  const areas = factory.getAll()
  const area = areas[0]

  expect(Object.isFrozen(areas)).toBe(true)
  expect(Object.isFrozen(area)).toBe(true)
  expect(Object.isFrozen(area.availableGathering)).toBe(true)
  expect(Object.isFrozen(area.unlockCondition)).toBe(true)
  expect(area.monsters[0]).toBe(monsterFactory.get("slime"))
  expect(area.events[0]).toBe(eventFactory.get("event1"))
  expect(area.name).toBe("Forest")
  expect(area.availableGathering).toEqual(["herb"])
  expect(area.unlockCondition?.requiredProgress).toBe(10)
  expect(area.monsters[0].name).toBe("Slime")
  expect(area.events[0].description).toBe("Test event")

  expect(Reflect.set(area, "name", "Changed through getter")).toBe(false)
  expect(Reflect.set(area.availableGathering, 0, "ore")).toBe(false)
  if (!area.unlockCondition) {
    throw new Error("Expected unlock condition")
  }
  expect(Reflect.set(area.unlockCondition, "requiredProgress", 99)).toBe(false)
  expect(Reflect.set(area.monsters[0], "name", "Changed through getter")).toBe(false)

  expect(factory.getAll()[0].name).toBe("Forest")
  expect(factory.getAll()[0].availableGathering).toEqual(["herb"])
  expect(factory.getAll()[0].unlockCondition?.requiredProgress).toBe(10)
  expect(factory.getAll()[0].monsters[0].name).toBe("Slime")
})
