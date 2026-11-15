// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vite-plus/test"
import { StandActions } from "@/client/components/game/stand/stand-actions"

const member = (id: string) => ({ id, name: id, inParty: true, row: "front" })
vi.mock("@/client/contexts/use-game", () => ({
  useGame: () => ({
    queries: {
      member: (_: unknown, id: string) => member(id),
      gearLock: () => null,
      weaponLock: () => null,
      party: () => [],
      reserve: () => [],
    },
  }),
}))
vi.mock("@/client/contexts/use-game-state", () => ({
  useGameState: () => ({ phase: { type: "town" } }),
}))
vi.mock("@/client/components/stage/use-fx", () => ({ useFx: () => ({}) }))
vi.mock("@/client/components/stage/use-wide", () => ({ useWide: () => false }))
vi.mock("@/client/components/game/formation/context", () => ({
  useFormation: () => ({}),
}))
vi.mock("@/client/components/game/list-view/use-list-burst", () => ({
  useListBurst: () => () => {},
}))
vi.mock("@/client/components/stage/word", () => ({
  Word: (props: { text: string; onClick: () => void }) => (
    <button onClick={props.onClick}>{props.text}</button>
  ),
}))
vi.mock("@/client/components/game/list-view/list-view", () => ({
  ListView: (props: { title: string }) => <div role="dialog">{props.title}</div>,
}))

afterEach(cleanup)

describe("StandActions", () => {
  it("別の仲間に切り替わったら、開いていた欄を閉じる", () => {
    const { rerender } = render(<StandActions id="a" onClose={() => {}} />)
    fireEvent.click(screen.getByText("交代"))
    expect(screen.getByRole("dialog").textContent).toBe("交代")
    rerender(<StandActions id="b" onClose={() => {}} />)
    expect(screen.queryByRole("dialog")).toBeNull()
  })
})
