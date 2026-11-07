import { expect, test } from "vite-plus/test"
import { funMetrics } from "@/builder/lib/fun-metrics"
import { playthrough } from "@/builder/lib/playthrough"
import type { Playthrough } from "@/builder/lib/fun"

// Controlled summary records test statistics without pretending to play the game.
test.each([
  { endings: [2, 9], expected: 5.5 },
  { endings: [2, 9, 5, 8], expected: 6.5 },
  { endings: [4, 4], expected: 4 },
  { endings: [2, 9, 5], expected: 5 },
  { endings: [null, 2, null, 9], expected: 5.5 },
  { endings: [null, null], expected: NaN },
  { endings: [], expected: NaN },
])(
  "completed trips $endings have median $expected",
  ({ endings, expected }) => {
    const records: Playthrough[] = endings.map((endingAt) => ({
      endingAt,
      trips: [],
    }))
    const before = structuredClone(records)
    expect(funMetrics(records).endingTrips).toBe(expected)
    expect(records).toEqual(before)
  }
)

const campaignInvariant =
  process.env.BUILDER_CAMPAIGN === "1" ? test : test.skip

campaignInvariant(
  "ending-trip median matches real playthroughs with canonical data",
  () => {
    const records = Array.from({ length: 8 }, (_, index) =>
      playthrough({
        overrides: [],
        seed: index + 1,
        trips: 60,
        style: "smart",
      })
    )
    const endings = records
      .flatMap((entry) => (entry.endingAt === null ? [] : [entry.endingAt]))
      .sort((left, right) => left - right)
    expect(endings.length).toBeGreaterThan(0)
    const middle = Math.floor(endings.length / 2)
    const expected =
      endings.length % 2
        ? endings[middle]
        : (endings[middle - 1] + endings[middle]) / 2
    expect(funMetrics(records).endingTrips).toBe(expected)
  },
  900_000
)
