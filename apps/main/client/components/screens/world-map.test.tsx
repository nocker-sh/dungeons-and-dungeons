// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vite-plus/test"
import { GameCommandError } from "@/lib/wiz/game/game-command-error"
import { WorldMap } from "@/client/components/screens/world-map"

const go = vi.fn()
const town = { depart: vi.fn(), travelWorld: vi.fn(), visitWorld: vi.fn() }
let map: Record<string, unknown>

vi.mock("@/client/contexts/use-game", () => ({
  useGame: () => ({
    queries: { worldMap: () => map, destinations: () => [] },
  }),
}))
vi.mock("@/client/contexts/use-game-state", () => ({ useGameState: () => ({}) }))
vi.mock("@/client/components/game/use-arrival", () => ({ useArrival: () => true }))
vi.mock("@/client/components/game/use-nav", () => ({ useNav: () => ({ go }) }))
vi.mock("@/client/components/game/use-visit-scene", () => ({ useVisitScene: () => {} }))
vi.mock("@/content/looks/scene-of", () => ({ sceneOf: () => "town" }))
vi.mock("@/lib/wiz/phases/in-phase", () => ({ inPhase: () => town }))

function setup(ready: boolean) {
  const tile = {
    id: "gate",
    name: "門",
    x: 0,
    y: 0,
    biome: "road",
    visible: true,
    current: true,
    canMove: false,
    canTravel: false,
    collected: true,
    place: "",
  }
  map = {
    ready,
    width: 1,
    height: 1,
    start: "town",
    tiles: [tile],
    current: { id: "gate", name: "門", dungeon: "layer-1" },
    requests: [],
  }
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("WorldMap", () => {
  it("準備中だけ出発を止め、拒否されたら理由を知らせて遷移しない", () => {
    setup(false)
    const { unmount } = render(<WorldMap />)
    expect(
      (screen.getByText("ダンジョンへ") as HTMLButtonElement).disabled
    ).toBe(true)
    unmount()
    setup(true)
    town.depart.mockReturnValue(new GameCommandError("party-not-ready" as never))
    render(<WorldMap />)
    const depart = screen.getByText("ダンジョンへ") as HTMLButtonElement
    expect(depart.disabled).toBe(false)
    fireEvent.click(depart)
    expect(screen.getByRole("status").textContent).toBe(
      "宿で回復し、三人の準備を整えよう。"
    )
    expect(go).not.toHaveBeenCalled()
  })

  it("街へ戻れなければ知らせて留まる", () => {
    setup(true)
    town.travelWorld.mockReturnValue(new GameCommandError("x" as never))
    render(<WorldMap />)
    fireEvent.click(screen.getByText("街へ戻る"))
    expect(screen.getByRole("status").textContent).toBe(
      "街へ戻れない。いまは移動できない。"
    )
    expect(go).not.toHaveBeenCalled()
  })
})
