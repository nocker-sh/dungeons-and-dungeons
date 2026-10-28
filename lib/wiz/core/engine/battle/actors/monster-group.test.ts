import { expect, test } from "vite-plus/test"
import { WizBattleMonsterGroup } from "@/lib/wiz/core/engine/battle/actors/monster-group"
import { createBattleEffect } from "@/lib/wiz/core/engine/battle/create-battle-effect"
import { wizMockGoblin } from "@/lib/wiz/core/mocks/wiz-mock-goblin"

test("getAliveCount は生存メンバー数を返す", () => {
  const group = new WizBattleMonsterGroup({
    id: "group-1",
    name: "Goblins",
    members: [wizMockGoblin(1), wizMockGoblin(2)],
  })

  expect(group.getAliveCount()).toBe(2)
})

test("getTotalCount は全メンバー数を返す", () => {
  const group = new WizBattleMonsterGroup({
    id: "group-1",
    name: "Goblins",
    members: [wizMockGoblin(1), wizMockGoblin(2), wizMockGoblin(3)],
  })

  expect(group.getTotalCount()).toBe(3)
})

test("getDisplayName は複数体の場合に x 数を付加する", () => {
  const group = new WizBattleMonsterGroup({
    id: "group-1",
    name: "Goblin",
    members: [wizMockGoblin(1), wizMockGoblin(2)],
  })

  expect(group.getDisplayName()).toBe("Goblin x 2")
})

test("getDisplayName は1体の場合に数を付加しない", () => {
  const group = new WizBattleMonsterGroup({
    id: "group-1",
    name: "Goblin",
    members: [wizMockGoblin(1)],
  })

  expect(group.getDisplayName()).toBe("Goblin")
})

test("getMemberById は指定 ID のメンバーを返す", () => {
  const goblin1 = wizMockGoblin(1)
  const group = new WizBattleMonsterGroup({
    id: "group-1",
    name: "Goblins",
    members: [goblin1, wizMockGoblin(2)],
  })

  const found = group.getMemberById("goblin-1")

  expect(found?.id).toBe("goblin-1")
})

test("getMemberById は存在しない ID で undefined を返す", () => {
  const group = new WizBattleMonsterGroup({
    id: "group-1",
    name: "Goblins",
    members: [wizMockGoblin(1)],
  })

  const found = group.getMemberById("nonexistent")

  expect(found).toBeUndefined()
})

test("withDamageToMember はダメージを与えた新しいグループを返す", () => {
  const group = new WizBattleMonsterGroup({
    id: "group-1",
    name: "Goblins",
    members: [wizMockGoblin(1), wizMockGoblin(2)],
  })
  const originalHp =
    group.getMemberById("goblin-1")?.status.resources.current("health") ?? 0

  const damaged = group.withDamageToMember("goblin-1", 5)

  expect(
    damaged.getMemberById("goblin-1")?.status.resources.current("health")
  ).toBe(originalHp - 5)
  expect(
    group.getMemberById("goblin-1")?.status.resources.current("health")
  ).toBe(originalHp)
})

test("withDamageToAll は全メンバーにダメージを与える", () => {
  const group = new WizBattleMonsterGroup({
    id: "group-1",
    name: "Goblins",
    members: [wizMockGoblin(1), wizMockGoblin(2)],
  })
  const originalHp1 =
    group.getMemberById("goblin-1")?.status.resources.current("health") ?? 0
  const originalHp2 =
    group.getMemberById("goblin-2")?.status.resources.current("health") ?? 0

  const damaged = group.withDamageToAll(3)

  expect(
    damaged.getMemberById("goblin-1")?.status.resources.current("health")
  ).toBe(originalHp1 - 3)
  expect(
    damaged.getMemberById("goblin-2")?.status.resources.current("health")
  ).toBe(originalHp2 - 3)
})

test("withHealToMember は回復した新しいグループを返す", () => {
  const group = new WizBattleMonsterGroup({
    id: "group-1",
    name: "Goblins",
    members: [wizMockGoblin(1)],
  })
  const damaged = group.withDamageToMember("goblin-1", 10)

  const healed = damaged.withHealToMember("goblin-1", 5)

  expect(
    healed.getMemberById("goblin-1")?.status.resources.current("health")
  ).toBe(
    (damaged.getMemberById("goblin-1")?.status.resources.current("health") ??
      0) + 5
  )
})

test("withEffectToMember はステータス効果を付与する", () => {
  const group = new WizBattleMonsterGroup({
    id: "group-1",
    name: "Goblins",
    members: [wizMockGoblin(1)],
  })
  const effect = createBattleEffect({
    instanceId: "poison-1",
    effectId: "poison",
    source: { kind: "system", id: "monster-group-test" },
    name: "毒",
    lifetime: { type: "turns", remaining: 3 },
    custom: { value: 5 },
  })

  const affected = group.withEffectToMember("goblin-1", effect)

  expect(affected.getMemberById("goblin-1")?.effects.effects).toHaveLength(1)
})

test("isDefeated は全員倒れている場合 true を返す", () => {
  const group = new WizBattleMonsterGroup({
    id: "group-1",
    name: "Goblins",
    members: [wizMockGoblin(1)],
  })
  const hp =
    group.getMemberById("goblin-1")?.status.resources.current("health") ?? 0

  const defeated = group.withDamageToMember("goblin-1", hp)

  expect(defeated.isDefeated()).toBe(true)
})

test("isDefeated は生存者がいる場合 false を返す", () => {
  const group = new WizBattleMonsterGroup({
    id: "group-1",
    name: "Goblins",
    members: [wizMockGoblin(1), wizMockGoblin(2)],
  })

  expect(group.isDefeated()).toBe(false)
})

test("constructorはmembersをdefensive copyしてfreezeする", () => {
  const first = wizMockGoblin(1)
  const members = [first]
  const group = new WizBattleMonsterGroup({
    id: "group-1",
    name: "Goblins",
    members,
  })

  members.push(wizMockGoblin(2))

  expect(group.members).toEqual([first])
  expect(group.members).not.toBe(members)
  expect(Object.isFrozen(group.members)).toBe(true)
})
