// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vite-plus/test"
import { GameCommandError } from "@/lib/wiz/game/game-command-error"
import { Inscription } from "@/client/components/game/inscription"

const shake = vi.fn()
const town = { inscribe: vi.fn() }
const skill = (slot: number, name: string) => ({
  slot,
  name,
  uses: 3,
  desc: "",
  reach: null,
})
const smithy = {
  books: 1,
  inscriptions: [
    {
      gear: "sword",
      name: "剣",
      owner: null,
      rarity: "N",
      skills: [skill(0, "固有"), skill(1, "斬る")],
      candidates: [{ id: "thrust", name: "突く", uses: 2, desc: "", reach: null }],
    },
  ],
}

vi.mock("@/client/contexts/use-game", () => ({
  useGame: () => ({ queries: { inscriptions: () => smithy } }),
}))
vi.mock("@/client/contexts/use-game-state", () => ({ useGameState: () => ({}) }))
vi.mock("@/client/components/stage/use-fx", () => ({ useFx: () => ({ shake }) }))
vi.mock("@/lib/wiz/phases/in-phase", () => ({ inPhase: () => town }))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("Inscription", () => {
  it("付け替えを断られたら、知らせて画面を揺らす", () => {
    town.inscribe.mockReturnValue(new GameCommandError("ALREADY"))
    render(<Inscription onClose={() => {}} />)
    fireEvent.click(screen.getByText(/枠2：斬る/))
    fireEvent.click(screen.getByText(/突く/))
    expect(screen.getByRole("status").textContent).toBe(
      "その武器はもうそのワザを覚えています。"
    )
    expect(shake).toHaveBeenCalledWith(0.6)
    expect(screen.getByText(/突く/)).toBeTruthy()
  })
})
