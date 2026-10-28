import { buildContent } from "@/builder/lib/build-content"
import { townDay } from "@/builder/lib/policy/town"
import { Session } from "@/builder/lib/session"
import { partyLevels } from "@/builder/lib/party-levels"
import { runExpedition } from "@/builder/lib/simulation/expedition"
import type {
  CampaignOptions,
  CampaignRun,
} from "@/builder/lib/simulation/campaign"

/** 一周の run 回目（種は seed + run）。回ごとに独立しているので、別のスレッドでも同じ結果になる。 */
export function campaignRun(
  built: ReturnType<typeof buildContent>,
  options: CampaignOptions,
  run: number
): CampaignRun {
  const layerCount = Math.min(options.layers, built.content.layers.length)
  {
    const session = new Session(built, options.seed + run)
    const record: CampaignRun = {
      clearedAt: Array(layerCount).fill(null),
      levelAt: Array(layerCount).fill(null),
      companionLevelAt: Array(layerCount).fill(null),
      expeditions: 0,
      wipes: 0,
      bossWipes: 0,
      finalLevel: 0,
      finalCompanionLevel: 0,
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
    // 再挑戦の間隔は全員平均が1上がるまで待つ。育成レポートの集計対象とは分ける。
    const retryLevel = () => partyLevels(session).all
    let lostAt = -Infinity
    for (let trip = 1; trip <= options.expeditions; trip++) {
      const day = townDay(session, {
        potions: options.potions,
        upgrade: true,
        summon: true,
        shop: options.shop,
      })
      record.appraisals += day.appraised.length
      if (day.appraised.length) record.appraiseTrips++
      if (
        record.firstRareAt === null &&
        day.appraised.some((rarity) => rarity === "R" || rarity === "SR")
      )
        record.firstRareAt = trip
      record.repairGold += day.repairGold
      const index = built.content.layers.findIndex(
        (entry) => entry.id === day.layer
      )
      if (index >= layerCount) break
      const ready = session.queries.readiness(session.state)
      if (!ready.ready) continue
      const plan = {
        ...options.plan,
        avoidBoss: options.plan.push ? false : retryLevel() < lostAt + 1,
      }
      const result = runExpedition(session, day.layer, plan, options.style)
      record.expeditions = trip
      record.earnedGold += Math.max(0, result.gold)
      record.battles += result.battles - (result.bossReached ? 1 : 0)
      record.battleRounds += result.battleRounds
      if (result.bossReached) record.bossBattles++
      record.bossRounds += result.bossRounds
      if (result.outcome === "wiped") record.wipes++
      if (result.outcome === "wiped" && result.bossReached) record.bossWipes++
      if (result.bossReached && !result.bossWon) lostAt = retryLevel()
      if (result.outcome === "cleared" && record.clearedAt[index] === null) {
        record.clearedAt[index] = trip
        const levels = partyLevels(session)
        record.levelAt[index] = levels.all
        record.companionLevelAt[index] = levels.companions
        if (index + 1 >= layerCount) break
      }
    }
    const levels = partyLevels(session)
    record.finalLevel = levels.all
    record.finalCompanionLevel = levels.companions
    record.finalGold = session.state.gold
    return record
  }
}
