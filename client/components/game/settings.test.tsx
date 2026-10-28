// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vite-plus/test"
import type { Props as WordProps } from "@/client/components/stage/word"
import type { PanelHandle } from "@/client/components/stage/slant-panel"
import { Settings } from "@/client/components/game/settings"
import { StartOverContext } from "@/client/components/game/settings-panel"

const animation = vi.hoisted(() => ({ close: vi.fn() }))
vi.mock("@/client/components/stage/slant-panel", async () => {
  const { forwardRef, useImperativeHandle } = await import("react")
  return {
    SlantPanel: forwardRef<PanelHandle, { children?: ReactNode }>(
      function Panel({ children }, ref) {
        useImperativeHandle(ref, () => ({ close: animation.close }))
        return <>{children}</>
      }
    ),
  }
})
vi.mock("@/client/components/stage/use-wide", () => ({ useWide: () => false }))
vi.mock("@/client/components/stage/word", () => ({
  Word: ({ text, buttonRef, disabled, onClick }: WordProps) => (
    <button
      ref={buttonRef}
      disabled={disabled}
      onClick={(event) => onClick?.(event.currentTarget)}
    >
      {text}
    </button>
  ),
}))
vi.mock("@/client/components/stage/stage-chrome", () => ({
  StageChrome: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})

function openSettings() {
  const startOver = vi.fn()
  render(
    <StartOverContext value={startOver}>
      <Settings />
    </StartOverContext>
  )
  const trigger = screen.getByRole("button", { name: "設定" })
  trigger.focus()
  fireEvent.click(trigger)
  return {
    trigger,
    startOver,
    dialog: screen.getByRole("dialog", { name: "設定" }),
  }
}

describe("設定の操作", () => {
  it.each(["ctrlKey", "metaKey", "altKey"])(
    "%s付きのキーはブラウザへ渡し、設定を移動・終了しない",
    (modifier) => {
      const { dialog, startOver } = openSettings()
      const focused = document.activeElement!
      for (const key of ["Tab", "Escape", "Backspace"])
        expect(fireEvent.keyDown(focused, { key, [modifier]: true })).toBe(true)
      expect(document.activeElement).toBe(focused)
      expect(screen.getByRole("dialog", { name: "設定" })).toBe(dialog)
      expect(animation.close).not.toHaveBeenCalled()
      expect(startOver).not.toHaveBeenCalled()
    }
  )

  it("Tabを中で循環させ、削除確認と取消のあとも操作先を保つ", () => {
    const { dialog, startOver } = openSettings()
    const close = screen.getByRole("button", { name: "閉じる" })
    const start = screen.getByRole("button", { name: "はじめから遊ぶ" })
    expect(document.activeElement).toBe(close)
    fireEvent.keyDown(close, { key: "Tab" })
    expect(document.activeElement).toBe(start)
    fireEvent.keyDown(start, { key: "Tab", shiftKey: true })
    expect(document.activeElement).toBe(close)
    fireEvent.click(start)
    const cancel = screen.getByRole("button", { name: "やめる" })
    expect(document.activeElement).toBe(cancel)
    fireEvent.keyDown(cancel, { key: "Tab", shiftKey: true })
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "消して始める" })
    )
    fireEvent.click(cancel)
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "はじめから遊ぶ" })
    )
    // 閉じる途中などでフォーカスがボタンにない場合も、先頭・末尾から循環する。
    dialog.focus()
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true })
    expect(document.activeElement).toBe(close)
    expect(startOver).not.toHaveBeenCalled()
  })

  it("Escapeを共通操作へ流さず、退場を一度だけ待って起点に戻す", async () => {
    let finish!: () => void
    animation.close.mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve
      })
    )
    const { trigger, dialog, startOver } = openSettings()
    const leaked = vi.fn()
    window.addEventListener("keydown", leaked)
    try {
      fireEvent.keyDown(document.activeElement!, { key: "Escape" })
      fireEvent.keyDown(dialog, { key: "Escape" })
      fireEvent.keyDown(dialog, { key: "Backspace" })
      expect(animation.close).toHaveBeenCalledTimes(1)
      expect(leaked).not.toHaveBeenCalled()
      expect(document.activeElement).toBe(dialog)
      expect(dialog.getAttribute("aria-busy")).toBe("true")
      expect(dialog.querySelectorAll("button:not(:disabled)")).toHaveLength(0)
      fireEvent.keyDown(dialog, { key: "Tab" })
      expect(document.activeElement).toBe(dialog)
      expect(screen.getByRole("dialog", { name: "設定" })).toBe(dialog)
      await act(async () => {
        finish()
      })
      expect(screen.queryByRole("dialog", { name: "設定" })).toBeNull()
      expect(document.activeElement).toBe(trigger)
      expect(startOver).not.toHaveBeenCalled()
    } finally {
      window.removeEventListener("keydown", leaked)
    }
  })

  it("保存の削除開始後は重複実行・取消・背面への移動を受け付けない", async () => {
    let finish!: () => void
    const { dialog, startOver } = openSettings()
    startOver.mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve
      })
    )
    fireEvent.click(screen.getByRole("button", { name: "はじめから遊ぶ" }))
    const erase = screen.getByRole("button", { name: "消して始める" })
    const cancel = screen.getByRole("button", { name: "やめる" })
    fireEvent.click(erase)
    expect(startOver).toHaveBeenCalledTimes(1)
    expect(dialog.getAttribute("aria-busy")).toBe("true")
    expect(document.activeElement).toBe(dialog)
    expect(screen.getByRole("status").textContent).toContain(
      "保存を消しています"
    )
    expect(dialog.querySelectorAll("button:not(:disabled)")).toHaveLength(0)
    fireEvent.click(erase)
    fireEvent.click(cancel)
    for (const key of ["Tab", "Escape", "Backspace"])
      fireEvent.keyDown(dialog, { key })
    expect(startOver).toHaveBeenCalledTimes(1)
    expect(animation.close).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(dialog)
    expect(screen.getByRole("dialog", { name: "設定" })).toBe(dialog)
    await act(async () => finish())
    // 再読み込み・失敗表示は起動側が行う。その画面が替わるまでロックを保つ。
    expect(dialog.getAttribute("aria-busy")).toBe("true")
  })
})
