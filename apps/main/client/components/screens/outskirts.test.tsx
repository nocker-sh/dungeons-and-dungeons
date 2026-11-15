// @vitest-environment jsdom
import { forwardRef, useImperativeHandle } from "react"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vite-plus/test"
import { GameCommandError } from "@/lib/wiz/game/game-command-error"
import { Outskirts } from "@/client/components/screens/outskirts"
import { lines } from "@/content/looks/data"

const go = vi.fn()
const shake = vi.fn()
const town = { depart: vi.fn() }
let readiness: Record<string, unknown>
const queries = {
  destinations: () => [
    {
      id: "layer0",
      no: 0,
      name: "0層",
      state: "",
      open: true,
      armorFinds: [],
      weaponFinds: [],
    },
  ],
  gear: () => [],
  party: () => [],
  defaultDestination: () => "layer0",
  prologue: () => null,
  readiness: () => readiness,
}

vi.mock("@/client/contexts/use-game", () => ({
  useGame: () => ({ queries, state: {} }),
}))
vi.mock("@/client/contexts/use-game-state", () => ({ useGameState: () => ({}) }))
vi.mock("@/client/components/game/use-arrival", () => ({ useArrival: () => true }))
vi.mock("@/client/components/game/use-nav", () => ({ useNav: () => ({ go }) }))
vi.mock("@/client/components/game/use-visit-scene", () => ({ useVisitScene: () => {} }))
vi.mock("@/client/components/stage/use-stage", () => ({
  useStage: () => ({ art: () => {}, bars: () => {} }),
}))
vi.mock("@/client/components/stage/use-fx", () => ({
  useFx: () => ({ shake, flash: async () => {} }),
}))
vi.mock("@/client/components/stage/use-wide", () => ({ useWide: () => false }))
vi.mock("@/client/components/game/formation/context", () => ({
  useFormation: () => ({ lift: () => {} }),
}))
vi.mock("@/client/components/game/supplies", () => ({ Supplies: () => null }))
vi.mock("@/client/components/stage/stage-chrome", () => ({ StageChrome: () => null }))
vi.mock("@/client/components/stage/revolver", () => ({ Revolver: () => null }))
vi.mock("@/client/components/stage/word", () => ({
  Word: (props: { text: string; onClick: () => void }) => (
    <button onClick={props.onClick}>{props.text}</button>
  ),
}))
vi.mock("@/client/components/stage/guide", () => ({
  Guide: forwardRef((props: { say?: string | null }, ref) => {
    useImperativeHandle(ref, () => ({ pop: () => {}, bubble: null }))
    return <div data-testid="say">{props.say}</div>
  }),
}))
vi.mock("@/client/components/canvas/play", () => ({ play: async () => {} }))
vi.mock("@/lib/wiz/phases/in-phase", () => ({ inPhase: () => town }))

const ready = {
  ready: true,
  unregistered: false,
  wipePending: false,
  short: 0,
  down: [],
  tired: [],
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("Outskirts", () => {
  it.each([
    [{ unregistered: true }, lines.guide.unregistered],
    [{ wipePending: true }, lines.guide.wipe],
  ])("出撃できない理由 %o を、名前のない「くたくた」にしない", (reason, line) => {
    readiness = { ...ready, ...reason, ready: false }
    render(<Outskirts />)
    fireEvent.click(screen.getByText("カチコミ"))
    expect(screen.getByTestId("say").textContent).toBe(line)
    expect(shake).toHaveBeenCalled()
    expect(town.depart).not.toHaveBeenCalled()
  })

  it("出撃をエンジンが断ったら遷移せず、理由を見せる", async () => {
    readiness = ready
    town.depart.mockReturnValue(new GameCommandError("UNREGISTERED"))
    render(<Outskirts />)
    fireEvent.click(screen.getByText("カチコミ"))
    await vi.waitFor(() =>
      expect(screen.getByTestId("say").textContent).toBe(
        lines.guide.unregistered
      )
    )
    expect(go).not.toHaveBeenCalled()
    expect(shake).toHaveBeenCalled()
  })

  it("出撃が通れば遷移する", async () => {
    readiness = ready
    town.depart.mockReturnValue({ events: [], next: {} })
    render(<Outskirts />)
    fireEvent.click(screen.getByText("カチコミ"))
    await vi.waitFor(() => expect(go).toHaveBeenCalled())
  })
})
