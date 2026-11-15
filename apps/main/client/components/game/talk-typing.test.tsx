// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
} from "@testing-library/react"
import { afterEach, expect, test, vi } from "vite-plus/test"
import conversations from "@/content/data/conversations.json"
import { Conversation } from "@/client/components/game/conversation"
import { StageContext } from "@/client/components/stage/use-stage"
import type { StageApi } from "@/client/components/stage/use-stage"
import { AnimationBarrier } from "@/client/components/canvas/animation"
import { Camera } from "@/client/components/stage/camera"
import { FxStore } from "@/client/components/stage/fx/store"
import { StageDirector } from "@/client/components/stage/director"
import { useTyping } from "@/client/components/game/talk-typing"

const clock = vi.hoisted(() => ({
  frames: [] as { update: (value: number) => void; stop: () => void }[],
}))
vi.mock("motion", async () => ({
  ...(await vi.importActual<typeof import("motion")>("motion")),
  animate: (
    _from: number,
    _to: number,
    options: { onUpdate: (value: number) => void }
  ) => {
    const stop = vi.fn()
    clock.frames.push({ update: options.onUpdate, stop })
    return { finished: new Promise<void>(() => {}), stop }
  },
}))

afterEach(() => {
  cleanup()
  clock.frames.length = 0
})

type Props = { text: string; line: object }

const text = conversations[0].lines[0].text
const another = conversations[0].lines[1].text

for (const adjacent of [true, false])
  test(`a distinct line with repeated text starts unread (adjacent: ${adjacent})`, () => {
    const hook = renderHook(
      (props: Props) => useTyping(props.text, props.line),
      {
        initialProps: { text, line: {} },
      }
    )
    act(() => hook.result.current.finish())
    expect(hook.result.current).toMatchObject({ shown: text, done: true })
    if (!adjacent) hook.rerender({ text: another, line: {} })
    hook.rerender({ text, line: {} })
    expect(hook.result.current).toMatchObject({ shown: "", done: false })
    act(() => clock.frames.at(-1)!.update(2))
    expect(hook.result.current).toMatchObject({
      shown: text.slice(0, 2),
      done: false,
    })
    act(() => hook.result.current.finish())
    expect(hook.result.current).toMatchObject({ shown: text, done: true })
  })

test("rerendering the same line retains progress and unmount stops its clock", () => {
  const initial = { text, line: {} }
  const hook = renderHook((props: Props) => useTyping(props.text, props.line), {
    initialProps: initial,
  })
  act(() => clock.frames[0].update(3))
  hook.rerender(initial)
  expect(hook.result.current).toMatchObject({
    shown: text.slice(0, 3),
    done: false,
  })
  expect(clock.frames).toHaveLength(1)
  act(() => hook.result.current.finish())
  hook.rerender(initial)
  expect(hook.result.current).toMatchObject({ shown: text, done: true })
  hook.unmount()
  expect(clock.frames[0].stop).toHaveBeenCalledOnce()
})

test("the real conversation requires reveal before advancing each repeated line", () => {
  const host = document.createElement("div")
  const canvas = document.createElement("div")
  host.append(canvas)
  document.body.append(host)
  const stage: StageApi = {
    exits: new AnimationBarrier(),
    updates: new AnimationBarrier(),
    camera: new Camera(),
    fxStore: new FxStore(),
    set: { current: null },
    artboard: null,
    chrome: null,
    solo: null,
    art: async () => {},
    bars: () => {},
    canvas: { current: canvas },
    director: new StageDirector(),
  }
  const onLine = vi.fn()
  const view = render(
    <StageContext value={stage}>
      <Conversation
        actors={[]}
        script={{
          lines: [
            [0, text],
            [0, text],
            [0, another],
          ],
        }}
        onLine={onLine}
        onDone={vi.fn()}
      />
    </StageContext>
  )
  try {
    const button = screen.getByRole("button", { name: "会話を進める" })
    fireEvent.click(button)
    expect(button.textContent).toContain(text)
    fireEvent.click(button)
    expect(button.hasAttribute("data-conversation-ready")).toBe(false)
    expect(button.textContent).not.toContain(text)
    fireEvent.click(button)
    expect(button.textContent).toContain(text)
    expect(onLine.mock.calls.map((call) => call[0])).toEqual([0, 1])
    fireEvent.click(button)
    expect(onLine.mock.calls.map((call) => call[0])).toEqual([0, 1, 2])
  } finally {
    view.unmount()
    host.remove()
  }
})
