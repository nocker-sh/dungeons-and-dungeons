// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vite-plus/test"
import { GameCommandError } from "@/lib/wiz/game/game-command-error"
import { BranchChoices } from "@/client/components/screens/expedition/branch-choices"
import type { RouteView } from "@/client/components/screens/expedition/types"

const expedition = { survey: vi.fn() }
vi.mock("@/client/contexts/use-game", () => ({ useGame: () => ({}) }))
vi.mock("@/lib/wiz/phases/in-phase", () => ({ inPhase: () => expedition }))

const path = (id: string, surveyReason: string | null) => ({
  id,
  label: id,
  surveyed: false,
  canSurvey: surveyReason === null,
  surveyReason,
  hint: "",
  danger: "不明" as const,
  details: [],
})

function show(pick: string, paths: ReturnType<typeof path>[]) {
  const route = { paths, surveyLeft: 1 } as unknown as RouteView
  return render(
    <BranchChoices
      route={route}
      pick={pick}
      setPick={() => {}}
      wide={false}
      selectedPath={route.paths.find((entry) => entry.id === pick)!}
      selectedPathDetails={{ current: null }}
      branchDetailsHeight={null}
      top={null}
    />
  )
}

Element.prototype.scrollTo = () => {}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("BranchChoices", () => {
  it("選んだ道を察知できないときは、エンジンの理由を見せる", () => {
    show("a", [path("a", "この道は正体が分かっている"), path("b", null)])
    expect(screen.getByRole("status").textContent).toContain(
      "この道は正体が分かっている"
    )
  })

  it("察知を断られたら理由を見せる", () => {
    expedition.survey.mockReturnValue(new GameCommandError("UNAVAILABLE"))
    show("b", [path("b", null)])
    expect(screen.queryByRole("status")).toBeNull()
    fireEvent.click(screen.getByText(/察知で正体を見抜く/))
    expect(screen.getByRole("status").textContent).toContain(
      "今は察知できない"
    )
  })
})
