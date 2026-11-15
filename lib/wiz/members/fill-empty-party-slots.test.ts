import { describe, expect, it } from "vite-plus/test"
import { PARTY_SLOTS } from "@/lib/wiz/content/constants"
import { aState } from "@/lib/wiz/testing/state-builder"
import { realContent } from "@/lib/wiz/testing/real-content"
import { catalogOf } from "@/lib/wiz/testing/catalog-of"
import { fillEmptyPartySlots } from "@/lib/wiz/members/fill-empty-party-slots"

const catalog = catalogOf(realContent())

describe("fillEmptyPartySlots", () => {
  it("満員の隊列は変えない", () => {
    const state = aState().build()
    expect(state.party).toHaveLength(PARTY_SLOTS)
    expect(fillEmptyPartySlots(state, catalog)).toBe(state)
  })

  it("初期の仲間を先に、生きている控えだけで埋める", () => {
    const base = aState().build()
    const starter = (catalog.data.startingCompanions ?? []).find((id) =>
      base.members.some((member) => member.id === id)
    )!
    const others = base.party.filter((id) => id !== starter)
    const dead = others[0]
    const state = {
      ...base,
      members: base.members.map((member) =>
        member.id === dead ? { ...member, hp: 0 } : member
      ),
      party: others.slice(1),
    }
    const filled = fillEmptyPartySlots(state, catalog)
    expect(filled.party).toEqual([...others.slice(1), starter])
    expect(filled.party).not.toContain(dead)
  })
})
