import { describe, expect, it } from "vite-plus/test"
import { aState } from "@/lib/wiz/testing/state-builder"
import { createTestGame } from "@/lib/wiz/testing/create-test-game"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"
import { sequenceRandom } from "@/lib/wiz/testing/sequence-random"
import { sequentialIds } from "@/lib/wiz/testing/sequential-ids"
import { contentId, realContent } from "@/lib/wiz/testing"

describe("テスト用のプレイ（createTestGame）", () => {
  it("既定は乱数0.5・ID連番で、はじめからの状態", () => {
    const game = createTestGame()
    expect(game.state.gold).toBe(realContent().startingGold)
    eventsOrThrow(
      game.send({
        type: "buy",
        shop: contentId("armory"),
        good: contentId("dagger"),
      })
    )
    expect(game.state.gear.at(-1)?.id).toBe("id-1")
  })

  it("乱数は数値でも台本でも渡せる", () => {
    const scripted = createTestGame({ random: sequenceRandom([0.9, 0.9, 0.9]) })
    const fixed = createTestGame({ random: 0.9 })
    for (const game of [scripted, fixed])
      eventsOrThrow(
        game.send({
          type: "buy",
          shop: contentId("armory"),
          good: contentId("dagger"),
        })
      )
    expect(scripted.state.gear.at(-1)?.weapon).toEqual(
      fixed.state.gear.at(-1)?.weapon
    )
  })

  it("IDの付け方を差し替えられる", () => {
    const game = createTestGame({ ids: sequentialIds("gear") })
    eventsOrThrow(
      game.send({
        type: "buy",
        shop: contentId("armory"),
        good: contentId("dagger"),
      })
    )
    expect(game.state.gear.at(-1)?.id).toBe("gear-1")
  })

  it("組み立てた状態から始められる", () => {
    const game = createTestGame({
      state: aState().withGold(7).inExpedition({ at: "s" }).build(),
    })
    expect(game.state.gold).toBe(7)
    expect(game.state.phase.type).toBe("expedition")
  })
})
