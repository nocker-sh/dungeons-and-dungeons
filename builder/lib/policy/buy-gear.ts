import type { Session } from "@/builder/lib/session"
import { worth } from "@/builder/lib/policy/worth"

/**
 * 並びの順に、今より良い装備を買って着ける。
 * 武器はその仲間が持ったときの攻撃力（必要な能力・得意・個体の上振れを含む）で比べる。
 * only を渡すと武器だけ・防具だけにする。
 */
export function buyGear(
  session: Session,
  reserve: number,
  only?: "weapon" | "armor"
) {
  const { catalog, queries } = session
  const slotOf = (good: { kind: string; slot?: string }) =>
    good.slot ?? good.kind
  for (const member of queries.party(session.state)) {
    // 固定装備の仲間は装備を変えられないので買わない。専用の武器を持つ R は防具だけ買う
    if (member.fixedArmor) continue
    for (const shop of catalog.data.shops) {
      for (const goodId of shop.goods) {
        const good = catalog.good(goodId)
        if (!good || (good.kind !== "weapon" && good.kind !== "armor")) continue
        if (member.unique && good.kind === "weapon") continue
        if (!catalog.canEquip(member.id, good.id)) continue
        if (only && good.kind !== only) continue
        // 深い層で並ぶ品物は、その層まで届いてから買える
        if ((good.unlock ?? 0) > session.state.reached) continue
        const slot = slotOf(good)
        const worn = session.state.gear.find(
          (gear) =>
            gear.owner === member.id &&
            slotOf(catalog.good(gear.good) ?? { kind: "" }) === slot
        )
        if (good.kind === "weapon") {
          // 素の武器より弱い物は買わない
          const now =
            queries.member(session.state, member.id)?.weapon?.attack ?? 0
          const next =
            queries.weaponFit(session.state, member.id, good.id)?.attack ?? 0
          if (next <= now) continue
        } else {
          // 強化1段ごとに上がる能力（正の補正）と最大の耐久が増える
          const wornGood = worn ? catalog.good(worn.good) : undefined
          const perPlus = catalog.data.balance.armor.durabilityPerPlus
          const current =
            worn && wornGood
              ? worth(
                  Object.fromEntries(
                    Object.entries(wornGood.bonus ?? {}).map(([key, value]) => [
                      key,
                      value > 0 ? value + worn.plus : value,
                    ])
                  ),
                  (wornGood.durability ?? 0) + worn.plus * perPlus
                )
              : 0
          if (worth(good.bonus, good.durability) <= current + 0.5) continue
        }
        if (session.state.gold - (good.price ?? 0) < reserve) continue
        const before = new Set(session.state.gear.map((gear) => gear.id))
        if (
          !Array.isArray(
            session.send({ type: "buy", shop: shop.id, good: good.id })
          )
        )
          continue
        const bought = session.state.gear.find((gear) => !before.has(gear.id))
        if (bought)
          session.send({ type: "equip", gear: bought.id, member: member.id })
      }
    }
  }
}
