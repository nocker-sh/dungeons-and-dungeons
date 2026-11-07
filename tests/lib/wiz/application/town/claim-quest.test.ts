import { expect, it } from "vite-plus/test"
import { GameCommandError } from "@/lib/wiz/game/game-command-error"
import { createTestPlay } from "@/lib/wiz/testing/create-test-play"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"
import { realContent } from "@/lib/wiz/testing/real-content"
import { testEnvironment } from "@/lib/wiz/testing/test-environment"

const quests = realContent().quests.filter((quest) => !quest.encounter)

it.each(quests)("本番の依頼 $name の報告境界と保存再開", (quest) => {
  const { game: initial, definition } = createTestPlay()
  // 討伐経路の検査とは分け、報告直前の条件を与えて実際の操作を検査する。
  const accepted = definition.create(testEnvironment(), {
    ...initial.state,
    cleared: quest.requiresCleared === true,
  })
  eventsOrThrow(accepted.send({ type: "accept-quest", quest: quest.id }))
  const acceptedSave = accepted.save()
  expect(
    accepted.send({ type: "accept-quest", quest: quest.id })
  ).toMatchObject({ code: "ALREADY" })
  expect(accepted.save()).toEqual(acceptedSave)

  for (const progress of [quest.count - 1, quest.count]) {
    const game = definition.create(testEnvironment(), {
      ...accepted.state,
      quests: [{ id: quest.id, progress, claimed: false }],
    })
    const resumed = definition.create(testEnvironment())
    expect(
      resumed.restore(JSON.parse(JSON.stringify(game.save())))
    ).toBeUndefined()
    expect(
      resumed.queries
        .quests(resumed.state)
        .find((entry) => entry.id === quest.id)?.status
    ).toBe(progress < quest.count ? "active" : "ready")
    const before = resumed.state
    const saved = resumed.save()
    const result = resumed.send({ type: "claim-quest", quest: quest.id })
    if (progress < quest.count) {
      expect(result).toBeInstanceOf(GameCommandError)
      expect(result).toMatchObject({ code: "NOT_READY" })
      expect(resumed.save()).toEqual(saved)
      continue
    }
    expect(eventsOrThrow(result)).toEqual([
      { type: "quest-claimed", quest: quest.id, gold: quest.reward.gold },
    ])
    expect(resumed.state).toEqual({
      ...before,
      gold: before.gold + quest.reward.gold,
      bag: resumed.state.bag,
      quests: [{ id: quest.id, progress, claimed: true }],
    })
    const goods = new Set([
      ...before.bag.map((entry) => entry.good),
      ...quest.reward.goods.map((entry) => entry.good),
      ...resumed.state.bag.map((entry) => entry.good),
    ])
    for (const good of goods) {
      const count = (bag: readonly { good: string; count: number }[]) =>
        bag.reduce(
          (sum, entry) => sum + (entry.good === good ? entry.count : 0),
          0
        )
      expect(count(resumed.state.bag)).toBe(
        count(before.bag) + count(quest.reward.goods)
      )
    }
    const paid = resumed.save()
    const reopened = definition.create(testEnvironment())
    expect(reopened.restore(JSON.parse(JSON.stringify(paid)))).toBeUndefined()
    expect(
      reopened.queries
        .quests(reopened.state)
        .find((entry) => entry.id === quest.id)?.status
    ).toBe("done")
    for (const type of ["claim-quest", "accept-quest"] as const) {
      expect(reopened.send({ type, quest: quest.id })).toMatchObject({
        code: "ALREADY",
      })
      expect(reopened.save()).toEqual(paid)
    }
  }
})
