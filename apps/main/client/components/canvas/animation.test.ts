import { describe, expect, it, vi } from "vite-plus/test"
import { after } from "@/client/components/canvas/after"
import { AnimationScope } from "@/client/components/canvas/animation"
import { parallel } from "@/client/components/canvas/parallel"
import { playback } from "@/client/components/canvas/playback"

function controlled(infinite = false) {
  let complete!: () => void
  const stop = vi.fn()
  const task = playback(
    new Promise<void>((resolve) => {
      complete = resolve
    }),
    stop,
    { infinite }
  )
  return { task, complete, stop }
}
const flush = async () => {
  for (let index = 0; index < 20; index++) await Promise.resolve()
}

describe("演出の順序と寿命", () => {
  it("秒数を推測せず、ダメージの到着とHP・退場の両方が終わってから次へ進む", async () => {
    const order: string[] = []
    let damage!: ReturnType<typeof controlled>
    let hp!: ReturnType<typeof controlled>
    let exit!: ReturnType<typeof controlled>
    const result = parallel(() => {
      damage = controlled()
      after(damage.task, () => {
        order.push("damage arrived")
        hp = controlled()
        exit = controlled()
      })
    })
    const next = result.finished.then(() => order.push("next turn"))
    await flush()
    expect(order).toEqual([])
    damage.complete()
    await flush()
    expect(order).toEqual(["damage arrived"])
    hp.complete()
    await flush()
    expect(order).toEqual(["damage arrived"])
    exit.complete()
    await next
    expect(order).toEqual(["damage arrived", "next turn"])
  })
  it("途中で画面を離れると、遅れた完了通知からHPや次の手番を更新しない", async () => {
    const controller = new AbortController()
    const update = vi.fn()
    let damage!: ReturnType<typeof controlled>
    const result = parallel(() => {
      damage = controlled()
      after(damage.task, update, controller.signal)
    }, controller.signal)
    controller.abort()
    await expect(result.finished).rejects.toThrow("Animation aborted")
    damage.complete()
    await flush()
    expect(update).not.toHaveBeenCalled()
    expect(damage.stop).toHaveBeenCalledOnce()
  })
  it("無限の背景は次の拍を止めず、所有する演出が終わると停止する", async () => {
    let background!: ReturnType<typeof controlled>
    let foreground!: ReturnType<typeof controlled>
    const result = parallel(() => {
      background = controlled(true)
      foreground = controlled()
    })
    foreground.complete()
    await result
    expect(background.stop).toHaveBeenCalledOnce()
  })
  it("キャンセルした古い再生の続きは起動しない", async () => {
    const old = controlled()
    const next = vi.fn()
    const sequence = after(old.task, next)
    old.task.cancel()
    old.complete()
    await expect(sequence.finished).rejects.toThrow("Animation aborted")
    expect(next).not.toHaveBeenCalled()
  })
  it("中断済みのスコープでは新しいアニメーションを開始しない", () => {
    const scope = new AnimationScope()
    scope.cancel()
    const start = vi.fn()
    expect(() => scope.capture(start)).toThrow("Animation aborted")
    expect(start).not.toHaveBeenCalled()
  })
  it("画面をまたぐ演出は、明示した途中の完了まで待って次の画面へ渡せる", async () => {
    let open!: () => void
    let closed!: () => void
    let curtain!: ReturnType<typeof playback>
    const closing = new Promise<void>((resolve) => {
      closed = resolve
    })
    const transition = parallel(() => {
      curtain = playback(
        new Promise<void>((resolve) => {
          open = resolve
        }),
        () => {},
        { collect: false }
      )
      return closing
    })
    closed()
    await transition
    expect(curtain.state).toBe("running")
    open()
    await curtain
  })
  it("一つが失敗したら並列の残りを停止し、失敗を成功として隠さない", async () => {
    let fail!: (error: Error) => void
    let sibling!: ReturnType<typeof controlled>
    const group = parallel(() => {
      playback(
        new Promise<void>((_, reject) => {
          fail = reject
        }),
        () => {}
      )
      sibling = controlled()
    })
    fail(new Error("render failed"))
    await expect(group.finished).rejects.toThrow("render failed")
    expect(sibling.stop).toHaveBeenCalledOnce()
  })
})
