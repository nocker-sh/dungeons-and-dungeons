import { describe, expect, it } from "vite-plus/test"
import { WizImmutableValue } from "@/lib/wiz/core/immutable-value"
import { MOCK_VAULT } from "@/lib/wiz/core/mocks/mock-vault"
import { WorldSnapshot } from "@/lib/wiz/core/save/world-snapshot"
import { WizWorld } from "@/lib/wiz/core/world/world"

describe("WorldSnapshot world state", () => {
  it("immutable value contract付きclass stateとして既定ownerで使える", () => {
    const snapshot = WorldSnapshot.fromVault(MOCK_VAULT)
    const world = WizWorld.create(snapshot)

    expect(WizImmutableValue.is(snapshot)).toBe(true)
    expect(world.initialState).toBe(snapshot)
    expect(Object.isFrozen(world.initialState)).toBe(true)
    expect(world.initialState.player).toEqual(snapshot.player)
  })
})
