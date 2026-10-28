import { buildContent } from "@/builder/lib/build-content"
import { Session } from "@/builder/lib/session"
import { startParty } from "@/builder/lib/policy/start-party"
import { buyGear } from "@/builder/lib/policy/buy-gear"
import { fightToEnd } from "@/builder/lib/simulation/fight-to-end"
import { newTally } from "@/builder/lib/simulation/new-tally"

/** 単発依頼の実際の開始・戦闘・自動精算を測る。敵や報酬を変更しない。 */
const built = buildContent()
const runs = Number(process.argv[2] ?? 20)
if (!Number.isInteger(runs) || runs < 1) throw new Error("試行数は正の整数")
const reference = new Session(built, 1)
for (const quest of reference.catalog.data.quests.filter(
  (entry) => entry.encounter
)) {
  const outcomes = []
  for (let seed = 1; seed <= runs; seed++) {
    const session = new Session(built, seed)
    startParty(session)
    const reached = quest.encounter!.reached
    const level = [3, 7, 11][reached]
    session.patch((state) => {
      state.reached = reached
      state.gold = 1000
    })
    session.levelTo(level)
    buyGear(session, 0)
    const before = {
      gold: session.state.gold,
      reached: session.state.reached,
      lastLayer: session.state.lastLayer,
    }
    session.must({ type: "fight-quest", quest: quest.id })
    const result = fightToEnd(session, "smart", newTally())
    if (
      session.state.phase.type !== "town" ||
      session.state.reached !== before.reached ||
      session.state.lastLayer !== before.lastLayer
    )
      throw new Error("単発戦闘が街へ戻らない、または探索の進行を変えた")
    const claimed = session.state.quests.find(
      (entry) => entry.id === quest.id
    )?.claimed
    if (claimed !== result.won) throw new Error("勝敗と依頼の精算が一致しない")
    outcomes.push({
      seed,
      won: result.won,
      rounds: result.rounds,
      gold: session.state.gold - before.gold,
    })
  }
  console.log(
    JSON.stringify({
      quest: quest.id,
      name: quest.name,
      place: quest.encounter!.place,
      reached: quest.encounter!.reached,
      runs,
      wins: outcomes.filter((entry) => entry.won).length,
      outcomes,
    })
  )
}
