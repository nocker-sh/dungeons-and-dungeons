import { expect, test } from "vite-plus/test"
import { WizBattleEnemyParty } from "@/lib/wiz/core/engine/battle/actors/enemy-party"
import { createBattleEffect } from "@/lib/wiz/core/engine/battle/create-battle-effect"
import { WizEmptyEnemyPartyError } from "@/lib/wiz/core/errors"
import { wizMockGoblinGroup } from "@/lib/wiz/core/mocks/wiz-mock-goblin-group"
import { wizMockOrcGroup } from "@/lib/wiz/core/mocks/wiz-mock-orc-group"

test("constructor はグループが空の場合エラーを投げる", () => {
  expect(() => {
    new WizBattleEnemyParty({
      id: "empty-party",
      groups: [],
    })
  }).toThrow(WizEmptyEnemyPartyError)
})

test("getAllMonsters は全モンスターを返す", () => {
  const party = new WizBattleEnemyParty({
    id: "party-1",
    groups: [wizMockGoblinGroup(2), wizMockOrcGroup(1)],
  })

  const all = party.getAllMonsters()

  expect(all).toHaveLength(3)
})

test("getAliveCount は生存モンスター数を返す", () => {
  const party = new WizBattleEnemyParty({
    id: "party-1",
    groups: [wizMockGoblinGroup(3)],
  })

  expect(party.getAliveCount()).toBe(3)
})

test("getTotalCount は全モンスター数を返す", () => {
  const party = new WizBattleEnemyParty({
    id: "party-1",
    groups: [wizMockGoblinGroup(2), wizMockOrcGroup(2)],
  })

  expect(party.getTotalCount()).toBe(4)
})

test("getGroupById は指定 ID のグループを返す", () => {
  const party = new WizBattleEnemyParty({
    id: "party-1",
    groups: [wizMockGoblinGroup(2)],
  })

  const group = party.getGroupById("goblin-group")

  expect(group?.id).toBe("goblin-group")
})

test("getMonsterById は指定 ID のモンスターを返す", () => {
  const party = new WizBattleEnemyParty({
    id: "party-1",
    groups: [wizMockGoblinGroup(2)],
  })

  const monster = party.getMonsterById("goblin-1")

  expect(monster?.id).toBe("goblin-1")
})

test("withDamageToMonster はダメージを与えた新しいパーティを返す", () => {
  const party = new WizBattleEnemyParty({
    id: "party-1",
    groups: [wizMockGoblinGroup(2)],
  })
  const originalHp =
    party.getMonsterById("goblin-1")?.status.resources.current("health") ?? 0

  const damaged = party.withDamageToMonster("goblin-1", 5)

  expect(
    damaged.getMonsterById("goblin-1")?.status.resources.current("health")
  ).toBe(originalHp - 5)
  expect(
    party.getMonsterById("goblin-1")?.status.resources.current("health")
  ).toBe(originalHp)
})

test("withDamageToGroup はグループ全体にダメージを与える", () => {
  const party = new WizBattleEnemyParty({
    id: "party-1",
    groups: [wizMockGoblinGroup(2)],
  })

  const damaged = party.withDamageToGroup("goblin-group", 5)

  expect(
    damaged.getMonsterById("goblin-1")?.status.resources.current("health")
  ).toBeLessThan(
    party.getMonsterById("goblin-1")?.status.resources.current("health") ?? 0
  )
  expect(
    damaged.getMonsterById("goblin-2")?.status.resources.current("health")
  ).toBeLessThan(
    party.getMonsterById("goblin-2")?.status.resources.current("health") ?? 0
  )
})

test("withDamageToAll は全モンスターにダメージを与える", () => {
  const party = new WizBattleEnemyParty({
    id: "party-1",
    groups: [wizMockGoblinGroup(2), wizMockOrcGroup(1)],
  })

  const damaged = party.withDamageToAll(3)

  for (const monster of damaged.getAllMonsters()) {
    const original = party.getMonsterById(monster.id)
    expect(monster.status.resources.current("health")).toBeLessThan(
      original?.status.resources.current("health") ?? 0
    )
  }
})

test("withHealToMonster は回復した新しいパーティを返す", () => {
  const party = new WizBattleEnemyParty({
    id: "party-1",
    groups: [wizMockGoblinGroup(1)],
  })
  const damaged = party.withDamageToMonster("goblin-1", 10)

  const healed = damaged.withHealToMonster("goblin-1", 5)

  expect(
    healed.getMonsterById("goblin-1")?.status.resources.current("health")
  ).toBe(
    (damaged.getMonsterById("goblin-1")?.status.resources.current("health") ??
      0) + 5
  )
})

test("withEffectToMonster はステータス効果を付与する", () => {
  const party = new WizBattleEnemyParty({
    id: "party-1",
    groups: [wizMockGoblinGroup(1)],
  })
  const effect = createBattleEffect({
    instanceId: "poison-1",
    effectId: "poison",
    source: { kind: "system", id: "enemy-party-test" },
    name: "毒",
    lifetime: { type: "turns", remaining: 3 },
    custom: { value: 5 },
  })

  const affected = party.withEffectToMonster("goblin-1", effect)

  expect(affected.getMonsterById("goblin-1")?.effects.effects).toHaveLength(1)
})

test("isDefeated は全員倒れている場合 true を返す", () => {
  const party = new WizBattleEnemyParty({
    id: "party-1",
    groups: [wizMockGoblinGroup(1)],
  })
  const hp =
    party.getMonsterById("goblin-1")?.status.resources.current("health") ?? 0

  const defeated = party.withDamageToMonster("goblin-1", hp)

  expect(defeated.isDefeated()).toBe(true)
})

test("isDefeated は生存者がいる場合 false を返す", () => {
  const party = new WizBattleEnemyParty({
    id: "party-1",
    groups: [wizMockGoblinGroup(2)],
  })

  expect(party.isDefeated()).toBe(false)
})

test("getAliveGroups は全滅していないグループのみ返す", () => {
  const party = new WizBattleEnemyParty({
    id: "party-1",
    groups: [wizMockGoblinGroup(1), wizMockOrcGroup(1)],
  })
  const goblinHp =
    party.getMonsterById("goblin-1")?.status.resources.current("health") ?? 0
  const defeated = party.withDamageToMonster("goblin-1", goblinHp)

  const aliveGroups = defeated.getAliveGroups()

  expect(aliveGroups).toHaveLength(1)
  expect(aliveGroups[0].id).toBe("orc-group")
})

test("constructorはgroupsをdefensive copyしてfreezeする", () => {
  const first = wizMockGoblinGroup(1)
  const groups = [first]
  const party = new WizBattleEnemyParty({
    id: "party-1",
    groups,
  })

  groups.push(wizMockOrcGroup(1))

  expect(party.groups).toEqual([first])
  expect(party.groups).not.toBe(groups)
  expect(Object.isFrozen(party.groups)).toBe(true)
})
