import type { Session } from "@/builder/lib/session"

/**
 * 持っている武器の個体のうち、その仲間がいちばん強く振れるものを着ける。
 * 比べる攻撃力には強化の段と個体の上振れ（レア度）を含める。
 */
export function equipBestWeapon(session: Session) {
  const { queries } = session
  for (const member of queries.party(session.state)) {
    // ユニークの仲間は装備を変えられない
    if (member.unique) continue
    const now = queries.member(session.state, member.id)?.weapon?.attack ?? 0
    const candidates = new Set(
      queries
        .equipOptions(session.state, member.id)
        .filter((entry) => entry.kind === "weapon" && !entry.ownerId)
        .map((entry) => entry.gear)
    )
    let best: { gear: string; attack: number } | null = null
    for (const gear of session.state.gear) {
      if (!candidates.has(gear.id)) continue
      const fit = queries.weaponFit(
        session.state,
        member.id,
        gear.good,
        gear.plus,
        gear.weapon?.extraPower ?? 0
      )
      if (!fit || fit.attack <= now) continue
      if (best && best.attack >= fit.attack) continue
      best = { gear: gear.id, attack: fit.attack }
    }
    if (best)
      session.send({ type: "equip", gear: best.gear, member: member.id })
  }
}
