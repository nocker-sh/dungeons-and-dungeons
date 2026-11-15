import { describe, expect, it } from "vite-plus/test"
import { buildContent } from "@/builder/lib/build-content"
import { partyLevels } from "@/builder/lib/party-levels"
import { DEFAULT_PLAN } from "@/builder/lib/policy/expedition"
import { Session } from "@/builder/lib/session"
import { campaignRun } from "@/builder/lib/simulation/campaign-run"
import { summarizeCampaign } from "@/builder/lib/simulation/summarize-campaign"
import type { CampaignOptions } from "@/builder/lib/simulation/campaign"
import { playthrough } from "@/builder/lib/playthrough"

const options: CampaignOptions = {
  overrides: [],
  runs: 1,
  seed: 1,
  style: "smart",
  plan: DEFAULT_PLAN,
  expeditions: 0,
  layers: 2,
  potions: 4,
  shop: true,
}

describe("育成対象の平均レベル", () => {
  it("出撃中の仲間Lv23・25・27を、全員平均・仲間平均とも25にし、控えを数えない", () => {
    const session = Session.create()
    session.patch((state) => {
      let level = 23
      for (const member of state.members)
        if (state.party.includes(member.id)) {
          member.lv = level
          level += 2
        }
      state.members.push({
        ...state.members[1],
        id: session.id("sera", "recruits"),
        lv: 99,
        stats: { ...state.members[1].stats },
        used: [],
        status: [],
      })
    })
    const before = session.dump()
    expect(partyLevels(session)).toEqual({ all: 25, companions: 25 })
    expect(session.dump()).toEqual(before)
  })

  it("仲間が一人ずつ1レベル育ったとき、全員と仲間の平均がともに1上がる", () => {
    const session = Session.create()
    session.levelTo(10)
    const before = partyLevels(session)
    session.levelTo(11)
    const after = partyLevels(session)
    expect(after.companions - before.companions).toBe(1)
    expect(after.all - before.all).toBe(1)
  })

  it("実際の一周記録でも全員と仲間の平均を両方残す", () => {
    const built = buildContent([])
    const run = campaignRun(built, options, 0)
    expect(run.finalLevel).toBe(3)
    expect(run.finalCompanionLevel).toBe(3)
    const summary = summarizeCampaign(built, options, [
      {
        ...run,
        clearedAt: [4, 12],
        levelAt: [5, 49 / 3],
        companionLevelAt: [7, 24],
        finalLevel: 49 / 3,
        finalCompanionLevel: 24,
      },
      {
        ...run,
        clearedAt: [6, null],
        levelAt: [7, null],
        companionLevelAt: [10, null],
      },
    ])
    expect(summary.layers[0]).toMatchObject({ level: 6, companionLevel: 8.5 })
    expect(summary.layers[1]).toMatchObject({
      level: 49 / 3,
      companionLevel: 24,
    })
    expect(summary.finalCompanionLevel).toBe(13.5)
    expect(summary.finalLevel).toBeCloseTo((49 / 3 + 3) / 2)
  })

  it("funの実プレイ記録も、出撃中の育成対象を測る", () => {
    const run = playthrough({
      overrides: [],
      seed: 1,
      trips: 1,
      style: "smart",
    })
    expect(run.trips).toHaveLength(1)
    expect(run.trips[0].levelBefore).toBe(3)
    expect(run.trips[0].companionLevelBefore).toBe(3)
  })
})
