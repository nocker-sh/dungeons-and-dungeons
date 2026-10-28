// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { useRef } from "react"
import { afterEach, describe, expect, it, vi } from "vite-plus/test"
import { useKeyboardNav } from "@/client/components/game/focus"
import { Revolver } from "@/client/components/stage/revolver"

const transition = vi.hoisted(() => ({ going: false }))
vi.mock("@/client/components/canvas/play", () => ({ play: vi.fn() }))
vi.mock("@/client/components/stage/use-portrait", () => ({
  usePortrait: () => true,
}))
vi.mock("@/client/components/stage/use-going", () => ({
  useGoing: () => ({
    leaving: transition.going,
    going: transition.going,
    mark: transition.going ? "1" : undefined,
    completion: {},
  }),
}))

afterEach(() => {
  cleanup()
  transition.going = false
})

function Fixture({
  confirm,
  back,
  select,
  disabled = false,
}: {
  confirm: (index: number) => void
  back: () => void
  select: (index: number) => void
  disabled?: boolean
}) {
  const root = useRef<HTMLDivElement>(null)
  useKeyboardNav(root)
  return (
    <div className="game" ref={root}>
      <Revolver
        label="アイテム"
        ownEnter
        selected={0}
        items={[
          { key: "potion", name: "回復薬" },
          { key: "revive", name: "蘇生薬" },
        ]}
        onConfirm={confirm}
        onSelect={select}
        disabled={disabled}
      />
      <button className="word" style={{ opacity: 1 }} onClick={back}>
        もどる
      </button>
    </div>
  )
}

describe("リボルバーの決定先", () => {
  it.each(["ctrlKey", "metaKey", "altKey"])(
    "%s付きのキーで選択・決定・戻るを実行しない",
    (modifier) => {
      const confirm = vi.fn()
      const back = vi.fn()
      const select = vi.fn()
      render(<Fixture confirm={confirm} back={back} select={select} />)
      const list = screen.getByRole("listbox")
      list.focus()
      for (const key of ["ArrowDown", "s", "ArrowUp", "w", "Enter", " "])
        expect(fireEvent.keyDown(list, { key, [modifier]: true })).toBe(true)
      const button = screen.getByRole("button", { name: "もどる" })
      button.focus()
      expect(
        fireEvent.keyDown(button, { key: "Enter", [modifier]: true })
      ).toBe(true)
      expect(confirm).not.toHaveBeenCalled()
      expect(select).not.toHaveBeenCalled()
      expect(back).not.toHaveBeenCalled()
      list.focus()
      fireEvent.keyDown(list, { key: "Enter" })
      expect(confirm).toHaveBeenCalledExactlyOnceWith(0)
    }
  )

  it("戻るへのEnterとSpaceを奪わず、一覧の決定は1回だけ受ける", () => {
    const confirm = vi.fn()
    const back = vi.fn()
    render(<Fixture confirm={confirm} back={back} select={vi.fn()} />)
    const button = screen.getByRole("button", { name: "もどる" })
    button.focus()
    fireEvent.keyDown(button, { key: "Enter" })
    fireEvent.keyDown(button, { key: " " })
    expect(back).toHaveBeenCalledTimes(2)
    expect(confirm).not.toHaveBeenCalled()
    const list = screen.getByRole("listbox")
    list.focus()
    fireEvent.keyDown(list, { key: "Enter" })
    expect(confirm).toHaveBeenCalledExactlyOnceWith(0)
    const option = screen.getAllByRole("option")[0]!
    option.focus()
    fireEvent.keyDown(option, { key: " " })
    expect(confirm).toHaveBeenCalledTimes(2)
    expect(back).toHaveBeenCalledTimes(2)
  })

  it.each(["disabled", "leaving"])(
    "%sの一覧はクリック・方向キー・決定を受けない",
    (kind) => {
      const confirm = vi.fn()
      const select = vi.fn()
      transition.going = kind === "leaving"
      render(
        <Fixture
          confirm={confirm}
          back={vi.fn()}
          select={select}
          disabled={kind === "disabled"}
        />
      )
      const list = screen.getByRole("listbox")
      list.focus()
      fireEvent.keyDown(list, { key: "Enter" })
      fireEvent.keyDown(window, { key: "ArrowDown" })
      fireEvent.click(screen.getAllByRole("option")[0]!)
      expect(confirm).not.toHaveBeenCalled()
      expect(select).not.toHaveBeenCalled()
    }
  )
})
