import type { Session } from "@/builder/lib/session"

/** 今送れる操作の例（短い書き方）。 */
export function hints(session: Session): string[] {
  const { state, queries } = session
  if (state.phase.type === "battle") {
    const battle = queries.battle(state)!
    if (battle.current.kind === "foe") return ["foe"]
    const commands = queries.commands(state, battle.current.id)
    return [
      "skill <slug> [foe-N|仲間slug]",
      ...(commands?.brawl ? ["brawl [foe-N]"] : []),
      "item <slug> [対象]",
      "guard",
      "auto",
      "auto-battle",
    ]
  }
  if (state.phase.type === "expedition") {
    const route = queries.route(state)!
    const expedition = queries.expedition(state)!
    if (route.discovery)
      return route.discovery.choices.flatMap((choice) =>
        choice.blessings
          ? choice.blessings.map(
              (skill) =>
                `discover ${choice.id} ${session.slug(skill.id)} <仲間slug>`
            )
          : [`discover ${choice.id}`]
      )
    if (expedition.pending) return ["ack"]
    return [
      ...route.choices.map((id) => `advance ${id}`),
      "retreat",
      "use <slug> [仲間slug]",
      "auto",
      "auto-run",
    ]
  }
  const layers = session.catalog.data.layers
    .slice(0, state.reached + 1)
    .map((layer) => `depart ${session.slug(layer.id)}`)
  return [
    ...layers,
    "rest <room>",
    "buy <shop> <good>",
    "sell <good>",
    "appraise <shop>",
    "recruit <slug>",
    "reroll",
    "summon",
    "demon <slug>",
    "equip <gearId> <仲間>",
    "upgrade <gearId>",
    "repair [仲間]",
    "craft <recipe>",
    "quest <slug>",
    "fight-quest <slug>",
    "claim <slug>",
    "swap <出> <入>",
    "rows <a> <b>",
    "use <slug> [仲間]",
    "auto-day",
  ]
}
