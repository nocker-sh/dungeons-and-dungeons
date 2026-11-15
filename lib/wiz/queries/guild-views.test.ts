import { describe, expect, it } from "vite-plus/test"
import { createTestGame } from "@/lib/wiz/testing/create-test-game"

describe("GuildViews.quests", () => {
  it("今できる依頼を鍵付きの街の戦闘より先に並べ、鍵付きには理由を付ける", () => {
    const game = createTestGame()
    const state = { ...game.state, reached: 1 }
    const quests = game.queries.quests(state)
    const rank = (quest: (typeof quests)[number]) =>
      quest.status === "ready" ? 0 : quest.canAccept || quest.canFight ? 1 : 2
    const ranks = quests.map(rank)
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b))
    const fights = quests.filter((quest) => quest.encounter)
    expect(fights.some((quest) => quest.canFight)).toBe(true)
    const locked = fights.filter(
      (quest) => !quest.canFight && quest.status !== "done"
    )
    expect(locked.length).toBeGreaterThan(0)
    for (const quest of locked) expect(quest.battleBlock).toBeTruthy()
    const lastOpen = Math.max(
      ...fights.filter((quest) => quest.canFight).map((q) => quests.indexOf(q))
    )
    for (const quest of locked)
      expect(quests.indexOf(quest)).toBeGreaterThan(lastOpen)
  })
})
