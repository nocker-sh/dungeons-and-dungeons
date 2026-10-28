import { describe, expect, it } from "vite-plus/test"
import { GameCommandError } from "@/lib/wiz/game/game-command-error"
import { inPhase } from "@/lib/wiz/phases/in-phase"
import { aState } from "@/lib/wiz/testing/state-builder"
import { contentId } from "@/lib/wiz/testing/content-id"
import { memberBySlug } from "@/lib/wiz/testing/member-by-slug"
import { createTestGame } from "@/lib/wiz/testing/create-test-game"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"

function pendingGame() {
  return createTestGame({
    state: aState()
      .withMember("alda", { hp: 1 })
      .withItem("potion", 3)
      .inExpedition({
        at: "n2",
        visited: ["s", "n1", "n2"],
        pending: { kind: "treasure", gold: 10, goods: [] },
        loot: { gold: 10, goods: [] },
      })
      .build(),
  })
}

describe("探索結果を残したまま道具を使う", () => {
  it.each([false, true])(
    "[feature:W021] 対象指定=%sでも予告どおり回復し、結果と戦利品を保つ",
    (explicit) => {
      const game = pendingGame()
      const before = game.save()
      const target = memberBySlug("alda").id
      const item = game.queries
        .items(game.state)
        .find((entry) => entry.id === contentId("potion"))!
      expect(item.targets).toContain(target)
      const forecast = item.healing!.find((entry) => entry.id === target)!
      const pending = inPhase(game, "pending")!
      const result = pending.use(item.id, explicit ? target : undefined)
      if (result instanceof GameCommandError) throw result
      expect(result.next.kind).toBe("pending")
      expect(result.events).toMatchObject([
        {
          type: "used",
          results: [{ target: { id: target }, heal: forecast.restored }],
        },
      ])
      expect(game.queries.member(game.state, target)?.hp).toBe(forecast.after)
      expect(
        game.queries.items(game.state).find((entry) => entry.id === item.id)
          ?.count
      ).toBe(item.count - 1)
      expect(game.state.phase).toEqual(before.snapshot.phase)
      expect(game.state.gold).toBe(before.snapshot.gold)
      expect(game.state.gear).toEqual(before.snapshot.gear)
      const after = game.save()
      expect((pending.use(item.id, target) as GameCommandError).code).toBe(
        "STALE"
      )
      expect(game.save()).toEqual(after)
      expect(result.next.acknowledge()).not.toBeInstanceOf(GameCommandError)
      expect(inPhase(game, "expedition")).not.toBeNull()
      expect(game.queries.member(game.state, target)?.hp).toBe(forecast.after)
      expect(game.state.gold).toBe(after.snapshot.gold)
    }
  )

  it("[feature:W021] 効かない仲間への使用と、結果を閉じた後の古い操作では資産を変えない", () => {
    const game = pendingGame()
    const pending = inPhase(game, "pending")!
    const healthy = game.state.party.find(
      (id) =>
        !game.queries
          .items(game.state)
          .find((entry) => entry.id === contentId("potion"))!
          .targets.includes(id)
    )!
    expect(healthy).toBeDefined()
    const before = game.state
    expect(
      (pending.use(contentId("potion"), healthy) as GameCommandError).code
    ).toBe("NO_EFFECT")
    expect(game.state).toBe(before)
    eventsOrThrow(game.send({ type: "acknowledge" }))
    const after = game.state
    expect((pending.use(contentId("potion")) as GameCommandError).code).toBe(
      "STALE"
    )
    expect(game.state).toBe(after)
  })
})
