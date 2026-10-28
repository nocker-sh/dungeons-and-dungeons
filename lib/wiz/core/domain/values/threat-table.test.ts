import { describe, expect, it } from "vite-plus/test"
import { WizThreatTable } from "@/lib/wiz/core/domain/values/threat-table"

describe("WizThreatTable", () => {
  it("脅威を不変に加算し、同値ならactor idで標的を決める", () => {
    const empty = WizThreatTable.create<"p1" | "p2">()
    const first = empty.add("p2", 4)
    const tied = first.add("p1", 4)
    const highest = tied.add("p2", 1)

    expect(empty.entries).toEqual([])
    expect(tied.toPlain()).toEqual({
      entries: [
        { actorId: "p1", threat: 4 },
        { actorId: "p2", threat: 4 },
      ],
    })
    expect(tied.highest()).toEqual({ actorId: "p1", threat: 4 })
    expect(highest.highest()).toEqual({ actorId: "p2", threat: 5 })
    expect(highest.add("p2", 0)).toBe(highest)
  })

  it("生存候補だけから標的を選び、離脱者を除く", () => {
    const table = WizThreatTable.create<string>({
      entries: [
        { actorId: "p1", threat: 8 },
        { actorId: "p2", threat: 5 },
        { actorId: "p3", threat: 3 },
      ],
    })

    expect(table.highest(["p2", "p3"])).toEqual({ actorId: "p2", threat: 5 })
    expect(table.highest([])).toBeNull()
    expect(table.retain(["p2", "p3"]).toPlain()).toEqual({
      entries: [
        { actorId: "p2", threat: 5 },
        { actorId: "p3", threat: 3 },
      ],
    })
    expect(table.remove("p1").threatOf("p1")).toBe(0)
    expect(table.remove("missing")).toBe(table)
    expect(table.retain(["p1", "p2", "p3"])).toBe(table)
  })

  it("外部stateを所有し、plain stateも不変にする", () => {
    const input = { entries: [{ actorId: "p1", threat: 2 }] }
    const table = WizThreatTable.fromUnknown(input)
    input.entries[0] = { actorId: "changed", threat: 99 }

    expect(table.toPlain()).toEqual({ entries: [{ actorId: "p1", threat: 2 }] })
    expect(Object.isFrozen(table)).toBe(true)
    expect(Object.isFrozen(table.toPlain())).toBe(true)
    expect(Object.isFrozen(table.entries)).toBe(true)
    expect(Object.isFrozen(table.entries[0])).toBe(true)
  })

  it.each([
    {},
    { entries: null },
    { entries: [{ actorId: "", threat: 1 }] },
    { entries: [{ actorId: "p1", threat: 0 }] },
    { entries: [{ actorId: "p1", threat: 1.5 }] },
    {
      entries: [
        { actorId: "p1", threat: 1 },
        { actorId: "p1", threat: 2 },
      ],
    },
  ])("不正なstateを拒否する", (state) => {
    expect(() => WizThreatTable.fromUnknown(state)).toThrow()
  })

  it("不正な加算とsafe integer超過を拒否する", () => {
    const table = WizThreatTable.create({
      entries: [{ actorId: "p1", threat: Number.MAX_SAFE_INTEGER }],
    })

    expect(() => table.add("p1", -1)).toThrow(TypeError)
    expect(() => table.add("p1", 0.5)).toThrow(TypeError)
    expect(() => table.add("p1", 1)).toThrow(TypeError)
    expect(() => WizThreatTable.require({ entries: [] })).toThrow(TypeError)
  })
})
