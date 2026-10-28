import { describe, expect, it } from "vite-plus/test"
import { createGame } from "@/lib/wiz/definition/create-game"
import { GameDefinition } from "@/lib/wiz/definition/game-definition"
import { WizWorldEnvironment } from "@/lib/wiz/core/world/world"
import { aState } from "@/lib/wiz/testing/state-builder"
import { contentId } from "@/lib/wiz/testing/content-id"
import { realContent } from "@/lib/wiz/testing/real-content"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"
import { sequenceRandom } from "@/lib/wiz/testing/sequence-random"
import { sequentialIds } from "@/lib/wiz/testing/sequential-ids"

describe("合成ルート（createGame）", () => {
  it("乱数・時計・ID を一か所で差し替える", () => {
    const game = createGame({
      content: realContent(),
      initialState: aState().build(),
      random: sequenceRandom([0.9]),
      clock: () => 1000,
      ids: sequentialIds("gear"),
    })
    eventsOrThrow(
      game.send({
        type: "buy",
        shop: contentId("armory"),
        good: contentId("dagger"),
      })
    )
    expect(game.state.gear.at(-1)?.id).toBe("gear-1")
  })

  it("検証済みのカタログをそのまま渡せる", () => {
    const definition = new GameDefinition(realContent())
    const game = createGame({ content: definition.catalog, random: () => 0.5 })
    expect(game.state.gold).toBe(realContent().startingGold)
    expect(game.save().contentVersion).toBe(definition.identity)
  })

  it("始める状態を渡せる", () => {
    const game = createGame({
      content: realContent(),
      initialState: aState().withGold(11).build(),
    })
    expect(game.state.gold).toBe(11)
  })

  it("組み立て済みの環境は乱数・時計・ID より優先する", () => {
    const game = createGame({
      content: realContent(),
      initialState: aState().build(),
      random: () => 0.9,
      environment: WizWorldEnvironment.create({
        random: () => 0.1,
        now: () => 0,
        nextId: () => "x",
      }),
    })
    eventsOrThrow(
      game.send({
        type: "buy",
        shop: contentId("armory"),
        good: contentId("dagger"),
      })
    )
    expect(game.state.gear.at(-1)?.id).toBe("x")
  })

  it("規則を差し替えるときは版を必ず付ける", () => {
    expect(() => createGame({ content: realContent(), rules: {} })).toThrow(
      "Injected rules need an explicit rulesRevision"
    )
    const game = createGame({
      content: realContent(),
      rules: {},
      rulesRevision: "rules-other",
    })
    const plain = createGame({ content: realContent() })
    expect(game.save().contentVersion).not.toBe(plain.save().contentVersion)
  })
})
