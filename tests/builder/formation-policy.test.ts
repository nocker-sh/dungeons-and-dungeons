import { describe, expect, it } from "vite-plus/test"
import { Session } from "@/builder/lib/session"
import { protectFragileFront } from "@/builder/lib/policy/formation"

describe("耐久差が大きい前衛を守る自動編成", () => {
  it("序盤の配置は保ち、育成後に脆い前衛を後ろへ回して資産を保つ", () => {
    const session = Session.create()
    const initial = session.game.save()
    protectFragileFront(session)
    expect(session.game.save()).toEqual(initial)
    session.levelTo(15)
    const before = session.game.save()
    const hero = session.queries
      .party(session.state)
      .find((member) => member.hero)!
    expect(hero.row).toBe("front")
    const back = session.queries
      .party(session.state)
      .find((member) => member.row === "back")!
    protectFragileFront(session)
    expect(
      session.queries.party(session.state).find((member) => member.hero)!.row
    ).toBe("back")
    expect(session.game.save()).toEqual({
      ...before,
      snapshot: {
        ...before.snapshot,
        party: before.snapshot.party.map((id) =>
          id === hero.id ? back.id : id === back.id ? hero.id : id
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
