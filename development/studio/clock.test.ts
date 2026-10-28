import { describe, expect, it, vi } from "vite-plus/test"
import { StudioClock } from "@/development/studio/clock"
import { parseStudioConfig } from "@/development/studio/parse-studio-config"
import { createStudioStart } from "@/development/studio/create-studio-start"
import { GameDefinition } from "@/lib/wiz/definition/game-definition"

describe("スタジオの再現条件", () => {
  it.each([false, true])(
    "終了時は描画待ちから再開せず、残りの予約も破棄する（予約あり: %s）",
    async (scheduled) => {
      const clock = new StudioClock()
      const callback = vi.fn()
      const render = vi.fn()
      let release!: () => void
      const waiting = new Promise<void>((resolve) => (release = resolve))
      if (scheduled) clock.timeout(callback, 10, 10)
      const result = clock
        .advance(100, () => waiting, render)
        .catch((error: unknown) => error)
      const stoppedAt = clock.now
      const renderCount = render.mock.calls.length
      clock.dispose()
      // 終了前に始まったPromiseの続きも、新しい予約を残さない。
      clock.timeout(callback, 0)
      clock.frame(callback)
      release()
      expect(await result).toMatchObject({ name: "AbortError" })
      expect(clock.now).toBe(stoppedAt)
      expect(clock.pending).toBe(0)
      expect(callback).toHaveBeenCalledTimes(scheduled ? 1 : 0)
      expect(render).toHaveBeenCalledTimes(renderCount)
      await expect(clock.advance(100, async () => {})).rejects.toMatchObject({
        name: "AbortError",
      })
    }
  )
  it("同じ時刻の順序を保持し、待ちの続き・rAF・間隔を同じ時計で進める", async () => {
    const clock = new StudioClock()
    const events: string[] = []
    const interval = clock.timeout(
      () => events.push(`interval:${clock.now}`),
      10,
      10
    )
    clock.timeout(() => {
      events.push("first")
      void Promise.resolve().then(() =>
        clock.timeout(() => events.push("continued"), 5)
      )
    }, 10)
    clock.timeout(() => events.push("second"), 10)
    clock.frame((time) => events.push(`frame:${time.toFixed(2)}`))
    await clock.advance(16, async () => {
      await Promise.resolve()
    })
    expect(events).toEqual(["interval:10", "first", "second", "continued"])
    await clock.advance(20, async () => {})
    expect(events.slice(-2)).toEqual(["frame:16.67", "interval:20"])
    clock.cancel(interval)
    await clock.advance(30, async () => {})
    expect(events.at(-1)).toBe("interval:20")
    await expect(clock.advance(10, async () => {})).rejects.toThrow("逆戻り")
  })
  it("予約が尽きても、待ちの続きが入れた予約を一度に進めた範囲で走らせる", async () => {
    const clock = new StudioClock()
    const events: string[] = []
    let loaded: () => void = () => {}
    const loading = new Promise<void>((resolve) => (loaded = resolve))
    // 絵の読み込みのように、時計の外で終わる待ちのあとに演出を予約する
    void loading.then(() =>
      clock.timeout(() => events.push(`intro:${clock.now}`), 500)
    )
    await clock.advance(2500, async () => {
      loaded()
      await loading
      await Promise.resolve()
    })
    expect(events).toEqual(["intro:500"])
    expect(clock.now).toBe(2500)
  })
  it("隊列・敵・HP・種をエンジンの復元検証に通し、同じ条件を再現する", () => {
    const config = parseStudioConfig({
      party: ["hero", "rivet", "husky"],
      foes: ["haribote-adult", "hiyokobu"],
      hp: [100, 25, 0],
      seed: 77,
    })
    const first = createStudioStart(config)
    const second = createStudioStart(config)
    expect(first.save).toEqual(second.save)
    const game = new GameDefinition(first.content!).create(first.environment)
    expect(game.restore(first.save)).toBeUndefined()
    const party = game.queries.party(game.state)
    expect(party.map((member) => member.name)).toEqual([
      "あなた",
      "リベット",
      "ハスキー",
    ])
    expect(party[2].hp).toBe(0)
    expect(party[1].role).toBe("tank")
    expect(party[1].hp).toBe(Math.round(party[1].maxHp / 4))
    expect(game.queries.battle(game.state)?.foes).toHaveLength(2)
    expect(() =>
      createStudioStart(parseStudioConfig({ foes: ["missing"] }))
    ).toThrow("敵がありません")
  })
  it("破綻した指定を実行前に拒否する", () => {
    expect(() =>
      parseStudioConfig({ party: ["hero", "mayu", "mayu"] })
    ).toThrow("異なる3人")
    expect(() => parseStudioConfig({ hp: [0, 0, 0] })).toThrow("生存")
    expect(() => parseStudioConfig({ width: 0 })).toThrow()
    expect(() =>
      parseStudioConfig({ actions: [{ at: 7000, label: "発動" }] })
    ).toThrow("タイムライン")
  })
})
