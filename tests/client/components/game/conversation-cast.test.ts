import { describe, expect, it } from "vite-plus/test"
import conversations from "@/content/data/conversations.json"
import { STAGE_SLOTS } from "@/client/components/game/conversation-cast"
import { castLines } from "@/client/components/game/cast-lines"
import { openingCast } from "@/client/components/game/opening-cast"

describe("会話の立ち絵は同時に2人まで", () => {
  it("3人目が話すときは、直前に話していない方と入れ替わる", () => {
    const first = openingCast(["a", "b", "c"], ["a", "b", "c", "a"])
    expect(first).toEqual(["a", "b"])
    const { lines, end } = castLines(first, ["a", "b", "c", "a", "c"])
    expect(lines.map((line) => line.cast)).toEqual([
      ["a", "b"],
      ["a", "b"],
      ["c", "b"],
      ["c", "a"],
      ["c", "a"],
    ])
    expect(lines.map((line) => line.slot)).toEqual([0, 1, 0, 1, 0])
    expect(end).toEqual(["c", "a"])
  })

  it("作品のすべての台本で、舞台に立つのは2人までで、話し手は必ず舞台にいる", () => {
    for (const script of conversations) {
      const speakers = (lines: readonly { speaker: string }[]) =>
        lines.map((line) => line.speaker)
      const first = openingCast(script.participants, [
        ...speakers(script.lines),
        ...(script.choice?.options.flatMap((option) =>
          speakers(option.lines)
        ) ?? []),
      ])
      expect(first.length, script.id).toBeLessThanOrEqual(STAGE_SLOTS)
      const main = castLines(first, speakers(script.lines))
      const replies =
        script.choice?.options.map((option) =>
          castLines(main.end, speakers(option.lines))
        ) ?? []
      const all = [
        { lines: script.lines, cast: main.lines },
        ...(script.choice?.options.map((option, index) => ({
          lines: option.lines,
          cast: replies[index].lines,
        })) ?? []),
      ]
      for (const { lines, cast } of all)
        for (const [index, line] of lines.entries()) {
          expect(cast[index].cast.length, script.id).toBeLessThanOrEqual(
            STAGE_SLOTS
          )
          expect(cast[index].cast[cast[index].slot], script.id).toBe(
            line.speaker
          )
        }
    }
  })
})
