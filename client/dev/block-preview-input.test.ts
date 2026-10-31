// @vitest-environment jsdom
import { expect, it, vi } from "vite-plus/test"
import { blockPreviewInput } from "@/client/dev/block-preview-input"

it("台本のプログラム操作を保ち、ゲームパッドを復元する", () => {
  const original = Object.getOwnPropertyDescriptor(navigator, "getGamepads")
  const restore = blockPreviewInput()
  const button = document.createElement("button")
  const click = vi.fn()
  button.addEventListener("click", click)
  document.body.append(button)
  try {
    expect(navigator.getGamepads()).toEqual([])
    button.click()
    expect(click).toHaveBeenCalledOnce()
  } finally {
    restore()
    button.remove()
  }
  expect(Object.getOwnPropertyDescriptor(navigator, "getGamepads")).toEqual(
    original
  )
})
