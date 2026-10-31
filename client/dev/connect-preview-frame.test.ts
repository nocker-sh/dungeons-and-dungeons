// @vitest-environment jsdom
import { afterEach, expect, it } from "vite-plus/test"
import { connectPreviewFrame } from "@/client/dev/connect-preview-frame"

afterEach(() => {
  document.body.replaceChildren()
  delete window.__devPreview
})
it("iframeの文書が切り替わる途中も起動待ちを検査できる", () => {
  const frame = document.createElement("iframe")
  document.body.append(frame)
  frame.contentDocument?.documentElement.remove()
  const disconnect = connectPreviewFrame({ frame, mode: "view" })
  expect(window.__devPreview?.ready).toBe(false)
  expect(window.__devPreview?.stage).toBe("connecting")
  expect(window.__devPreview?.error).toBeNull()
  expect(window.__devPreview?.inspect()).toBeNull()
  disconnect()
})
it("古いフレームの終了で新しい検査窓口を消さない", () => {
  const frame = document.createElement("iframe")
  document.body.append(frame)
  const old = connectPreviewFrame({ frame, mode: "view" })
  const current = connectPreviewFrame({ frame, mode: "play" })
  old()
  expect(window.__devPreview?.mode).toBe("play")
  current()
  expect(window.__devPreview).toBeUndefined()
})
