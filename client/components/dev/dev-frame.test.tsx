// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test"
import { DevFrame } from "@/client/components/dev/dev-frame"

const assets = vi.hoisted(() => ({
  load: vi.fn<(paths: readonly string[]) => Promise<void>>(),
}))
vi.mock("@void/react", () => ({
  useRouter: () => ({ query: new URLSearchParams() }),
}))
vi.mock("@/development/studio/create-studio-start", () => ({
  createStudioStart: (config: { scene: string }) => ({
    screen: { name: config.scene },
  }),
}))
vi.mock("@/development/studio/artwork", () => ({
  studioArtwork: (start: { screen: { name: string } }) =>
    Array.from({ length: 48 }, (_, index) => `${start.screen.name}/${index}`),
}))
vi.mock("@/client/game/load-artwork", () => ({ loadArtwork: assets.load }))
vi.mock("@/client/game/artwork-settled", () => ({
  artworkSettled: async () => {},
}))

beforeEach(() => {
  assets.load.mockReset()
  assets.load.mockImplementation(() => new Promise<void>(() => {}))
})
afterEach(() => {
  cleanup()
  delete window.__devStudioError
})

it("新しい場面の読み込みでは、前の場面のエラーを残さない", () => {
  window.__devStudioError = "前の場面で画像を読めませんでした"
  render(<DevFrame scene="town" />)
  expect(window.__devStudioError).toBeUndefined()
})

it("切り替え前の画像が遅れて失敗しても、新しい場面にエラーを出さない", async () => {
  let reject!: (reason: Error) => void
  assets.load.mockImplementationOnce(
    () =>
      new Promise<void>((_, fail) => {
        reject = fail
      })
  )
  const view = render(<DevFrame scene="town" />)
  view.rerender(<DevFrame scene="battle" />)
  await act(async () => reject(new Error("前の場面の画像を読めません")))
  expect(window.__devStudioError).toBeUndefined()
})

it("現在の場面の画像が失敗したときは、起動エラーを表示する", async () => {
  let reject!: (reason: Error) => void
  assets.load.mockImplementationOnce(
    () =>
      new Promise<void>((_, fail) => {
        reject = fail
      })
  )
  const view = render(<DevFrame scene="town" />)
  await act(async () => reject(new Error("現在の画像を読めません")))
  expect(window.__devStudioError).toBe("Error: 現在の画像を読めません")
  expect(view.getByRole("alert").textContent).toBe(
    "Error: 現在の画像を読めません"
  )
})

it("切り替えた場面の残りの画像を読み続けない", async () => {
  let finish!: () => void
  assets.load.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve
      })
  )
  const view = render(<DevFrame scene="town" />)
  view.rerender(<DevFrame scene="battle" />)
  await act(async () => finish())
  expect(assets.load.mock.calls.map(([paths]) => paths[0])).toEqual([
    "town/0",
    "battle/0",
  ])
})
