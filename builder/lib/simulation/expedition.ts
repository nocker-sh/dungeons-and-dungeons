import { expeditionAction } from "@/builder/lib/policy/expedition"
import type { ExpeditionPlan } from "@/builder/lib/policy/expedition"
import type { BattleStyle } from "@/builder/lib/policy/battle"
import { Session } from "@/builder/lib/session"
import { LIMIT, fightToEnd } from "@/builder/lib/simulation/fight-to-end"

export type ExpeditionResult = {
  outcome: "cleared" | "retreated" | "wiped"
  stations: number
  battles: number
  /** 道中の戦闘（ボス以外）のラウンドの合計と、ボス戦のラウンド。 */
  battleRounds: number
  bossRounds: number
  /** 戦闘ごとの記録（自分の手数・ラウンド・始めと一番減ったときのHPの割合・勝ったか）。 */
  fights: {
    boss: boolean
    station?: string
    midboss?: boolean
    foes?: { id: string; name: string }[]
    actions: number
    rounds: number
    start: number
    lowest: number
    won: boolean
  }[]
  /** 敵が落とした武器の個体の数。 */
  drops: number
  /** 分かれ目で行き先を選んだ回数。 */
  choices: number
  bossReached: boolean
  bossWon: boolean
  gold: number
  exp: number
  /** 持ち帰ったガラクタの数（武器集めの素）。 */
  junk: number
  /** 持ち帰った光るガラクタの数（必ず R 以上の武器になる）。 */
  rareJunk: number
  /** 手に入れた召喚石。 */
  stones: number
}

/** 出撃から街へ戻るまで。 */
export function runExpedition(
  session: Session,
  layer: string,
  plan: ExpeditionPlan,
  style: BattleStyle
): ExpeditionResult {
  const random = session.random.fork(11)
  const goldBefore = session.state.gold
  const junkId = session.catalog.data.junk
  const junkOf = () =>
    session.state.bag
      .filter((entry) => entry.good === junkId)
      .reduce((sum, entry) => sum + entry.count, 0)
  const junkBefore = junkOf()
  const rareId = session.catalog.data.rareJunk
  const rareOf = () =>
    session.state.bag
      .filter((entry) => entry.good === rareId)
      .reduce((sum, entry) => sum + entry.count, 0)
  const rareBefore = rareOf()
  const stonesBefore = session.state.stones
  const expBefore = session.state.members.reduce(
    (sum, member) => sum + member.exp,
    0
  )
  session.must({ type: "depart", layer })
  const result: ExpeditionResult = {
    outcome: "retreated",
    stations: 0,
    battles: 0,
    battleRounds: 0,
    bossRounds: 0,
    fights: [],
    drops: 0,
    choices: 0,
    bossReached: false,
    bossWon: false,
    gold: 0,
    exp: 0,
    junk: 0,
    rareJunk: 0,
    stones: 0,
  }
  for (let guard = 0; guard < LIMIT; guard++) {
    const phase = session.state.phase
    if (phase.type === "town") break
    if (phase.type === "battle") {
      result.battles++
      const boss = phase.battle.boss
      if (boss) result.bossReached = true
      const station = session.definition.catalog.station(
        phase.expedition.layer,
        phase.expedition.at
      )
      const foes = session.queries.battle(session.state)!.foes.map((foe) => ({
        id: foe.foe,
        name: foe.name,
      }))
      const fight = fightToEnd(session, style)
      if (boss) result.bossRounds = fight.rounds
      else result.battleRounds += fight.rounds
      result.drops += fight.drops
      result.fights.push({
        boss,
        station: phase.expedition.at,
        midboss: station?.event === "midboss",
        foes,
        actions: fight.actions,
        rounds: fight.rounds,
        start: fight.start,
        lowest: fight.lowest,
        won: fight.won,
      })
      if (!fight.won) {
        result.outcome = "wiped"
        break
      }
      if (boss) result.bossWon = true
      continue
    }
    const route = session.queries.route(session.state)
    const action = expeditionAction(session, plan, random, route)
    if (action.type === "advance") {
      result.stations++
      if ((route?.choices.length ?? 0) > 1) result.choices++
    }
    session.must(action)
  }
  if (session.state.phase.type !== "town")
    throw new Error(`探索が${LIMIT}手で帰還せず、測定は未完了です`)
  if (result.bossWon) result.outcome = "cleared"
  result.gold = session.state.gold - goldBefore
  result.junk = junkOf() - junkBefore
  result.rareJunk = rareOf() - rareBefore
  result.stones = session.state.stones - stonesBefore
  result.exp =
    session.state.members.reduce((sum, member) => sum + member.exp, 0) -
    expBefore
  return result
}
