// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { useState } from "react"
import { afterEach, describe, expect, it, vi } from "vite-plus/test"
import { katakanaOf } from "@/lib/wiz/rules/katakana-of"
import { NameField } from "@/client/components/canvas/name-field"

afterEach(cleanup)

function Input({ submit }: { submit: () => void }) {
  const [name, setName] = useState("")
  return (
    <NameField
      value={name}
      onChange={setName}
      normalize={katakanaOf}
      onSubmit={submit}
      maxLength={6}
      label="名前"
    />
  )
}

describe("日本語変換中の名前入力", () => {
  it.each(["ctrlKey", "metaKey", "altKey"])(
    "%s付きのEnterでは名前を決定しない",
    (modifier) => {
      const submit = vi.fn()
      render(<Input submit={submit} />)
      const field = screen.getByRole("textbox")
      expect(fireEvent.keyDown(field, { key: "Enter", [modifier]: true })).toBe(
        true
      )
      expect(submit).not.toHaveBeenCalled()
      fireEvent.keyDown(field, { key: "Enter" })
      expect(submit).toHaveBeenCalledTimes(1)
    }
  )

  it("変換中の文字を保ち、変換確定のEnterでは送信しない", () => {
    const submit = vi.fn()
    render(<Input submit={submit} />)
    const field = screen.getByRole("textbox") as HTMLInputElement
    fireEvent.compositionStart(field)
    fireEvent.change(field, { target: { value: "のあ" } })
    expect(field.value).toBe("のあ")
    fireEvent.keyDown(field, { key: "Enter", isComposing: true, keyCode: 229 })
    expect(submit).not.toHaveBeenCalled()
    fireEvent.compositionEnd(field)
    expect(field.value).toBe("ノア")
    fireEvent.keyDown(field, { key: "Enter", keyCode: 13 })
    expect(submit).toHaveBeenCalledTimes(1)
  })

  it("compositionendが先に届く確定Enterも除外し、その次のEnterは送信できる", () => {
    const submit = vi.fn()
    render(<Input submit={submit} />)
    const field = screen.getByRole("textbox") as HTMLInputElement
    fireEvent.compositionStart(field)
    fireEvent.change(field, { target: { value: "のあ" } })
    fireEvent.compositionEnd(field)
    expect(field.value).toBe("ノア")
    fireEvent.keyDown(field, { key: "Enter", isComposing: false, keyCode: 229 })
    expect(submit).not.toHaveBeenCalled()
    fireEvent.keyDown(field, { key: "Enter", keyCode: 13 })
    expect(submit).toHaveBeenCalledTimes(1)
  })
})
