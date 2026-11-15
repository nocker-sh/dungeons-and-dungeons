import { expect, it } from "vite-plus/test"
import { GameCommandError } from "@/lib/wiz/game/game-command-error"
import { aState } from "@/lib/wiz/testing/state-builder"
import { createTestGame } from "@/lib/wiz/testing/create-test-game"
import { questBySlug } from "@/lib/wiz/testing/quest-by-slug"

// ギルドで登録する前の街。戦闘の札に仮の名前を出さず、契約できない募集にも払わせない。
const unregistered = () => {
  const state = aState().withGold(500).build()
  return createTestGame({
    state: { ...state, hero: { ...state.hero, registrationPending: true } },
  })
}

it("[feature:W045] 登録前は街の依頼戦闘を始めず、Queryも戦えないと示す", () => {
  const game = unregistered()
  const quest = questBySlug("q-town-crates")
  const before = game.save()
  const view = game.queries
    .quests(game.state)
    .find((entry) => entry.id === quest.id)!
  expect(view).toBeDefined()
  expect(JSON.stringify(view)).toContain("ギルドで登録しよう")
  const result = game.send({ type: "fight-quest", quest: quest.id })
  expect((result as GameCommandError).code).toBe("UNREGISTERED")
  expect(game.save()).toEqual(before)
})

it("[feature:W037] 登録前は募集を引き直さず、金貨も減らさない", () => {
  const game = unregistered()
  expect(game.queries.reroll(game.state).enabled).toBe(false)
  const before = game.save()
  const result = game.send({ type: "reroll" })
  expect((result as GameCommandError).code).toBe("UNREGISTERED")
  expect(game.save()).toEqual(before)
})
