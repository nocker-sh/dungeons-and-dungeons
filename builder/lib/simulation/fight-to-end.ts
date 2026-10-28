import { battleAction } from "@/builder/lib/policy/battle"
import type { BattleStyle } from "@/builder/lib/policy/battle"
import { Session } from "@/builder/lib/session"
import type { GameEvent } from "@/lib/wiz/state/game-event"
import type { Tally } from "@/builder/lib/simulation/battle"
import { add } from "@/builder/lib/simulation/add"

export const LIMIT = 2000

/** 戦闘を終わるまで回す。tally を渡すと中身を数える。 */
export function fightToEnd(
  session: Session,
  style: BattleStyle,
  tally?: Tally
) {
  const random = session.random.fork(7)
  let actions = 0
  let rounds = 0
  // 戦闘中にいちばん減ったときの、出撃の3人のHPの合計の割合（ピンチの深さ）
  const ratio = () => {
    const party = session.queries.party(session.state)
    const max = party.reduce((sum, member) => sum + member.maxHp, 0)
    return max ? party.reduce((sum, member) => sum + member.hp, 0) / max : 0
  }
  const start = ratio()
  let lowest = start
  // 敵が落とした武器の個体の数
  let drops = 0
  let won = false
  const record = (events: readonly GameEvent[]) => {
    if (events.some((event) => event.type === "victory")) won = true
    if (!tally) return
    for (const event of events) {
      if (event.type !== "acted") continue
      const actor = event.actor.kind === "member" ? event.actor.id : "敵"
      add(
        tally.uses,
        `${event.actor.kind === "member" ? session.label(event.actor.id) : "敵"}:${event.name}`,
        1
      )
      for (const result of event.results) {
        if (result.damage && result.target.kind === "foe")
          add(tally.damage, actor, result.damage)
        if (result.damage && result.target.kind === "member")
          add(tally.taken, result.target.id, result.damage)
        if (result.heal) add(tally.healing, actor, result.heal)
      }
    }
  }
  for (
    let guard = 0;
    guard < LIMIT && session.state.phase.type === "battle";
    guard++
  ) {
    const view = session.queries.battle(session.state)!
    if (view.current.kind === "member") actions++
    if (view.turn % view.order.length === 0) rounds++
    const action = battleAction(session, style, random, view)
    const result = session.send(action)
    if (session.state.phase.type === "battle")
      lowest = Math.min(lowest, ratio())
    if (Array.isArray(result))
      for (const event of result)
        if (event.type === "victory") drops += event.weapons?.length ?? 0
    if (Array.isArray(result)) record(result)
    else {
      // 方針が選んだ手が拒否されたら防御で進める
      const fallback = session.send({ type: "act", command: "guard" })
      if (!Array.isArray(fallback))
        throw new Error(`戦闘が進まない: ${JSON.stringify(action)}`)
      record(fallback)
    }
  }
  if (session.state.phase.type === "battle")
    throw new Error(`戦闘が${LIMIT}手で決着せず、測定は未完了です`)
  if (won) lowest = Math.min(lowest, ratio())
  return { won, actions, rounds, start, lowest, drops }
}
