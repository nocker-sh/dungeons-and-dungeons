import { describe, expect, it } from "vitest"
import { nightTalks } from "./looks"
import { portraitStates } from "@/lib/concept/portrait-types"

describe("夜の雑談の表情", () => {
  it("名前の置換で台詞と返答の表情が失われない", () => {
    const talks = nightTalks()
    expect(talks.length).toBeGreaterThan(0)
    const expressions = portraitStates.map(({ value }) => value)
    for (const talk of talks) {
      for (const [, text, expression] of talk.lines) {
        expect(text).not.toMatch(/\{[\w-]+\}/)
        expect(expressions).toContain(expression)
      }
      for (const [label, , reply, expression] of talk.choice.options) {
        expect(label).not.toMatch(/\{[\w-]+\}/)
        expect(reply).not.toMatch(/\{[\w-]+\}/)
        expect(expressions).toContain(expression)
      }
    }
    expect(talks[0].choice.options[1][3]).toBe("shy")
  })
})
