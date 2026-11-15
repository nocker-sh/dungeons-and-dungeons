import { expect, it } from "vite-plus/test"
import { stateProblems } from "@/lib/wiz/integrity/state-problems"
import { aState } from "@/lib/wiz/testing/state-builder"
import { createTestGame } from "@/lib/wiz/testing/create-test-game"
import { realContent } from "@/lib/wiz/testing/real-content"
import { catalogOf } from "@/lib/wiz/testing/catalog-of"

const catalog = catalogOf(realContent())
const battle = (hp: Record<string, number>) => {
  let builder = aState().withParty(["alda", "mayu", "mort"])
  for (const [slug, value] of Object.entries(hp))
    builder = builder.withMember(slug, { hp: value })
  return builder
    .inBattle({ foes: ["kamokutsu"], order: ["alda", "foe-1", "mayu", "mort"] })
    .build()
}

it("動ける者の手番で止まった戦闘は読み込める", () => {
  expect(stateProblems(battle({}), catalog)).toEqual([])
  const game = createTestGame()
  const save = game.save()
  expect(
    game.restore({ ...save, snapshot: battle({}) } as typeof save)
  ).toBeUndefined()
  expect(game.state.phase.type).toBe("battle")
})

it("倒れた仲間の手番で止まった保存は、誰も進められないので読み込まない", () => {
  const state = battle({ alda: 0 })
  expect(stateProblems(state, catalog)).toContain(
    "倒れた者の手番で止まっている"
  )
  const game = createTestGame()
  const before = game.save()
  expect(
    game.restore({ ...before, snapshot: state } as typeof before)
  ).toBeDefined()
  expect(game.save()).toEqual(before)
})

it("仲間が全員倒れた戦闘の保存は読み込まない", () => {
  expect(
    stateProblems(battle({ alda: 0, mayu: 0, mort: 0 }), catalog)
  ).toContain("戦える仲間がいない戦闘")
})
