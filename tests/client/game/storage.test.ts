import { describe, expect, it, vi } from "vite-plus/test"
import { GameDefinition } from "@/lib/wiz/definition/game-definition"
import { aContent } from "@/lib/wiz/testing/content-builder"
import { aState } from "@/lib/wiz/testing/state-builder"
import { contentId } from "@/lib/wiz/testing/content-id"
import { goodBySlug } from "@/lib/wiz/testing/good-by-slug"
import { realContent } from "@/lib/wiz/testing/real-content"
import { startedState } from "@/lib/wiz/testing/started-state"
import { connectSave } from "@/client/game/connect-save"
import { discardSave } from "@/client/game/discard-save"
import { MemoryStorage } from "@/client/game/memory-storage"

describe("保存先", () => {
  it("敵の個体が重複した保存は読み込まず、保存しないで遊んでも元の内容を残す", () => {
    const storage = new MemoryStorage()
    const definition = new GameDefinition(realContent())
    const game = definition.create(undefined, startedState(definition))
    const state = aState()
      .inBattle({ foes: ["kamokutsu"] })
      .build()
    if (state.phase.type !== "battle") throw new Error("戦闘ではない")
    const battle = state.phase.battle
    storage.value = JSON.stringify({
      ...game.save(),
      snapshot: {
        ...state,
        phase: {
          ...state.phase,
          battle: { ...battle, foes: [...battle.foes, battle.foes[0]] },
        },
      },
    })
    const original = storage.value
    const before = game.state
    const session = connectSave(game, storage)
    expect(session.status).toBe("unreadable")
    expect(session.problems).toContain("敵の個体が重複している")
    expect(game.state).toBe(before)
    expect(storage.value).toBe(original)
    expect(
      game.send({
        type: "buy",
        shop: contentId("tools"),
        good: contentId("rope"),
      })
    ).not.toBeInstanceOf(Error)
    expect(game.state.gold).toBeLessThan(before.gold)
    expect(storage.value).toBe(original)
    session.disconnect()
  })

  it("操作のたびに書き、次に開くと戻る", () => {
    const storage = new MemoryStorage()
    const definition = new GameDefinition(realContent())
    const first = definition.create(undefined, startedState(definition))
    const session = connectSave(first, storage)
    expect(session.status).toBe("fresh")
    first.send({
      type: "buy",
      shop: contentId("tools"),
      good: contentId("rope"),
    })
    expect(first.state.gold).toBeLessThan(startedState(definition).gold)
    session.disconnect()
    const second = new GameDefinition(realContent()).create()
    expect(connectSave(second, storage).status).toBe("restored")
    expect(second.state.gold).toBe(first.state.gold)
  })

  it("読めない保存は理由を返して上書きせず、選んだときだけ消して始める", async () => {
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
    expect(session.retrySave).toBeUndefined()
    expect(session.problems.length).toBeGreaterThan(0)
    game.send({
      type: "buy",
      shop: contentId("tools"),
      good: contentId("rope"),
    })
    expect(JSON.parse(storage.value!).contentVersion).toBe("old")
    const fresh = await discardSave(game, storage)
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

  it.each(["sync", "async"])(
    "%s の保存失敗を知らせ、操作を失わず最新の状態を手動で保存できる",
    async (mode) => {
      const storage = new MemoryStorage()
      const write = storage.write.bind(storage)
      let fail = true
      storage.write = (value) => {
        if (!fail) return write(value)
        const error = new Error("保存先がいっぱい")
        if (mode === "async") return Promise.reject(error)
        throw error
      }
      const definition = new GameDefinition(realContent())
      const game = definition.create(undefined, startedState(definition))
      const report = vi.fn()
      const session = connectSave(game, storage, report)
      for (let index = 0; index < 2; index++) {
        game.send({
          type: "buy",
          shop: contentId("tools"),
          good: contentId("rope"),
        })
        await vi.waitFor(() => expect(report).toHaveBeenLastCalledWith(false))
      }
      expect(storage.read()).toBeNull()
      const before = game.save()
      fail = false
      await session.retrySave!()
      expect(report).toHaveBeenLastCalledWith(true)
      expect(JSON.parse(storage.read()!)).toEqual(before)
      expect(game.save()).toEqual(before)
      session.disconnect()
    }
  )

  it("古い非同期保存の完了で最新の失敗を消さず、切断後に再保存しない", async () => {
    const definition = new GameDefinition(realContent())
    const game = definition.create(undefined, startedState(definition))
    let finish!: () => void
    const write = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            finish = resolve
          })
      )
      .mockRejectedValueOnce(new Error("通信失敗"))
    const report = vi.fn()
    const session = connectSave(
      game,
      { read: () => null, write, clear: () => {} },
      report
    )
    for (let index = 0; index < 2; index++)
      game.send({
        type: "buy",
        shop: contentId("tools"),
        good: contentId("rope"),
      })
    await vi.waitFor(() => expect(report).toHaveBeenLastCalledWith(false))
    finish()
    await Promise.resolve()
    expect(report.mock.calls).toEqual([[false]])
    session.disconnect()
    await session.retrySave!()
    game.send({
      type: "buy",
      shop: contentId("tools"),
      good: contentId("rope"),
    })
    expect(write).toHaveBeenCalledTimes(2)
    expect(report.mock.calls).toEqual([[false]])
  })

  it("保存中に切断したら、遅れて失敗しても画面へ通知しない", async () => {
    const definition = new GameDefinition(realContent())
    const game = definition.create(undefined, startedState(definition))
    let fail!: (reason: Error) => void
    const write = () =>
      new Promise<void>((_, reject) => {
        fail = reject
      })
    const report = vi.fn()
    const session = connectSave(
      game,
      { read: () => null, write, clear: () => {} },
      report
    )
    const saving = session.retrySave!()
    session.disconnect()
    fail(new Error("通信失敗"))
    await saving
    expect(report).not.toHaveBeenCalled()
  })
})
