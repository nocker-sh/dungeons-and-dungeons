import type { Session } from "@/builder/lib/session"
import { worth } from "@/builder/lib/policy/worth"

/** 店で買う前に、手元の防具から同じ部位のより良い物を着ける。 */
export function equipBestArmor(session: Session) {
  const { catalog, queries } = session
  const valueOf = (gear: Session["state"]["gear"][number]) => {
    const good = catalog.good(gear.good)!
    return worth(
      Object.fromEntries(
        Object.entries(good.bonus ?? {}).map(([key, value]) => [
          key,
          value > 0 ? value + gear.plus : value,
        ])
      ),
      (good.durability ?? 0) +
        gear.plus * catalog.data.balance.armor.durabilityPerPlus
    )
  }
  for (const member of queries.party(session.state)) {
    // 固定装備の仲間は防具も変えられない（専用の武器を持つ R は着替えられる）
    if (member.fixedArmor) continue
    const options = queries.equipOptions(session.state, member.id)
    const slots = new Set(
      options
        .filter((entry) => entry.kind === "armor")
        .map((entry) => entry.slot)
    )
    // その仲間の装備だけを見る（全ての個体の表示を作ると、拾った武器が増えるほど重くなる）
    const owned = new Set(
      session.state.gear
        .filter((entry) => entry.owner === member.id)
        .map((entry) => entry.id)
    )
    for (const slot of slots) {
      const current = queries
        .gear(session.state, owned)
        .find((entry) => entry.ownerId === member.id && entry.slot === slot)
      const worn = current
        ? session.state.gear.find((entry) => entry.id === current.gear)
        : undefined
      let bestValue = worn ? valueOf(worn) : 0
      let best: string | null = null
      for (const option of options) {
        if (option.kind !== "armor" || option.slot !== slot || option.ownerId)
          continue
        const gear = session.state.gear.find(
          (entry) => entry.id === option.gear
        )!
        const value = valueOf(gear)
        if (value <= bestValue + 0.5) continue
        bestValue = value
        best = gear.id
      }
      if (best) session.must({ type: "equip", gear: best, member: member.id })
    }
  }
}
