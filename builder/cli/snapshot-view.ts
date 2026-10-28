import { Session } from "@/builder/lib/session"

/** --json で出す、いまの画面の材料（エンジンの Query の結果そのもの）。 */
export function snapshotView(session: Session) {
  const { state, queries } = session
  const battle = queries.battle(state)
  return {
    phase: state.phase.type,
    gold: state.gold,
    party: queries.party(state),
    route: queries.route(state),
    battle,
    commands:
      battle?.current.kind === "member"
        ? queries.commands(state, battle.current.id)
        : null,
    result: queries.result(state),
  }
}
