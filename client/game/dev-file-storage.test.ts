import { afterEach, describe, expect, it, vi } from "vite-plus/test"
import { GameDefinition } from "@/lib/wiz/definition/game-definition"
import { realContent } from "@/lib/wiz/testing/real-content"
import { contentId } from "@/lib/wiz/testing/content-id"
import { startedState } from "@/lib/wiz/testing/started-state"
import { connectSave } from "@/client/game/connect-save"
import { discardSave } from "@/client/game/discard-save"
import { DevFileStorage } from "./dev-file-storage"

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

function gameInTown() {
  const definition = new GameDefinition(realContent())
  return definition.create(undefined, startedState(definition))
}

afterEach(() => vi.unstubAllGlobals())

describe("開発用保存の通信", () => {
  it.each([404, 500, 503])(
    "HTTP %i を保存なしと扱わず、自動上書きしない",
    async (status) => {
      const fetcher = vi.fn().mockResolvedValue(new Response(null, { status }))
      vi.stubGlobal("fetch", fetcher)
      const storage = await DevFileStorage.load()
      const game = gameInTown()
      const session = connectSave(game, storage)
      expect(session.status).toBe("unreadable")
      expect(session.problems[0]).toContain(String(status))
      game.send({
        type: "buy",
        shop: contentId("tools"),
        good: contentId("rope"),
      })
      await Promise.resolve()
      expect(fetcher).toHaveBeenCalledTimes(1)
    }
  )

  it("通信そのものの失敗も読み込みエラーとして表示できる", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("通信失敗")))
    const storage = await DevFileStorage.load()
    const session = connectSave(gameInTown(), storage)
    expect(session.status).toBe("unreadable")
    expect(session.problems).toEqual(["通信失敗"])
  })

  it("204 だけを保存なしとし、200 の保存は復元する", async () => {
    const source = gameInTown()
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(source.save())))
    vi.stubGlobal("fetch", fetcher)
    expect(connectSave(gameInTown(), await DevFileStorage.load()).status).toBe(
      "fresh"
    )
    const target = gameInTown()
    expect(connectSave(target, await DevFileStorage.load()).status).toBe(
      "restored"
    )
    expect(target.state).toEqual(source.state)
  })

  it("前の書き込みが終わるまで次の書き込みと削除を送らない", async () => {
    const first = deferred<Response>()
    const second = deferred<Response>()
    const deletion = deferred<Response>()
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)
      .mockReturnValueOnce(deletion.promise)
    vi.stubGlobal("fetch", fetcher)
    const storage = await DevFileStorage.load()
    const a = storage.write("old")
    const b = storage.write("new")
    const c = storage.clear()
    await Promise.resolve()
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(fetcher.mock.calls[1][1]).toEqual({ method: "PUT", body: "old" })
    first.resolve(new Response(null, { status: 204 }))
    await a
    await Promise.resolve()
    expect(fetcher).toHaveBeenCalledTimes(3)
    expect(fetcher.mock.calls[2][1]).toEqual({ method: "PUT", body: "new" })
    second.resolve(new Response(null, { status: 204 }))
    await b
    await Promise.resolve()
    expect(storage.read()).toBe("new")
    expect(fetcher.mock.calls[3][1]).toEqual({ method: "DELETE" })
    let cleared = false
    void c.then(() => {
      cleared = true
    })
    await Promise.resolve()
    expect(cleared).toBe(false)
    deletion.resolve(new Response(null, { status: 204 }))
    await c
    expect(storage.read()).toBeNull()
  })

  it("書き込み失敗を通知しても、次の保存は再試行できる", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response("original"))
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    vi.stubGlobal("fetch", fetcher)
    const storage = await DevFileStorage.load()
    await expect(storage.write("failed")).rejects.toThrow("500")
    expect(storage.read()).toBe("original")
    await storage.write("retry")
    expect(storage.read()).toBe("retry")
  })

  it("自動保存の通信失敗を処理し、次の操作で保存を再試行する", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockRejectedValueOnce(new TypeError("通信失敗"))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    vi.stubGlobal("fetch", fetcher)
    const storage = await DevFileStorage.load()
    const game = gameInTown()
    const session = connectSave(game, storage)
    for (let i = 0; i < 2; i++) {
      game.send({
        type: "buy",
        shop: contentId("tools"),
        good: contentId("rope"),
      })
    }
    await vi.waitFor(() => expect(storage.read()).not.toBeNull())
    expect(JSON.parse(storage.read()!)).toEqual(game.save())
    session.disconnect()
  })

  it("削除と初期保存の完了を待ってから自動保存をつなぐ", async () => {
    const deletion = deferred<Response>()
    const creation = deferred<Response>()
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockReturnValueOnce(deletion.promise)
      .mockReturnValueOnce(creation.promise)
    vi.stubGlobal("fetch", fetcher)
    const storage = await DevFileStorage.load()
    const game = gameInTown()
    let completed = false
    const reset = discardSave(game, storage).then((session) => {
      completed = true
      return session
    })
    await Promise.resolve()
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(completed).toBe(false)
    deletion.resolve(new Response(null, { status: 204 }))
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(3))
    expect(completed).toBe(false)
    creation.resolve(new Response(null, { status: 204 }))
    const session = await reset
    expect(session.status).toBe("fresh")
    expect(JSON.parse(storage.read()!)).toEqual(game.save())
    session.disconnect()
  })

  it("削除失敗では初期保存へ進まず、再試行するまで自動保存しない", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response("original"))
      .mockRejectedValueOnce(new TypeError("削除失敗"))
    vi.stubGlobal("fetch", fetcher)
    const storage = await DevFileStorage.load()
    const game = gameInTown()
    const session = await discardSave(game, storage)
    expect(session.status).toBe("unreadable")
    expect(session.problems).toEqual(["削除失敗"])
    game.send({
      type: "buy",
      shop: contentId("tools"),
      good: contentId("rope"),
    })
    await Promise.resolve()
    expect(storage.read()).toBe("original")
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
})
