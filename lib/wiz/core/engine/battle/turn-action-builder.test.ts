import { expect, test } from "vite-plus/test"
import { WizEngineBattleActionBuilder } from "@/lib/wiz/core/engine/battle/turn-action-builder"

const actionBuilder = new WizEngineBattleActionBuilder({
  nextId: () => "test-action-id",
})

test("attack は攻撃アクションを作成する", () => {
  const action = actionBuilder.attack("hero-1", "goblin-1")

  expect(action.type).toBe("attack")
  expect(action.actorId).toBe("hero-1")
  expect(action.targetIds).toEqual(["goblin-1"])
})

test("defend は防御アクションを作成する", () => {
  const action = actionBuilder.defend("hero-1")

  expect(action.type).toBe("defend")
  expect(action.actorId).toBe("hero-1")
})

test("flee は逃走アクションを作成する", () => {
  const action = actionBuilder.flee("hero-1")

  expect(action.type).toBe("flee")
  expect(action.actorId).toBe("hero-1")
})

test("skill はスキルアクションを作成する", () => {
  const action = actionBuilder.ability("mage-1", "fireball", ["goblin-1", "goblin-2"])

  expect(action.type).toBe("ability")
  expect(action.actorId).toBe("mage-1")
  expect(action.abilityId).toBe("fireball")
  expect(action.targetIds).toEqual(["goblin-1", "goblin-2"])
})

test("item はアイテムアクションを作成する", () => {
  const action = actionBuilder.item("healer-1", "potion", ["hero-1"])

  expect(action.type).toBe("item")
  expect(action.actorId).toBe("healer-1")
  expect(action.itemId).toBe("potion")
  expect(action.targetIds).toEqual(["hero-1"])
})

test("ID source を注入できる", () => {
  const builder = new WizEngineBattleActionBuilder({ nextId: () => "fixed-action-id" })

  const action = builder.attack("hero-1", "goblin-1")

  expect(action.id).toBe("fixed-action-id")
})

test.each(["", "   ", " padded "])("不正なID sourceの値 %j を拒否する", (id) => {
  const builder = new WizEngineBattleActionBuilder({ nextId: () => id })

  expect(() => builder.attack("hero-1", "goblin-1")).toThrow(
    "ID source must return a non-empty string without surrounding whitespace",
  )
})
