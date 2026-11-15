import { describe, expect, it } from "vite-plus/test"
import { Session } from "@/builder/lib/session"
import { protectFragileFront } from "@/builder/lib/policy/formation"

describe("耐久差が大きい前衛を守る自動編成", () => {
  it("序盤の配置は保ち、後衛の半分未満の耐久しかない前衛を後ろへ回して資産を保つ", () => {
    const session = Session.create()
    const initial = session.game.save()
    protectFragileFront(session)
    expect(session.game.save()).toEqual(initial)
    session.levelTo(15)
    // 前衛の1人だけ最大HPが伸びなかった（後衛の半分未満）
    const fragileId = session.state.party[1]
    session.patch((state) => {
      const member = state.members.find((entry) => entry.id === fragileId)!
      member.stats.maxHp = 100
      member.hp = 100
    })
    const before = session.game.save()
    const fragile = session.queries
      .party(session.state)
      .find((member) => member.id === fragileId)!
    expect(fragile.row).toBe("front")
    const back = session.queries
      .party(session.state)
      .find((member) => member.row === "back")!
    expect(fragile.maxHp + (fragile.armor?.maxDurability ?? 0)).toBeLessThan(
      (back.maxHp + (back.armor?.maxDurability ?? 0)) / 2
    )
    protectFragileFront(session)
    expect(
      session.queries
        .party(session.state)
        .find((member) => member.id === fragileId)!.row
    ).toBe("back")
    expect(session.game.save()).toEqual({
      ...before,
      snapshot: {
        ...before.snapshot,
        party: before.snapshot.party.map((id) =>
          id === fragileId ? back.id : id === back.id ? fragileId : id
        ),
      },
    })
    const after = session.game.save()
    expect(session.game.restore(after)).toBeUndefined()
    protectFragileFront(session)
    expect(session.game.save()).toEqual(after)
  })

  it("探索中は並びを変えない", () => {
    const session = Session.create()
    session.levelTo(15)
    session.must({ type: "depart", layer: session.catalog.data.layers[0].id })
    const before = session.game.save()
    protectFragileFront(session)
    expect(session.game.save()).toEqual(before)
  })

  it("一時的な負傷では配置を変えない", () => {
    const session = Session.create()
    session.patch((state) => {
      state.members.find((member) => member.id === state.party[0])!.hp = 1
    })
    const before = session.game.save()
    protectFragileFront(session)
    expect(session.game.save()).toEqual(before)
  })
})
