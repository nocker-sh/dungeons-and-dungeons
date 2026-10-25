import { describe, expect, it } from "vite-plus/test"
import { GameDefinition } from "@/lib/wiz"
import {
  aContent,
  contentId,
  goodBySlug,
  realContent,
  startedState,
} from "@/lib/wiz/testing"
import {
  MemoryStorage,
  connectSave,
  discardSave,
} from "@/lib/game-client/storage"

describe("保存先", () => {
  it("操作のたびに書き、次に開くと戻る", () => {
    const storage = new MemoryStorage()
    const first = new GameDefinition(realContent()).create()
    const session = connectSave(first, storage)
    expect(session.status).toBe("fresh")
    first.send({
      type: "buy",
      shop: contentId("tools"),
      good: contentId("rope"),
    })
    session.disconnect()
    const second = new GameDefinition(realContent()).create()
    expect(connectSave(second, storage).status).toBe("restored")
    expect(second.state.gold).toBe(first.state.gold)
  })

  it("読めない保存は理由を返して上書きせず、選んだときだけ消して始める", () => {
    const storage = new MemoryStorage()
    storage.value = JSON.stringify({
      schemaVersion: 1,
      contentVersion: "old",
      snapshot: {},
    })
    const definition = new GameDefinition(realContent())
    const game = definition.create(undefined, startedState(definition))
    const session = connectSave(game, storage)
    expect(session.status).toBe("unreadable")
    expect(session.problems.length).toBeGreaterThan(0)
    game.send({
      type: "buy",
      shop: contentId("tools"),
      good: contentId("rope"),
    })
    expect(JSON.parse(storage.value!).contentVersion).toBe("old")
    const fresh = discardSave(game, storage)
    expect(fresh.status).toBe("fresh")
    expect(JSON.parse(storage.value!).contentVersion).toBe(
      game.save().contentVersion
    )
  })

  it("保存が指す品物がコンテンツから消えたら、その理由を返す", () => {
    const storage = new MemoryStorage()
    const definition = new GameDefinition(realContent())
    const game = definition.create(undefined, startedState(definition))
    connectSave(game, storage)
    const rope = goodBySlug("rope")
    game.send({ type: "buy", shop: contentId("tools"), good: rope.id })
    const edited = new GameDefinition(
      aContent().withoutGood("rope").build()
    ).create()
    const session = connectSave(edited, storage)
    expect(session.status).toBe("unreadable")
    expect(session.problems).toContain(`持ち物 ${rope.id} がコンテンツにない`)
  })
})
