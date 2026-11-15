// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react"
import { createRef } from "react"
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test"
import { AnimationBarrier } from "@/client/components/canvas/animation"
import { LeavingContext } from "@/client/components/stage/use-leaving"
import { SlantPanel } from "@/client/components/stage/slant-panel"
import type { PanelHandle } from "@/client/components/stage/slant-panel"

const mocks = vi.hoisted(() => ({
  barrier: null as AnimationBarrier | null,
  animations: [] as {
    complete: () => void
    cancel: ReturnType<typeof vi.fn>
  }[],
}))
vi.mock("@/client/components/stage/use-stage", async (original) => ({
  ...(await original<typeof import("@/client/components/stage/use-stage")>()),
  useStage: () => ({ exits: mocks.barrier }),
}))
vi.mock("motion/mini", () => ({
  animate: vi.fn(() => {
    let complete!: () => void
    const finished = new Promise<void>((resolve) => (complete = resolve))
    const cancel = vi.fn()
    mocks.animations.push({ complete, cancel })
    return { finished, cancel }
  }),
}))

beforeEach(() => {
  mocks.barrier = new AnimationBarrier()
  mocks.animations.length = 0
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([
    new DOMRect(0, 0, 300, 200),
  ] as unknown as DOMRectList)
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

it.each(["button-first", "context-first"])(
  "%s: 退場の重複要求は再生を置き換えず、本来の完了まで待つ",
  async (order) => {
    const handle = createRef<PanelHandle>()
    const view = (leaving: boolean) => (
      <LeavingContext.Provider value={leaving}>
        <SlantPanel ref={handle}>内容</SlantPanel>
      </LeavingContext.Provider>
    )
    const screen = render(view(false))
    let first: Promise<void> | undefined
    if (order === "button-first") first = handle.current!.close()
    screen.rerender(view(true))
    first ??= handle.current!.close()
    const repeated = handle.current!.close()
    const done = vi.fn()
    const barrierDone = vi.fn()
    void first.then(done)
    const exit = mocks.barrier!.wait().then(barrierDone)
    await act(async () => {})
    expect(mocks.animations).toHaveLength(1)
    expect(mocks.animations[0].cancel).not.toHaveBeenCalled()
    expect(done).not.toHaveBeenCalled()
    expect(barrierDone).not.toHaveBeenCalled()
    await act(async () => {
      mocks.animations[0].complete()
      await Promise.all([first, repeated, exit])
    })
    expect(done).toHaveBeenCalledOnce()
    expect(barrierDone).toHaveBeenCalledOnce()
  }
)
