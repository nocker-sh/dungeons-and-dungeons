import { describe, expect, it, vi } from "vite-plus/test"
import { Session } from "@/builder/lib/session"
import { equipBestWeapon } from "@/builder/lib/policy/equip-best-weapon"
import { aState } from "@/lib/wiz/testing/state-builder"
import { contentId } from "@/lib/wiz/testing/content-id"

function weaponSession(identified: boolean) {
  const session = Session.create()
  const base = aState()
    .withGold(0)
    .withMembers({ hp: 1 })
    .withParty(["alda", "hero", "mort"])
    .withEquipped("alda", "sword")
    .build()
  const sword = base.gear.find(
    (entry) => entry.owner === contentId("alda") && entry.weapon
  )!
  const unknown = {
    ...sword,
    id: "unidentified-strongest",
    owner: null,
    unidentified: true,
    weapon: { ...structuredClone(sword.weapon!), extraPower: 500 },
  }
  const known = {
    ...sword,
    id: "identified-upgrade",
    owner: null,
    weapon: { ...structuredClone(sword.weapon!), extraPower: 80 },
  }
  expect(
    session.game.restore({
      ...session.game.save(),
      snapshot: {
        ...base,
        gear: [...base.gear, unknown, ...(identified ? [known] : [])],
      },
    })
  ).toBeUndefined()
  return { session, unknown, known }
}

describe("自動プレイの武器候補", () => {
  it("未鑑定の強い武器があっても、装備可能な鑑定済みの武器を持たせる", () => {
    const { session, unknown, known } = weaponSession(true)
    const before = session.game.save()
    const candidates = session.queries.equipOptions(
      session.state,
      contentId("alda")
    )
    expect(candidates.some((entry) => entry.gear === unknown.id)).toBe(false)
    expect(candidates.some((entry) => entry.gear === known.id)).toBe(true)
    const forecast = session.queries.weaponFit(
      session.state,
      contentId("alda"),
      known.good,
      known.plus,
      known.weapon.extraPower
    )!.attack
    const send = vi.spyOn(session, "send")
    equipBestWeapon(session)
    expect(
      session.state.gear.find((entry) => entry.id === known.id)?.owner
    ).toBe(contentId("alda"))
    expect(
      session.queries.member(session.state, contentId("alda"))!.weapon!.attack
    ).toBe(forecast)
    expect(session.state.gear.find((entry) => entry.id === unknown.id)).toEqual(
      unknown
    )
    expect(
      send.mock.calls.some(
        ([action]) => action.type === "equip" && action.gear === unknown.id
      )
    ).toBe(false)
    expect(
      send.mock.results.every(
        (result) => result.type === "return" && Array.isArray(result.value)
      )
    ).toBe(true)
    expect(session.state.gold).toBe(before.snapshot.gold)
    expect(session.state.bag).toEqual(before.snapshot.bag)
    expect(session.state.members).toEqual(before.snapshot.members)
    expect(
      session.state.gear.map(({ owner: _owner, ...entry }) => entry)
    ).toEqual(before.snapshot.gear.map(({ owner: _owner, ...entry }) => entry))
    const saved = session.game.save()
    expect(session.game.restore(saved)).toBeUndefined()
    expect(session.game.save()).toEqual(saved)
  })

  it("未鑑定しかないときは操作を送らず、保存を保つ", () => {
    const { session } = weaponSession(false)
    const before = session.game.save()
    const send = vi.spyOn(session, "send")
    equipBestWeapon(session)
    expect(send).not.toHaveBeenCalled()
    expect(session.game.save()).toEqual(before)
  })
})
