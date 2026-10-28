import { describe, expect, it } from "vite-plus/test"
import { sequentialIds } from "@/lib/wiz/testing/sequential-ids"

describe("連番のID（sequentialIds）", () => {
  it("1から順に増える", () => {
    const ids = sequentialIds()
    expect([ids(), ids(), ids()]).toEqual(["id-1", "id-2", "id-3"])
  })

  it("先頭の言葉を変えられ、別の器は別に数える", () => {
    const first = sequentialIds("gear")
    const second = sequentialIds("gear")
    expect(first()).toBe("gear-1")
    expect(second()).toBe("gear-1")
    expect(first()).toBe("gear-2")
  })
})
