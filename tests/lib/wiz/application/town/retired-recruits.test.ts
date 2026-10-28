import { expect, it } from "vite-plus/test"
import { GameCommandError } from "@/lib/wiz/game/game-command-error"
import { aContent } from "@/lib/wiz/testing/content-builder"
import { aState } from "@/lib/wiz/testing/state-builder"
import { createTestGame } from "@/lib/wiz/testing/create-test-game"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"

it("廃止した募集は旧掲示板からも雇えず、保存は読み込める", () => {
  // 今の作品データに募集を外した仲間はいないので、試しに一人を外したデータで確かめる
  const content = aContent().withRecruit("n-gald", { retired: true }).build()
  const retired = content.recruits.filter((entry) => entry.retired)
  expect(retired).toHaveLength(1)
  const game = createTestGame({
    content,
    state: aState(content)
      .withGold(10000)
      .withBoard(retired.map((entry) => entry.id))
      .build(),
  })
  expect(game.queries.recruits(game.state)).toEqual([])
  const before = game.state
  for (const entry of retired)
    expect(game.send({ type: "recruit", recruit: entry.id })).toBeInstanceOf(
      GameCommandError
    )
  expect(game.state).toBe(before)
  expect(game.restore(game.save())).toBeUndefined()
  for (let index = 0; index < 20; index++) {
    eventsOrThrow(game.send({ type: "reroll" }))
    for (const entry of retired)
      expect(game.state.board).not.toContain(entry.id)
  }
})
