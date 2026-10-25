import { describe, expect, it } from "vite-plus/test"
import { contentId, createTestPlay, eventsOrThrow } from "@/lib/wiz/testing"
import { GameCommandError } from "@/lib/wiz"

describe("通常攻撃はない", () => {
  it("「攻撃」の指示は受け付けない", () => {
    const { game } = createTestPlay()
    eventsOrThrow(game.send({ type: "depart", layer: contentId("layer0") }))
    eventsOrThrow(game.send({ type: "advance", to: "n1" }))
    const error = game.sendUnknown({ type: "act", command: "attack" })
    expect(error).toBeInstanceOf(GameCommandError)
    expect((error as GameCommandError).code).toBe("INVALID_ACTION")
  })
})
