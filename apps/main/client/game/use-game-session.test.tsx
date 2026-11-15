// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test"
import { GameDefinition } from "@/lib/wiz/definition/game-definition"
import { WizWorldEnvironment } from "@/lib/wiz/core/world/world"
import { realContent } from "@/lib/wiz/testing/real-content"
import { goodBySlug } from "@/lib/wiz/testing/good-by-slug"
import { contentId } from "@/lib/wiz/testing/content-id"
import { MemoryStorage } from "./memory-storage"
import { BrowserStorage } from "./browser-storage"
import { useGameSession } from "./use-game-session"

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((done, fail) => {
    resolve = done
    reject = fail
  })
  return { promise, resolve, reject }
}
const reload = vi.fn()
beforeEach(() => {
  localStorage.clear()
  reload.mockClear()
  vi.stubGlobal("location", { search: "", reload })
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  localStorage.clear()
})

async function ready(result: { current: ReturnType<typeof useGameSession> }) {
  await waitFor(() => expect(result.current.boot?.kind).toBe("ready"))
  const boot = result.current.boot
  if (boot?.kind !== "ready") throw new Error("起動していない")
  return boot
}

describe("画面と保存セッションの寿命", () => {
  it("プレビューはメモリ保存を使い、離れたら保存の購読を解除する", async () => {
    const onReady = vi.fn()
    const { result, unmount } = renderHook(() =>
      useGameSession({ screen: { name: "town" } }, onReady)
    )
    const boot = await ready(result)
    expect(boot.storage).toBeInstanceOf(MemoryStorage)
    expect(result.current.startOver).toBeNull()
    expect(onReady).toHaveBeenCalledTimes(1)
    const write = vi.spyOn(boot.storage, "write")
    act(() => {
      boot.game.restore(boot.game.save())
    })
    expect(write).toHaveBeenCalledTimes(1)
    unmount()
    boot.game.restore(boot.game.save())
    expect(write).toHaveBeenCalledTimes(1)
  })

  it("削除完了を待って一度だけ再読み込みする", async () => {
    const deletion = deferred<void>()
    const clear = vi
      .spyOn(BrowserStorage.prototype, "clear")
      .mockImplementation(() => deletion.promise)
    const { result } = renderHook(() => useGameSession())
    await ready(result)
    let first!: Promise<void>
    let second!: Promise<void>
    act(() => {
      first = result.current.startOver!()
      second = result.current.startOver!()
    })
    await second
    expect(clear).toHaveBeenCalledTimes(1)
    expect(reload).not.toHaveBeenCalled()
    await act(async () => {
      deletion.resolve()
      await first
    })
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it.each(["resolve", "reject"] as const)(
    "画面を離れた後の削除の%sで再読み込みしない",
    async (outcome) => {
      const deletion = deferred<void>()
      const clear = vi
        .spyOn(BrowserStorage.prototype, "clear")
        .mockImplementation(() => deletion.promise)
      const { result, unmount } = renderHook(() => useGameSession())
      await ready(result)
      const startOver = result.current.startOver!
      let reset!: Promise<void>
      act(() => {
        reset = startOver()
      })
      unmount()
      if (outcome === "resolve") deletion.resolve()
      else deletion.reject(new Error("削除失敗"))
      await reset
      await startOver()
      expect(clear).toHaveBeenCalledTimes(1)
      expect(reload).not.toHaveBeenCalled()
    }
  )

  it("画面を離れた後に読み込めた保存へ接続しない", async () => {
    const read = deferred<Response>()
    vi.stubGlobal("location", { search: "?save=tmp", reload })
    const fetcher = vi.fn().mockReturnValue(read.promise)
    vi.stubGlobal("fetch", fetcher)
    const onReady = vi.fn()
    const { unmount } = renderHook(() => useGameSession(undefined, onReady))
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1))
    unmount()
    await act(async () => {
      read.resolve(new Response(null, { status: 204 }))
      await read.promise
    })
    expect(onReady).not.toHaveBeenCalled()
  })

  it("初期保存の途中で離れたら、遅れて作られた自動保存も切断する", async () => {
    localStorage.setItem("dungeons-and-dungeons/save", "{壊れた保存")
    const written = deferred<void>()
    vi.spyOn(BrowserStorage.prototype, "clear").mockImplementation(() => {})
    const write = vi
      .spyOn(BrowserStorage.prototype, "write")
      .mockImplementation(() => written.promise)
    const { result, unmount } = renderHook(() => useGameSession())
    const boot = await ready(result)
    expect(boot.session.status).toBe("unreadable")
    let discard!: Promise<void>
    act(() => {
      discard = result.current.discard()
    })
    await waitFor(() => expect(write).toHaveBeenCalledTimes(1))
    unmount()
    written.resolve()
    await discard
    boot.game.restore(boot.game.save())
    expect(write).toHaveBeenCalledTimes(1)
  })

  it.each([false, true])(
    "同期保存先のStrictModeで二重接続・通知しない（preview=%s）",
    async (preview) => {
      const browserRead = vi.spyOn(BrowserStorage.prototype, "read")
      const memoryRead = vi.spyOn(MemoryStorage.prototype, "read")
      const onReady = vi.fn()
      const { result } = renderHook(
        () =>
          useGameSession(
            preview ? { screen: { name: "town" } } : undefined,
            onReady
          ),
        {
          reactStrictMode: true,
        }
      )
      await ready(result)
      expect(browserRead).toHaveBeenCalledTimes(preview ? 0 : 1)
      expect(memoryRead).toHaveBeenCalledTimes(preview ? 1 : 0)
      expect(onReady).toHaveBeenCalledTimes(1)
    }
  )

  it("StrictModeの取り消された試行でゲームの乱数を消費しない", async () => {
    // 初期武器を抽選する開始条件。本物の仲間と武器を使い、乱数の二重消費を観測する。
    const source = realContent()
    const content = {
      ...source,
      recruits: source.recruits.map((entry) =>
        entry.member.id === contentId("alda")
          ? {
              ...entry,
              member: {
                ...entry.member,
                weapon: goodBySlug("dagger").id,
                gear: [],
              },
            }
          : entry
      ),
    }
    const random = vi.fn(() => 0.5)
    const expected = new GameDefinition(content).create(
      WizWorldEnvironment.create({ random })
    )
    const draws = random.mock.calls.length
    expect(draws).toBeGreaterThan(0)
    random.mockClear()
    const environment = WizWorldEnvironment.create({ random })
    const { result } = renderHook(
      () =>
        useGameSession({
          screen: { name: "town" },
          content,
          environment,
        }),
      { reactStrictMode: true }
    )
    const boot = await ready(result)
    expect(random).toHaveBeenCalledTimes(draws)
    expect(boot.game.state).toEqual(expected.state)
  })

  it("StrictModeで開発用保存も一度だけ読み込む", async () => {
    const read = deferred<Response>()
    vi.stubGlobal("location", { search: "?save=tmp", reload })
    const fetcher = vi.fn().mockReturnValue(read.promise)
    vi.stubGlobal("fetch", fetcher)
    const onReady = vi.fn()
    const { result } = renderHook(() => useGameSession(undefined, onReady), {
      reactStrictMode: true,
    })
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1))
    expect(onReady).not.toHaveBeenCalled()
    await act(async () => {
      read.resolve(new Response(null, { status: 204 }))
      await read.promise
    })
    await ready(result)
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(onReady).toHaveBeenCalledTimes(1)
  })

  it("次の起動より遅れて届いた、前の読込結果を採用しない", async () => {
    const first = deferred<Response>()
    const second = deferred<Response>()
    vi.stubGlobal("location", { search: "?save=tmp", reload })
    const fetcher = vi
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)
    vi.stubGlobal("fetch", fetcher)
    const onReady = vi.fn()
    const previous = renderHook(() => useGameSession(undefined, onReady))
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1))
    previous.unmount()
    const current = renderHook(() => useGameSession(undefined, onReady))
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2))
    await act(async () => {
      second.resolve(new Response(null, { status: 204 }))
      await second.promise
    })
    const currentBoot = await ready(current.result)
    const currentGame = currentBoot.game
    expect(onReady).toHaveBeenCalledExactlyOnceWith(currentGame)
    await act(async () => {
      first.resolve(new Response(null, { status: 204 }))
      await first.promise
    })
    expect(onReady).toHaveBeenCalledExactlyOnceWith(currentGame)
    expect(previous.result.current.boot).toBeNull()
  })
})
