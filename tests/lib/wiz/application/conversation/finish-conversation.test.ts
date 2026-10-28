import { describe, expect, it } from "vite-plus/test"
import { GameCommandError } from "@/lib/wiz/game/game-command-error"
import { aState } from "@/lib/wiz/testing/state-builder"
import { createTestGame } from "@/lib/wiz/testing/create-test-game"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"

describe("一度きりの会話の返答", () => {
  it.each([0, 1])("未選択なら保存を保ち、再開後に答え%dを選べる", (choice) => {
    const game = createTestGame({ state: aState().build() })
    const saved = game.save()
    expect(
      game.restore({
        ...saved,
        snapshot: {
          ...saved.snapshot,
          conversation: { seen: [], last: null, active: "milena-talk-02" },
        },
      })
    ).toBeUndefined()
    const script = game.queries.activeConversation(game.state)!
    expect(script.once).toBe(true)
    expect(script.choice!.options).toHaveLength(2)
    const before = game.save()
    const state = game.state
    const rejected = game.send({ type: "finish-conversation" })
    expect(rejected).toBeInstanceOf(GameCommandError)
    expect((rejected as GameCommandError).code).toBe("INVALID_ACTION")
    expect(game.state).toBe(state)
    expect(game.save()).toEqual(before)

    expect(
      game.restore(JSON.parse(JSON.stringify(game.save())))
    ).toBeUndefined()
    expect(game.queries.activeConversation(game.state)?.id).toBe(script.id)
    eventsOrThrow(game.send({ type: "finish-conversation", choice }))
    expect(game.state.conversation).toMatchObject({
      active: null,
      last: script.id,
      seen: [script.id],
      flags: script.choice!.options[choice].sets,
    })
    expect(game.save().snapshot).toEqual({
      ...before.snapshot,
      conversation: game.state.conversation,
    })
    const completed = game.save()
    expect(game.restore(completed)).toBeUndefined()
    expect(game.save()).toEqual(completed)
  })
})
