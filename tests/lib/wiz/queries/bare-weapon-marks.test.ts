import { expect, test } from "vite-plus/test"
import { GameDefinition } from "@/lib/wiz/definition/game-definition"
import { realContent } from "@/lib/wiz/testing/real-content"
import { aState } from "@/lib/wiz/testing/state-builder"
import { testEnvironment } from "@/lib/wiz/testing/test-environment"

const content = realContent()
const definition = new GameDefinition(content)
const roster = aState(definition.catalog).build()

test("素の武器（装備の個体なし）は付け替えの印を付けない", () => {
  const isWeapon = (good: string) =>
    definition.catalog.good(good)?.kind === "weapon"
  const state = {
    ...roster,
    gear: roster.gear.filter((entry) => !isWeapon(entry.good)),
  }
  const game = definition.create(testEnvironment(), state)
  let checked = 0
  for (const member of game.state.members) {
    const weapon = game.queries.weapon(game.state, member)
    if (!weapon) continue
    expect(weapon.gear).toBeNull()
    expect(weapon.skills.some((skill) => skill.random)).toBe(false)
    checked++
  }
  expect(checked).toBeGreaterThan(0)
})

test("装備の個体を持つ武器のランダム枠には印を付ける", () => {
  const game = definition.create(testEnvironment(), roster)
  const marked = game.state.members.some((member) =>
    game.queries
      .weapon(game.state, member)
      ?.skills.some((skill) => skill.random)
  )
  const owned = roster.gear.some(
    (entry) => entry.owner && entry.weapon && entry.weapon.skills.length > 1
  )
  expect(marked).toBe(owned)
})
