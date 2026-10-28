import { expect, test } from "vite-plus/test"
import { WizVaultMissingDefinitionError } from "@/lib/wiz/core/vault/factory/missing-definition-error"
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
  {
    id: "goblin",
    name: "Goblin",
    hp: 20,
    attack: 5,
    defense: 2,
    agility: 4,
    expReward: 10,
    goldReward: 8,
    drops: [{ itemId: "gold_coin", chance: 0.5 }],
  },
]

test("get はモンスターを ID で取得できる", () => {
  const factory = new WizVaultMonsterStateFactory({ defs: mockMonsters })

  const slime = factory.get("slime")

  expect(slime).toBeDefined()
  expect(slime?.name).toBe("Slime")
  expect(slime?.hp).toBe(10)
  expect(slime?.maxHp).toBe(10)
})

test("get は存在しない ID で undefined を返す", () => {
  const factory = new WizVaultMonsterStateFactory({ defs: mockMonsters })

  const result = factory.get("dragon")

  expect(result).toBeUndefined()
})

test("getAll は全モンスターの Record を返す", () => {
  const factory = new WizVaultMonsterStateFactory({ defs: mockMonsters })

  const all = factory.getAll()

  expect(Object.keys(all)).toHaveLength(2)
  expect(all.slime).toBeDefined()
  expect(all.goblin).toBeDefined()
})

test("getMany は指定した ID のモンスター配列を返す", () => {
  const factory = new WizVaultMonsterStateFactory({ defs: mockMonsters })

  const result = factory.getMany(["slime", "goblin"])

  expect(result).toHaveLength(2)
  expect(result[0].id).toBe("slime")
  expect(result[1].id).toBe("goblin")
})

test("getMany は存在しない ID を黙ってスキップせず全件報告する", () => {
  const factory = new WizVaultMonsterStateFactory({ defs: mockMonsters })

  expect(() => factory.getMany(["slime", "dragon", "phoenix", "goblin"])).toThrow(
    WizVaultMissingDefinitionError,
  )

  try {
    factory.getMany(["dragon", "phoenix"])
  } catch (error) {
    expect(error).toBeInstanceOf(WizVaultMissingDefinitionError)
    expect((error as WizVaultMissingDefinitionError).definitionKind).toBe("monster")
    expect((error as WizVaultMissingDefinitionError).missingIds).toEqual(["dragon", "phoenix"])
  }
})

test("モンスター状態に maxHp が設定される", () => {
  const factory = new WizVaultMonsterStateFactory({ defs: mockMonsters })

  const goblin = factory.get("goblin")

  expect(goblin?.hp).toBe(20)
  expect(goblin?.maxHp).toBe(20)
})

test("source と getter から変更できない owned graph を返す", () => {
  const defs = [
    {
      id: "goblin",
      name: "Goblin",
      hp: 20,
      attack: 5,
      defense: 2,
      agility: 4,
      expReward: 10,
      goldReward: 8,
      drops: [{ itemId: "gold_coin", chance: 0.5 }],
    },
  ]
  const factory = new WizVaultMonsterStateFactory({ defs })

  defs[0].name = "Changed"
  defs[0].drops[0].chance = 100

  const all = factory.getAll()
  const goblin = factory.get("goblin")
  if (!goblin) {
    throw new Error("Expected goblin")
  }

  expect(Object.getPrototypeOf(all)).toBeNull()
  expect(Object.isFrozen(all)).toBe(true)
  expect(Object.isFrozen(goblin)).toBe(true)
  expect(Object.isFrozen(goblin.drops)).toBe(true)
  expect(Object.isFrozen(goblin.drops[0])).toBe(true)
  expect(factory.get("toString")).toBeUndefined()
  expect(goblin.name).toBe("Goblin")
  expect(goblin.drops[0].chance).toBe(0.5)

  expect(Reflect.set(goblin, "name", "Changed through getter")).toBe(false)
  expect(Reflect.set(goblin.drops[0], "chance", 100)).toBe(false)
  const many = factory.getMany(["goblin"])
  expect(Object.isFrozen(many)).toBe(true)
  expect(Reflect.set(many, 0, undefined)).toBe(false)

  expect(factory.get("goblin")?.name).toBe("Goblin")
  expect(factory.get("goblin")?.drops[0].chance).toBe(0.5)
})
