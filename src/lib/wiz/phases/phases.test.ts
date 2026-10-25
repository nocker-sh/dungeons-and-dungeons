import { describe, expect, it } from "vite-plus/test"
import {
  contentId,
  createTestPlay,
  eventsOrThrow,
  turnActionFor,
} from "@/lib/wiz/testing"
import { GameCommandError, phaseOf, type TownPhase } from "@/lib/wiz"

describe("フェーズ（型で縛った有限オートマトン）", () => {
  it("フェーズごとに押せる操作だけがあり、次のフェーズを返す", () => {
    const { game } = createTestPlay()
    const town = phaseOf(game)
    if (town.kind !== "town") throw new Error("街から始まる")
    // @ts-expect-error 街では進めない
    void town.advance
    const departed = town.depart(contentId("layer0"))
    if (departed instanceof GameCommandError) throw departed
    expect(departed.next.kind).toBe("expedition")
    // @ts-expect-error 探索中は店で買えない
    void departed.next.buy
    const arrived = departed.next.advance("n1")
    if (arrived instanceof GameCommandError) throw arrived
    expect(["member-turn", "foe-turn"]).toContain(arrived.next.kind)
  })

  it("状態が進んだ後の古いフェーズからは操作できない", () => {
    const { game } = createTestPlay()
    const town = phaseOf(game) as TownPhase
    eventsOrThrow(game.send({ type: "depart", layer: contentId("layer0") }))
    const result = town.rest(contentId("normal"))
    expect((result as GameCommandError).code).toBe("STALE")
  })

  it("戦闘は仲間の手番と敵の手番を行き来し、勝てば板、負ければ街", () => {
    const { game } = createTestPlay()
    eventsOrThrow(game.send({ type: "depart", layer: contentId("layer0") }))
    eventsOrThrow(game.send({ type: "advance", to: "n1" }))
    for (let guard = 0; guard < 200; guard++) {
      const phase = phaseOf(game)
      if (phase.kind === "member-turn") {
        const result = game.send(turnActionFor(game, phase.actor))
        if (result instanceof GameCommandError) throw result
      } else if (phase.kind === "foe-turn") {
        const result = phase.resolve()
        if (result instanceof GameCommandError) throw result
      } else break
    }
    expect(["pending", "town"]).toContain(phaseOf(game).kind)
  })
})
