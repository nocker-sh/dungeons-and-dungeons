import { inPhase } from "@/lib/wiz"
import { expect, it } from "vite-plus/test"
import { createTestGame, goodBySlug } from "@/lib/wiz/testing"

it("到達した層の鑑定限定武器を目標に含め、店売りと未到達の武器を伏せる", () => {
  const game = createTestGame()
  const destinations = game.queries.destinations(game.state)
  expect(destinations[0].weaponFinds.map((good) => good.id)).toContain(
    goodBySlug("crystal-pickaxe").id
  )
  expect(destinations[0].weaponFinds.map((good) => good.id)).not.toContain(
    goodBySlug("greatsword").id
  )
  for (const destination of destinations.filter((entry) => !entry.open))
    expect(destination.weaponFinds).toEqual([])
})

it("目標の手持ち個体は装備一覧と同じ強化・上振れ・持ち主を表示する", () => {
  const game = createTestGame()
  const good = goodBySlug("crystal-pickaxe")
  const goal = game.queries
    .destinations(game.state)[0]
    .weaponFinds.find((entry) => entry.id === good.id)!
  const state = {
    ...game.state,
    gear: [
      ...game.state.gear,
      {
        id: "goal-owned-query",
        good: good.id,
        owner: game.state.party[0],
        plus: 2,
        wear: 0,
        progress: 0,
        weapon: {
          rarity: "R" as const,
          extraPower: 3,
          skills: goal.weapon!.skills.map((skill) => skill.id),
        },
      },
    ],
  }
  const owned = game.queries
    .destinations(state)[0]
    .weaponFinds.find((entry) => entry.id === good.id)!.ownedGear[0]
  const actual = game.queries
    .gear(state)
    .find((entry) => entry.gear === "goal-owned-query")!
  expect(owned).toMatchObject({
    name: actual.name,
    stat: actual.stat,
    owner: actual.owner,
    weapon: actual.weapon,
  })
  expect(owned.weapon!.power).toBe(goal.weapon!.power + 5)
  expect(owned.owner).toBeTruthy()
})

it("防具目標の目安は実際の装備結果と一致し、表示では保存を変えない", () => {
  const game = createTestGame()
  const goal = game.queries.destinations(game.state)[0].armorFinds[0]!
  const member = goal.equipMembers[0]!
  const save = game.save()
  const comparison = game.queries.armorGoalComparison(
    game.state,
    member.id,
    goal.id
  )!
  expect(comparison).not.toBeNull()
  expect(game.save()).toEqual(save)
  expect(
    game.queries.armorGoalComparison(
      game.state,
      member.id,
      goodBySlug("crystal-pickaxe").id
    )
  ).toBeNull()
  expect(
    game.queries.armorGoalComparison(game.state, "missing", goal.id)
  ).toBeNull()
  const actual = createTestGame({
    state: {
      ...game.state,
      gear: [
        ...game.state.gear,
        {
          id: "actual-goal-armor",
          good: goal.id,
          owner: null,
          plus: 0,
          wear: 0,
          progress: 0,
          weapon: null,
        },
      ],
    },
  })
  inPhase(actual, "town")!.equip("actual-goal-armor", member.id)
  const equipped = actual.queries.member(actual.state, member.id)!
  expect(equipped.weapon?.attack ?? 1).toBe(comparison.after.attack)
  expect(equipped.armor?.durability).toBe(comparison.after.durability)
  expect(equipped.armor?.maxDurability).toBe(comparison.after.maxDurability)
  for (const key of ["hp", "maxHp", "str", "tec", "spd"] as const)
    expect(equipped[key]).toBe(comparison.after[key])
})
