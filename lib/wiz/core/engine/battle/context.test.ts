import { expect, test } from "vite-plus/test"
import { WizEngineBattleContext } from "@/lib/wiz/core/engine/battle/context"
import { WizEngineBattleActionBuilder } from "@/lib/wiz/core/engine/battle/turn-action-builder"
import type { WizEngineBattleTurnAction } from "@/lib/wiz/core/engine/battle/turn-action"
import { wizMockMixedEnemyParty } from "@/lib/wiz/core/mocks/wiz-mock-mixed-enemy-party"
import { wizMockFullParty } from "@/lib/wiz/core/mocks/wiz-mock-full-party"

const actionBuilder = new WizEngineBattleActionBuilder({
  nextId: () => "test-action",
})

const createContext = () =>
  new WizEngineBattleContext({
    id: "battle-1",
    turnNumber: 1,
    party: wizMockFullParty(),
    enemies: wizMockMixedEnemyParty(),
    executedActions: [],
    initiative: "none",
  })

test("withParty は新しいコンテキストを返す", () => {
  const context = createContext()
  const newParty = context.party.withDamageToMember("hero-1", 10)

  const newContext = context.withParty(newParty)

  expect(newContext.party).toBe(newParty)
  expect(context.party).not.toBe(newParty)
})

test("withEnemies は新しいコンテキストを返す", () => {
  const context = createContext()
  const newEnemies = context.enemies.withDamageToMonster("goblin-1", 10)

  const newContext = context.withEnemies(newEnemies)

  expect(newContext.enemies).toBe(newEnemies)
  expect(context.enemies).not.toBe(newEnemies)
})

test("constructor はexecuted action配列をdefensive copyして所有する", () => {
  const action = actionBuilder.attack("hero-1", "goblin-1")
  const executedActions: WizEngineBattleTurnAction[] = [action]
  const context = new WizEngineBattleContext({
    id: "battle-owned",
    turnNumber: 1,
    party: wizMockFullParty(),
    enemies: wizMockMixedEnemyParty(),
    executedActions,
    initiative: "party",
  })

  executedActions.length = 0

  expect(context.executedActions).toEqual([action])
  expect(Object.isFrozen(context.executedActions)).toBe(true)
})

test("withExecutedAction はアクションをexecutedActionsへ追加する", () => {
  const context = createContext()
  const action = actionBuilder.attack("hero-1", "goblin-1")

  const withExecuted = context.withExecutedAction(action)

  expect(withExecuted.executedActions).toHaveLength(1)
})

test("withNextTurn はターン数を増やす", () => {
  const context = createContext()

  const nextTurn = context.withNextTurn()

  expect(nextTurn.turnNumber).toBe(2)
  expect(nextTurn.executedActions).toHaveLength(0)
})

test("isPartyDefeated はパーティが全滅した場合 true を返す", () => {
  const context = createContext()
  let defeatedContext = context
  for (const member of context.party.members) {
    defeatedContext = defeatedContext.withDamageToPartyMember(
      member.id,
      member.status.resources.current("health")
    )
  }

  expect(defeatedContext.isPartyDefeated()).toBe(true)
})

test("isEnemiesDefeated は敵が全滅した場合 true を返す", () => {
  const context = createContext()
  let defeatedContext = context
  for (const monster of context.enemies.getAllMonsters()) {
    defeatedContext = defeatedContext.withDamageToEnemy(
      monster.id,
      monster.status.resources.current("health")
    )
  }

  expect(defeatedContext.isEnemiesDefeated()).toBe(true)
})

test("isBattleOver はどちらかが全滅した場合 true を返す", () => {
  const context = createContext()

  expect(context.isBattleOver()).toBe(false)

  let defeatedContext = context
  for (const member of context.party.members) {
    defeatedContext = defeatedContext.withDamageToPartyMember(
      member.id,
      member.status.resources.current("health")
    )
  }

  expect(defeatedContext.isBattleOver()).toBe(true)
})

test("withDamageToPartyMember はメンバーにダメージを与える", () => {
  const context = createContext()
  const originalHp =
    context.party.getMemberById("hero-1")?.status.resources.current("health") ??
    0

  const damaged = context.withDamageToPartyMember("hero-1", 10)

  expect(
    damaged.party.getMemberById("hero-1")?.status.resources.current("health")
  ).toBe(originalHp - 10)
})

test("withHealToPartyMember はメンバーを回復する", () => {
  const context = createContext()
  const damaged = context.withDamageToPartyMember("hero-1", 20)

  const healed = damaged.withHealToPartyMember("hero-1", 10)

  expect(
    healed.party.getMemberById("hero-1")?.status.resources.current("health")
  ).toBe(
    (damaged.party
      .getMemberById("hero-1")
      ?.status.resources.current("health") ?? 0) + 10
  )
})

test("withDamageToEnemy は敵にダメージを与える", () => {
  const context = createContext()
  const originalHp =
    context.enemies
      .getMonsterById("goblin-1")
      ?.status.resources.current("health") ?? 0

  const damaged = context.withDamageToEnemy("goblin-1", 5)

  expect(
    damaged.enemies
      .getMonsterById("goblin-1")
      ?.status.resources.current("health")
  ).toBe(originalHp - 5)
})

test("withDamageToEnemyGroup はグループ全体にダメージを与える", () => {
  const context = createContext()

  const damaged = context.withDamageToEnemyGroup("goblin-group", 3)

  for (const monster of damaged.enemies.getGroupById("goblin-group")?.members ??
    []) {
    const original = context.enemies.getMonsterById(monster.id)
    expect(monster.status.resources.current("health")).toBeLessThan(
      original?.status.resources.current("health") ?? 0
    )
  }
})

test("withDamageToAllEnemies は全敵にダメージを与える", () => {
  const context = createContext()

  const damaged = context.withDamageToAllEnemies(2)

  for (const monster of damaged.enemies.getAllMonsters()) {
    const original = context.enemies.getMonsterById(monster.id)
    expect(monster.status.resources.current("health")).toBeLessThan(
      original?.status.resources.current("health") ?? 0
    )
  }
})

test("getActorSpeed はパーティメンバーのスピードを返す", () => {
  const context = createContext()

  const speed = context.getActorSpeed("hero-1")

  expect(speed).toBeGreaterThan(0)
})

test("getActorSpeed はモンスターのスピードを返す", () => {
  const context = createContext()

  const speed = context.getActorSpeed("goblin-1")

  expect(speed).toBeGreaterThan(0)
})

test("canActorAct は生存者に true を返す", () => {
  const context = createContext()

  expect(context.canActorAct("hero-1")).toBe(true)
  expect(context.canActorAct("goblin-1")).toBe(true)
})

test("canActorAct は死亡者に false を返す", () => {
  const context = createContext()
  const heroHp =
    context.party.getMemberById("hero-1")?.status.resources.current("health") ??
    0
  const defeated = context.withDamageToPartyMember("hero-1", heroHp)

  expect(defeated.canActorAct("hero-1")).toBe(false)
})

test("isActorAlive は生存者に true を返す", () => {
  const context = createContext()

  expect(context.isActorAlive("hero-1")).toBe(true)
})

test("getActorById はパーティメンバーを返す", () => {
  const context = createContext()

  const actor = context.getActorById("hero-1")

  expect(actor?.id).toBe("hero-1")
})

test("getActorById はモンスターを返す", () => {
  const context = createContext()

  const actor = context.getActorById("goblin-1")

  expect(actor?.id).toBe("goblin-1")
})

test("getActorById は存在しない ID で undefined を返す", () => {
  const context = createContext()

  const actor = context.getActorById("nonexistent")

  expect(actor).toBeUndefined()
})
