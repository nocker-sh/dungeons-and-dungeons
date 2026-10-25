import { buildContent } from "./lib/content"
import { Session } from "./lib/session"
import { DEFAULT_PLAN, PUSH_PLAN, townDay } from "./lib/policy"
import { runExpedition } from "./lib/simulate"

const runs = Number(process.argv[2] ?? 5)
if (!Number.isInteger(runs) || runs < 1) throw new Error("試行数は正の整数")
const built = buildContent([])
const preparation = { potions: 3, upgrade: true, summon: true, shop: true }
for (let seed = 1; seed <= runs; seed++) {
  const session = new Session(built, seed)
  let lostAt = -Infinity
  let trips = 0
  const averageLevel = () => {
    const party = session.queries.party(session.state)
    return party.reduce((sum, member) => sum + member.lv, 0) / party.length
  }
  for (trips = 1; trips <= 60 && !session.state.cleared; trips++) {
    const day = townDay(session, preparation)
    if (!session.queries.readiness(session.state).ready) continue
    const result = runExpedition(
      session,
      day.layer,
      {
        ...DEFAULT_PLAN,
        avoidBoss: averageLevel() < lostAt + 1,
      },
      "smart"
    )
    if (result.bossReached && !result.bossWon) lostAt = averageLevel()
  }
  if (!session.state.cleared) {
    console.log(JSON.stringify({ seed, cleared: false, trips: 60 }))
    continue
  }
  townDay(session, preparation)
  const resume = session.dump()
  for (const layer of built.content.layers) {
    const rematch = new Session(built, seed, resume)
    const quest = built.content.quests.find(
      (entry) => entry.requiresCleared && entry.foe === layer.boss
    )!
    const level = rematch.queries
      .party(rematch.state)
      .map((member) => member.lv)
    const result = runExpedition(rematch, layer.id, PUSH_PLAN, "smart")
    const progress = rematch.queries
      .quests(rematch.state)
      .find((entry) => entry.id === quest.id)!
    const aliveAfterReturn = rematch.queries
      .party(rematch.state)
      .filter((member) => member.hp > 0).length
    console.log(
      JSON.stringify({
        seed,
        trips: trips - 1,
        layer: layer.no,
        level,
        outcome: result.outcome,
        bossWon: result.bossWon,
        aliveAfterReturn,
        status: progress.status,
        bossRounds: result.bossRounds,
        stations: result.stations,
      })
    )
    if (layer.no === built.content.layers.length - 1) {
      for (let attempt = 2; attempt <= 8; attempt++) {
        if (
          rematch.queries
            .quests(rematch.state)
            .find((entry) => entry.id === quest.id)?.status === "ready"
        )
          break
        townDay(rematch, preparation)
        const levels = rematch.queries
          .party(rematch.state)
          .map((member) => member.lv)
        const retry = runExpedition(rematch, layer.id, DEFAULT_PLAN, "smart")
        const status = rematch.queries
          .quests(rematch.state)
          .find((entry) => entry.id === quest.id)!.status
        console.log(
          JSON.stringify({
            seed,
            layer: layer.no,
            attempt,
            level: levels,
            outcome: retry.outcome,
            bossWon: retry.bossWon,
            status,
            bossRounds: retry.bossRounds,
            stations: retry.stations,
          })
        )
      }
    }
  }
}
