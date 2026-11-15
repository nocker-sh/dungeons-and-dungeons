// @vitest-environment jsdom
import { expect, it, vi } from "vite-plus/test"
import { MotionGlobalConfig } from "motion"
import { parseStudioConfig } from "@/development/studio/parse-studio-config"
import { StudioRuntime } from "./studio-runtime"
import { artworkSettled } from "@/client/game/artwork-settled"

vi.mock("@/client/game/artwork-settled", () => ({
  artworkSettled: vi.fn(async () => {}),
}))

it("描画完了を待った後にアニメーションを更新し直さない", async () => {
  const animate = Object.getOwnPropertyDescriptor(Element.prototype, "animate")
  const animations = Object.getOwnPropertyDescriptor(document, "getAnimations")
  const nativeFrame = window.requestAnimationFrame
  let pendingPaint = false
  let paintedBeforePresentation = false
  let currentTime = 0
  const animation = {
    playState: "paused",
    ready: Promise.resolve(),
    effect: {
      getComputedTiming: () => ({
        activeDuration: 1000,
        endTime: 1000,
        delay: 0,
      }),
      getTiming: () => ({ delay: 0 }),
      getKeyframes: () => [{ opacity: 0 }, { opacity: 1 }],
    },
    pause: () => {},
    cancel: () => {},
    get currentTime() {
      return currentTime
    },
    set currentTime(time: number) {
      currentTime = time
      pendingPaint = true
    },
  }
  Object.defineProperty(Element.prototype, "animate", {
    configurable: true,
    value: () => animation,
  })
  Object.defineProperty(document, "getAnimations", {
    configurable: true,
    value: () => [],
  })
  window.requestAnimationFrame = (callback) => {
    queueMicrotask(() => {
      paintedBeforePresentation ||=
        document.querySelector("[data-studio-initial-paint]") !== null
      pendingPaint = false
      callback(0)
    })
    return 0
  }
  const studio = new StudioRuntime(parseStudioConfig({}))
  try {
    studio.ready = true
    expect(
      document.querySelectorAll("[data-studio-initial-paint]")
    ).toHaveLength(1)
    await expect(studio.snapshot()).rejects.toThrow("最初の時刻の描画")
    document.createElement("div").animate([{ opacity: 0 }, { opacity: 1 }])
    expect(pendingPaint).toBe(true)
    await studio.advance(0)
    expect(pendingPaint).toBe(false)
    expect(paintedBeforePresentation).toBe(false)
    expect(studio.settled).toBe(true)
    expect((await studio.snapshot()).time).toBe(0)
  } finally {
    studio.dispose()
    expect(
      document.querySelectorAll("[data-studio-initial-paint]")
    ).toHaveLength(0)
    window.requestAnimationFrame = nativeFrame
    if (animate) Object.defineProperty(Element.prototype, "animate", animate)
    else Reflect.deleteProperty(Element.prototype, "animate")
    if (animations) Object.defineProperty(document, "getAnimations", animations)
    else Reflect.deleteProperty(document, "getAnimations")
  }
})

it("操作対象だけを選び、祖先が無効なボタンを成功と記録しない", () => {
  const animate = Object.getOwnPropertyDescriptor(Element.prototype, "animate")
  Object.defineProperty(Element.prototype, "animate", {
    configurable: true,
    value: vi.fn(),
  })
  const hitTest = Object.getOwnPropertyDescriptor(document, "elementFromPoint")
  const host = document.createElement("div")
  document.body.append(host)
  const studio = new StudioRuntime(parseStudioConfig({}))
  try {
    for (const [markup, success] of [
      ['<div aria-label="対象">場面</div>', false],
      ['<button aria-label="対象" disabled>無効</button>', false],
      [
        '<fieldset disabled><button aria-label="対象">無効</button></fieldset>',
        false,
      ],
      ['<div inert><button aria-label="対象">無効</button></div>', false],
      [
        '<div aria-disabled="true"><button aria-label="対象">無効</button></div>',
        false,
      ],
      ['<button aria-label="対象">操作</button>', true],
      ['<div role="button" aria-label="対象">操作</div>', true],
      ['<div data-action="対象">操作</div>', true],
    ] as const) {
      host.innerHTML = markup
      const target = host.querySelector<HTMLElement>(
        "[aria-label], [data-action]"
      )!
      const clicked = vi.fn()
      target.addEventListener("click", clicked)
      target.getBoundingClientRect = () => new DOMRect(10, 10, 100, 50)
      Object.defineProperty(document, "elementFromPoint", {
        configurable: true,
        value: () => target,
      })
      studio.click("対象")
      expect(studio.operations.at(-1)?.success, markup).toBe(success)
      expect(clicked, markup).toHaveBeenCalledTimes(success ? 1 : 0)
    }
    expect(studio.errors).toHaveLength(5)
  } finally {
    studio.dispose()
    host.remove()
    if (animate) Object.defineProperty(Element.prototype, "animate", animate)
    else Reflect.deleteProperty(Element.prototype, "animate")
    if (hitTest) Object.defineProperty(document, "elementFromPoint", hitTest)
    else Reflect.deleteProperty(document, "elementFromPoint")
  }
})

it("終了を二度呼んでも、次のスタジオの時計を解除しない", () => {
  const animate = Object.getOwnPropertyDescriptor(Element.prototype, "animate")
  Object.defineProperty(Element.prototype, "animate", {
    configurable: true,
    writable: true,
    value: vi.fn(),
  })
  const originalNow = Reflect.get(performance, "now")
  const manual = MotionGlobalConfig.useManualTiming
  const old = new StudioRuntime(parseStudioConfig({ scene: "town" }))
  let next: StudioRuntime | undefined
  try {
    old.dispose()
    next = new StudioRuntime(parseStudioConfig({ scene: "battle" }))
    next.clock.now = 1234
    const timeout = window.setTimeout
    const frame = window.requestAnimationFrame
    old.dispose()
    expect(window.__devStudio).toBe(next)
    expect(performance.now()).toBe(1234)
    expect(Date.now()).toBe(1700000001234)
    expect(window.setTimeout).toBe(timeout)
    expect(window.requestAnimationFrame).toBe(frame)
    expect(MotionGlobalConfig.useManualTiming).toBe(true)
  } finally {
    old.dispose()
    next?.dispose()
    if (animate) Object.defineProperty(Element.prototype, "animate", animate)
    else Reflect.deleteProperty(Element.prototype, "animate")
  }
  expect(Reflect.get(performance, "now")).toBe(originalNow)
  expect(MotionGlobalConfig.useManualTiming).toBe(manual)
})

it("描画待ちの途中で終了した時計は、残りの操作を新しい場面へ実行しない", async () => {
  const animate = Object.getOwnPropertyDescriptor(Element.prototype, "animate")
  const animations = Object.getOwnPropertyDescriptor(document, "getAnimations")
  const nativeFrame = window.requestAnimationFrame
  // jsdomのrAF内部タイマーを、次の仮想時計に取り込ませない。
  window.requestAnimationFrame = (callback) => {
    queueMicrotask(() => callback(0))
    return 0
  }
  Object.defineProperty(Element.prototype, "animate", {
    configurable: true,
    value: vi.fn(),
  })
  Object.defineProperty(document, "getAnimations", {
    configurable: true,
    value: () => [],
  })
  let release!: () => void
  vi.mocked(artworkSettled).mockReturnValueOnce(
    new Promise<void>((resolve) => (release = resolve))
  )
  const old = new StudioRuntime(parseStudioConfig({ scene: "town" }))
  let next: StudioRuntime | undefined
  try {
    old.ready = true
    const first = vi.fn()
    const late = vi.fn()
    old.clock.timeout(first, 5)
    old.clock.timeout(late, 10)
    const result = old.advance(20).then(
      () => "completed",
      (error: unknown) => error
    )
    expect(first).toHaveBeenCalledOnce()
    old.dispose()
    next = new StudioRuntime(parseStudioConfig({ scene: "battle" }))
    next.clock.now = 1234
    release()
    const outcome = await result
    expect(late).not.toHaveBeenCalled()
    expect(outcome).toMatchObject({ name: "AbortError" })
    expect(old.ready).toBe(false)
    expect(old.settled).toBe(false)
    expect(old.clock.pending).toBe(0)
    expect(performance.now()).toBe(1234)
    expect(window.__devStudio).toBe(next)
  } finally {
    release()
    old.dispose()
    next?.dispose()
    window.requestAnimationFrame = nativeFrame
    vi.mocked(artworkSettled).mockResolvedValue(undefined)
    if (animate) Object.defineProperty(Element.prototype, "animate", animate)
    else Reflect.deleteProperty(Element.prototype, "animate")
    if (animations) Object.defineProperty(document, "getAnimations", animations)
    else Reflect.deleteProperty(document, "getAnimations")
  }
})

it.each([0, 1])(
  "終了時は届かない実フレームを待たず、描画待ちと予約を取り消す（配信済み%s）",
  async (delivered) => {
    const animate = Object.getOwnPropertyDescriptor(
      Element.prototype,
      "animate"
    )
    const animations = Object.getOwnPropertyDescriptor(
      document,
      "getAnimations"
    )
    const requestFrame = window.requestAnimationFrame
    const cancelFrame = window.cancelAnimationFrame
    const callbacks = new Map<number, FrameRequestCallback>()
    let serial = 0
    let entered!: () => void
    const painting = new Promise<void>((resolve) => {
      entered = resolve
    })
    window.requestAnimationFrame = (callback) => {
      const id = ++serial
      callbacks.set(id, callback)
      entered()
      return id
    }
    const cancel = vi.fn((id: number) => {
      callbacks.delete(id)
    })
    window.cancelAnimationFrame = cancel
    Object.defineProperty(Element.prototype, "animate", {
      configurable: true,
      value: vi.fn(),
    })
    Object.defineProperty(document, "getAnimations", {
      configurable: true,
      value: () => [],
    })
    const studio = new StudioRuntime(parseStudioConfig({}))
    let outcome: unknown
    studio.ready = true
    const operation = studio.advance(0).then(
      () => {
        outcome = "completed"
      },
      (problem) => {
        outcome = problem
      }
    )
    try {
      await painting
      if (delivered) {
        const [id, callback] = callbacks.entries().next().value!
        callbacks.delete(id)
        callback(0)
      }
      studio.dispose()
      await Promise.resolve()
      await Promise.resolve()
      expect(outcome).toMatchObject({ name: "AbortError" })
      expect(cancel).toHaveBeenCalledWith(delivered + 1)
      expect(callbacks.size).toBe(0)
      expect(studio.settled).toBe(false)
    } finally {
      studio.dispose()
      // 旧実装でも失敗後の待機を解放し、次のテストへ時計を残さない。
      while (callbacks.size) {
        const [id, callback] = callbacks.entries().next().value!
        callbacks.delete(id)
        callback(0)
      }
      await operation
      window.requestAnimationFrame = requestFrame
      window.cancelAnimationFrame = cancelFrame
      if (animate) Object.defineProperty(Element.prototype, "animate", animate)
      else Reflect.deleteProperty(Element.prototype, "animate")
      if (animations)
        Object.defineProperty(document, "getAnimations", animations)
      else Reflect.deleteProperty(document, "getAnimations")
    }
  }
)

it("画像の読み込み中に終了したら、完了後に実フレームを予約しない", async () => {
  const animate = Object.getOwnPropertyDescriptor(Element.prototype, "animate")
  const animations = Object.getOwnPropertyDescriptor(document, "getAnimations")
  const requestFrame = window.requestAnimationFrame
  const frame = vi.fn((callback: FrameRequestCallback) => {
    queueMicrotask(() => callback(0))
    return 0
  })
  window.requestAnimationFrame = frame
  Object.defineProperty(Element.prototype, "animate", {
    configurable: true,
    value: vi.fn(),
  })
  Object.defineProperty(document, "getAnimations", {
    configurable: true,
    value: () => [],
  })
  let entered!: () => void
  let release!: () => void
  const decoding = new Promise<void>((resolve) => {
    entered = resolve
  })
  const decoded = new Promise<void>((resolve) => {
    release = resolve
  })
  const image = document.createElement("img")
  image.decode = () => {
    entered()
    return decoded
  }
  document.body.append(image)
  const studio = new StudioRuntime(parseStudioConfig({}))
  studio.ready = true
  const operation = studio.advance(0).then(
    () => "completed",
    (error: unknown) => error
  )
  try {
    await decoding
    studio.dispose()
    release()
    expect(await operation).toMatchObject({ name: "AbortError" })
    expect(frame).not.toHaveBeenCalled()
    expect(studio.settled).toBe(false)
  } finally {
    release()
    await operation
    studio.dispose()
    image.remove()
    window.requestAnimationFrame = requestFrame
    if (animate) Object.defineProperty(Element.prototype, "animate", animate)
    else Reflect.deleteProperty(Element.prototype, "animate")
    if (animations) Object.defineProperty(document, "getAnimations", animations)
    else Reflect.deleteProperty(document, "getAnimations")
  }
})
