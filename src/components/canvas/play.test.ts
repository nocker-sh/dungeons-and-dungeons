// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  animations: [] as {
    complete: () => void
    cancel: ReturnType<typeof vi.fn>
  }[],
}))
vi.mock("motion/mini", () => ({
  animate: vi.fn(() => {
    let complete!: () => void
    const finished = new Promise<void>((resolve) => {
      complete = resolve
    })
    const cancel = vi.fn()
    mocks.animations.push({ complete, cancel })
    return { finished, cancel }
  }),
}))
import { play, cancelDetachedAnimations } from "./play"
import { after } from "./animation"

beforeEach(() => {
  document.body.replaceChildren()
  cancelDetachedAnimations()
  mocks.animations.length = 0
})
function visible() {
  const element = document.createElement("div")
  document.body.append(element)
  vi.spyOn(element, "getClientRects").mockReturnValue([
    {},
  ] as unknown as DOMRectList)
  return element
}

describe("Motion再生の所有権", () => {
  it("指定時間が過ぎてもライブラリが完了するまでfinishedを解決しない", async () => {
    vi.useFakeTimers()
    try {
      const task = play(visible(), [{ opacity: 0 }, { opacity: 1 }], {
        duration: 100,
      })
      const done = vi.fn()
      void task.finished.then(done)
      await vi.advanceTimersByTimeAsync(10000)
      expect(done).not.toHaveBeenCalled()
      mocks.animations[0].complete()
      await task
      expect(done).toHaveBeenCalledOnce()
    } finally {
      vi.useRealTimers()
    }
  })
  it("同じプロパティの置換で古い待ちを解放し、古い完了処理を走らせない", async () => {
    const element = visible()
    const old = play(element, [{ opacity: 0 }, { opacity: 1 }], {
      duration: 500,
    })
    const stale = vi.fn()
    const sequence = after(old, stale)
    const current = play(element, [{ opacity: 1 }, { opacity: 0 }], {
      duration: 500,
    })
    expect(mocks.animations[0].cancel).toHaveBeenCalledOnce()
    await expect(sequence.finished).rejects.toThrow("Animation aborted")
    mocks.animations[0].complete()
    expect(stale).not.toHaveBeenCalled()
    mocks.animations[1].complete()
    await current
  })
  it("DOMから外した要素のループを停止する", () => {
    const element = visible()
    const task = play(element, [{ opacity: 0 }, { opacity: 1 }], {
      duration: 100,
      iterations: Infinity,
    })
    element.remove()
    cancelDetachedAnimations()
    expect(task.state).toBe("cancelled")
    expect(mocks.animations[0].cancel).toHaveBeenCalledOnce()
  })
  it("非表示要素へは再生を開始しない", async () => {
    const element = document.createElement("div")
    document.body.append(element)
    element.style.display = "none"
    await play(element, [{ opacity: 0 }, { opacity: 1 }], { duration: 100 })
    expect(mocks.animations).toHaveLength(0)
  })
})
