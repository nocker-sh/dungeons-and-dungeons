// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vite-plus/test"
import { StageContext, type StageApi } from "@/components/stage/stage-context"
import { useNavState } from "./nav"

function stageWith() {
  const to = vi.fn(() => Promise.resolve())
  const stage = {
    camera: { to, cam: { x: 0, y: 0, z: 1, r: 0, blur: 0 } },
    exits: { wait: () => Promise.resolve() },
  } as unknown as StageApi
  const wrapper = ({ children }: { children: ReactNode }) => (
    <StageContext.Provider value={stage}>{children}</StageContext.Provider>
  )
  return { to, wrapper }
}

describe("行き先へ寄る切り替え", () => {
  it("寄っている間の連打で二重に切り替えず、寄り終えてから選んだ画面へ行く", async () => {
    const { to, wrapper } = stageWith()
    const { result } = renderHook(() => useNavState({ name: "town" }), {
      wrapper,
    })
    act(() => result.current.arrived())
    expect(result.current.phase.kind).toBe("showing")
    const zoom = {
      exit: { x: 120, y: -80, z: 3.4, r: 0, blur: 16, ms: 420 },
      enter: "dolly" as const,
    }
    let first!: Promise<void>
    let second!: Promise<void>
    act(() => {
      first = result.current.go({ name: "place", place: "guild" }, zoom)
      second = result.current.go({ name: "place", place: "shop" }, zoom)
    })
    expect(result.current.phase.kind).toBe("leaving")
    expect(result.current.screen).toEqual({ name: "town" })
    await act(async () => {
      await Promise.all([first, second])
    })
    expect(to).toHaveBeenCalledTimes(1)
    expect(to.mock.calls[0]).toEqual(
      expect.arrayContaining([{ x: 120, y: -80, z: 3.4, r: 0, blur: 16 }, 420])
    )
    expect(result.current.phase).toEqual({
      kind: "arriving",
      screen: { name: "place", place: "guild" },
      enter: "dolly",
    })
  })
})
