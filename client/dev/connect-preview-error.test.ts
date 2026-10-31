// @vitest-environment jsdom
import { expect, it } from "vite-plus/test"
import { connectPreviewError } from "@/client/dev/connect-preview-error"

it("無効なURLも検査窓口から理由を返し、終了時に自分の窓口を片付ける", () => {
  const disconnect = connectPreviewError({
    mode: "view",
    error: "場面がありません",
  })
  expect(window.__devPreview?.ready).toBe(false)
  expect(window.__devPreview?.error).toBe("場面がありません")
  expect(window.__devPreview?.stage).toBe("error")
  expect(window.__devPreview?.inspect()).toBeNull()
  disconnect()
  expect(window.__devPreview).toBeUndefined()
})
