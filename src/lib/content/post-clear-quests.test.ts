import { describe, expect, it } from "vite-plus/test"
import { gameContent } from "@/lib/content/game-content"
import {
  aContent,
  aState,
  createTestGame,
  eventsOrThrow,
  fightToEnd,
} from "@/lib/wiz/testing"
import { Bag } from "@/lib/wiz/rules/bag"

const challenges = gameContent.quests.filter((quest) => quest.requiresCleared)

describe("踏破後の全員生還の依頼", () => {
  it("初回踏破前には表示せず、直接の受注も資産を変えず拒否する", () => {
    const game = createTestGame()
    expect(challenges).toHaveLength(5)
    for (const quest of challenges) {
      const before = game.state
      expect(
        game.queries.quests(game.state).some((entry) => entry.id === quest.id)
      ).toBe(false)
      expect(
        game.send({ type: "accept-quest", quest: quest.id })
      ).toMatchObject({ code: "UNAVAILABLE" })
      expect(game.state).toBe(before)
    }
  })

  it.each(challenges)(
    "$name は全員生存の再戦だけを数え、保存と報酬の一度きり受取ができる",
    (quest) => {
      const layer = gameContent.layers.find(
        (entry) => entry.boss === quest.foe
      )!
      const content = aContent().withFoe(quest.foe, { hp: 1 }).build()
      const received = createTestGame({
        content,
        state: aState(content).withReached(4).withCleared(true, true).build(),
      })
      expect(
        received.queries
          .quests(received.state)
          .some((entry) => entry.id === quest.id)
      ).toBe(true)
      eventsOrThrow(received.send({ type: "accept-quest", quest: quest.id }))
      expect(received.restore(received.save())).toBeUndefined()
      for (const [survived, boss] of [
        [true, false],
        [false, true],
        [true, true],
      ]) {
        let state = aState(content)
          .withReached(4)
          .withCleared(true, true)
          .withMembers({ hp: 100 })
          .withQuest(quest.id, 0)
        if (!survived) state = state.withMember("mort", { hp: 0 })
        const game = createTestGame({
          content,
          state: state
            .inBattle({
              foes: [quest.foe],
              boss,
              order: ["alda", "hero", "mort", "foe-1"],
              expedition: { layer: layer.id, at: "n16", visited: ["s", "n16"] },
            })
            .build(),
        })
        fightToEnd(game)
        expect(
          game.state.quests.find((entry) => entry.id === quest.id)!.progress
        ).toBe(survived && boss ? 1 : 0)
        expect(game.restore(game.save())).toBeUndefined()
        if (!survived || !boss) continue
        eventsOrThrow(game.send({ type: "acknowledge" }))
        eventsOrThrow(game.send({ type: "retreat" }))
        const before = game.state
        eventsOrThrow(game.send({ type: "claim-quest", quest: quest.id }))
        expect(game.state.gold).toBe(before.gold + quest.reward.gold)
        for (const reward of quest.reward.goods)
          expect(Bag.count(game.state.bag, reward.good)).toBe(
            Bag.count(before.bag, reward.good) + reward.count
          )
        const paid = game.state
        expect(
          game.send({ type: "claim-quest", quest: quest.id })
        ).toMatchObject({ code: "ALREADY" })
        expect(game.state).toBe(paid)
      }
    }
  )
})
