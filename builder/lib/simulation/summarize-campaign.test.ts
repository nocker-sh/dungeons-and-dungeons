import { expect, test } from "vite-plus/test"
import { buildContent } from "@/builder/lib/build-content"
import { summarizeCampaign } from "@/builder/lib/simulation/summarize-campaign"
import type { CampaignRun } from "@/builder/lib/simulation/campaign"

const built = buildContent([])

/** Controlled measurement records test statistics, not a claimed game playthrough. */
function record(clearedAt: CampaignRun["clearedAt"]): CampaignRun {
  return {
    clearedAt,
    levelAt: clearedAt.map((trip) => (trip === null ? null : 1)),
    companionLevelAt: clearedAt.map((trip) => (trip === null ? null : 1)),
    expeditions: Math.max(
      0,
      ...clearedAt.filter((trip): trip is number => trip !== null)
    ),
    wipes: 0,
    bossWipes: 0,
    finalLevel: 1,
    finalCompanionLevel: 1,
    finalGold: 0,
    appraisals: 0,
    appraiseTrips: 0,
    firstRareAt: null,
    battles: 0,
    battleRounds: 0,
    bossBattles: 0,
    bossRounds: 0,
    repairGold: 0,
    earnedGold: 0,
  }
}

test.each([
  {
    name: "skewed paired trips",
    trips: [
      [1, 2],
      [1, 11],
      [10, 11],
    ],
    expected: 1,
  },
  {
    name: "even number of pairs",
    trips: [
      [1, 2],
      [1, 11],
      [10, 11],
      [10, 12],
    ],
    expected: 1.5,
  },
  {
    name: "only completed pairs",
    trips: [
      [1, null],
      [10, 11],
      [null, null],
    ],
    expected: 1,
  },
  {
    name: "no completed pairs",
    trips: [
      [1, null],
      [null, null],
    ],
    expected: NaN,
  },
  { name: "no runs", trips: [], expected: NaN },
])(
  "$name: summarize each playthrough's elapsed trips before taking the median",
  ({ trips, expected }) => {
    const runs = trips.map(record)
    const before = structuredClone(runs)
    const summary = summarizeCampaign(built, { layers: 2 }, runs)
    expect(summary.layers[1].medianGap).toBe(expected)
    expect(summary.layers[0].medianGap).toBeNaN()
    expect(runs).toEqual(before)
  }
)
