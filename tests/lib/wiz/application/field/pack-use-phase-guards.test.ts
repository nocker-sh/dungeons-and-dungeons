import { describe, expect, it } from "vite-plus/test"
import { aState } from "@/lib/wiz/testing/state-builder"
import { createTestGame } from "@/lib/wiz/testing/create-test-game"
import { contentId } from "@/lib/wiz/testing/content-id"
import { realContent } from "@/lib/wiz/testing/real-content"
import { catalogOf } from "@/lib/wiz/testing/catalog-of"
import { GameCommandError } from "@/lib/wiz/game/game-command-error"
import type { GameState } from "@/lib/wiz/state/state-schema"
import { createGameRules } from "@/lib/wiz/definition/game-rules"
import { Pack } from "@/lib/wiz/application/town/pack"
import { Use } from "@/lib/wiz/application/field/use"

const catalog = catalogOf(realContent())
const deps = createGameRules(catalog)
const conversation = catalog.data.conversations![0].id
const blocked: [string, (state: GameState) => GameState][] = [
  [
    "会話中",
    (state) => ({
      ...state,
      conversation: { active: conversation, last: null, seen: [] },
    }),
  ],
  [
    "未確認の全滅結果",
    (state) => ({
      ...state,
      wipe: { layer: state.lastLayer ?? "layer", gold: 0, goods: [] },
    }),
  ],
]

describe("pack・use の段階ガード", () => {
  it.each(blocked)("%sは pack と use を状態を変えずに拒否する", (_, patch) => {
    const base = aState()
      .withItem("potion", 3)
      .withMembers((member) => ({ hp: Math.max(1, member.hp - 5) }))
      .build()
    const state = patch(base)
    const snapshot = structuredClone(state)
    expect(
      new Pack(deps).execute(state, {
        type: "pack",
        good: contentId("potion"),
        count: 1,
      })
    ).toMatchObject({ accepted: false, reason: "WRONG_PHASE" })
    expect(
      new Use(deps).execute(state, { type: "use", good: contentId("potion") })
    ).toMatchObject({ accepted: false, reason: "WRONG_PHASE" })
    expect(state).toEqual(snapshot)
    // ゲーム経由でも拒否され、状態は変わらない
    const game = createTestGame({ state })
    const before = game.state
    for (const action of [
      { type: "pack" as const, good: contentId("potion"), count: 1 },
      { type: "use" as const, good: contentId("potion") },
    ]) {
      expect(game.send(action)).toBeInstanceOf(GameCommandError)
      expect(game.state).toBe(before)
    }
  })

  it("通常の街では pack と use を受け付ける", () => {
    const game = createTestGame({
      state: aState()
        .withItem("potion", 3)
        .withMembers((member) => ({ hp: Math.max(1, member.hp - 5) }))
        .build(),
    })
    expect(
      game.send({ type: "pack", good: contentId("potion"), count: 1 })
    ).not.toBeInstanceOf(GameCommandError)
    expect(
      game.send({ type: "use", good: contentId("potion") })
    ).not.toBeInstanceOf(GameCommandError)
  })
})
