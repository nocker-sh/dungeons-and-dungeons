import { describe, expect, it } from "vite-plus/test"
import { getWizRuntimeContentEntry } from "@/lib/wiz/core/runtime/content-view"

describe("getWizRuntimeContentEntry", () => {
  it("own propertyだけをcontent IDとして解決する", () => {
    const entry = Object.freeze({ id: "potion", value: 1 })
    const entries = Object.freeze({ potion: entry })

    expect(getWizRuntimeContentEntry(entries, "potion")).toBe(entry)
    expect(getWizRuntimeContentEntry(entries, "toString")).toBeUndefined()
  })
})
