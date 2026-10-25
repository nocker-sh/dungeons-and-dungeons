import { describe, expect, it } from "vite-plus/test"
import { wizContext } from "@/lib/wiz/core/context"
import { MOCK_INITIAL_STATE, MOCK_VAULT } from "@/lib/wiz/core/mocks/mock-vault"

describe("WizContext", () => {
  it("initialWorldState を正規名として保持する", () => {
    const world = wizContext({
      initialVault: MOCK_VAULT,
      initialWorldState: MOCK_INITIAL_STATE,
    })

    expect(world.initialWorldState).toBe(MOCK_INITIAL_STATE)
    expect(Object.isFrozen(world)).toBe(true)
  })
})
