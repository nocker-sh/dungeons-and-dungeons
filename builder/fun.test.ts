import { describe, expect, it } from "vite-plus/test"
import {
  funMetrics,
  roadMetricsByLayer,
  withinGoal,
  type Playthrough,
  type Trip,
} from "./lib/fun"
import type { ExpeditionResult } from "./lib/simulate"

const fight = (patch: Partial<ExpeditionResult["fights"][number]> = {}) => ({
  boss: false,
  actions: 8,
  rounds: 2,
  start: 1,
  lowest: 0.8,
  won: true,
  ...patch,
})

function trip(
  no: number,
  patch: Partial<Trip> = {},
  result: Partial<ExpeditionResult> = {}
): Trip {
  return {
    no,
    layer: "layer0",
    layerName: "0層",
    appraised: [],
    attackBefore: 10,
    attackAfter: 10,
    levelBefore: no,
    firstClear: null,
    ...patch,
    result: {
      outcome: "retreated",
      stations: 8,
      battles: 1,
      battleRounds: 2,
      bossRounds: 0,
      fights: [fight()],
      drops: 0,
      choices: 3,
      bossReached: false,
      bossWon: false,
      gold: 0,
      exp: 0,
      junk: 0,
      rareJunk: 0,
      stones: 0,
      ...result,
    },
  }
}

describe("面白さの数字（fun）", () => {
  it("出撃の記録から、テンポ・当たり・成長・緊張・判断を数える", () => {
    const run: Playthrough = {
      trips: [
        trip(
          1,
          { attackAfter: 20 },
          { outcome: "wiped", fights: [fight({ lowest: 0, won: false })] }
        ),
        trip(
          2,
          { appraised: ["R", "N", "SR"] },
          {
            drops: 1,
            fights: [
              fight({ lowest: 0.4 }),
              fight({ boss: true, rounds: 9, lowest: 0.95 }),
            ],
          }
        ),
        trip(3, {}, { outcome: "cleared" }),
      ],
      endingAt: 3,
    }
    const metrics = funMetrics([run])
    expect(metrics.actionsPerFight).toBe(8)
    expect(metrics.bossRounds).toBe(9)
    expect(metrics.strongerTrips).toBeCloseTo(1 / 3)
    expect(metrics.hitsPerTrip).toBe(1)
    // 4戦のうち、半分を切ってから勝ったのは1戦
    expect(metrics.pinchFights).toBe(0.25)
    // 被害がほとんどないのは、ボス戦（0.95）だけ
    expect(metrics.easyFights).toBe(0.25)
    expect(metrics.wipeTrips).toBeCloseTo(1 / 3)
    expect(metrics.levelGainPerTrip).toBe(1)
    expect(metrics.choicesPerTrip).toBe(3)
    expect(metrics.earlyWipes).toBe(1)
    expect(metrics.endingTrips).toBe(3)
  })

  it("層別の道中手数は全戦闘で集計し、ボスと未測定を区別する", () => {
    const runs: Playthrough[] = [
      {
        endingAt: null,
        trips: [
          trip(
            1,
            {},
            {
              fights: [
                fight({ actions: 40, midboss: true }),
                fight({ boss: true, actions: 999 }),
              ],
            }
          ),
          trip(
            2,
            {},
            {
              fights: [
                fight({ actions: 4 }),
                fight({ actions: 4 }),
                fight({ actions: 4 }),
              ],
            }
          ),
          trip(3, { layer: "layer1", layerName: "1層" }, { fights: [] }),
        ],
      },
    ]
    const roads = roadMetricsByLayer(runs)
    expect(roads[0]).toMatchObject({
      layer: "layer0",
      trips: 2,
      fights: 4,
      normalFights: 3,
      normalActionsPerFight: 4,
      midbossFights: 1,
      midbossActionsPerFight: 40,
      actionsPerFight: 13,
      medianActions: 4,
      maxActions: 40,
      easyFights: 0,
    })
    expect(roads[1]).toMatchObject({
      layer: "layer1",
      fights: 0,
      actionsPerFight: null,
      medianActions: null,
      maxActions: null,
      easyFights: null,
    })
    expect(runs[0].trips[0].result.fights[1].actions).toBe(999)
  })

  it("目安は片側だけの範囲も判定し、測れなかった値は外れにする", () => {
    expect(withinGoal("actionsPerFight", 12)).toBe(true)
    expect(withinGoal("actionsPerFight", 12.1)).toBe(false)
    expect(withinGoal("hitsPerTrip", 0.4)).toBe(false)
    expect(withinGoal("endingTrips", Number.NaN)).toBe(false)
  })
})
