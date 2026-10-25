import type { Session } from "../session"

/**
 * ユニークの仲間の固有の武器を鍛え直す。素材は誰も着けていないレア度 N の武器だけにして、
 * 掘り出し物（R・SR）は装備用に残す。払った額を返す。
 */
export function reforgeUnique(session: Session, reserve: number) {
  const { queries } = session
  let spent = 0
  for (let guard = 0; guard < 20; guard++) {
    const target = queries
      .reforges(session.state)
      .find(
        (entry) => entry.ready && entry.gold <= session.state.gold - reserve
      )
    const material = target?.materials.find((entry) => entry.rarity === "N")
    if (!target || !material) break
    const before = session.state.gold
    if (
      !Array.isArray(
        session.send({
          type: "reforge",
          gear: target.gear,
          material: material.gear,
        })
      )
    )
      break
    spent += before - session.state.gold
  }
  return spent
}

/**
 * ガラクタを持っている分だけ鑑定する。武器が出てくる店を選ぶ。
 * 出た武器のレア度（武器でなければ null）を並べて返す。
 */
export function appraiseJunk(session: Session) {
  const { catalog } = session
  const junk = catalog.data.junk
  const shop = catalog.data.shops.find((entry) =>
    entry.appraise?.some((goodId) => catalog.good(goodId)?.kind === "weapon")
  )
  const found: (string | null)[] = []
  if (!shop) return found
  for (const gear of session.state.gear.filter((entry) => entry.unidentified)) {
    const events = session.send({
      type: "appraise",
      shop: shop.id,
      gear: gear.id,
    })
    if (Array.isArray(events))
      for (const event of events)
        if (event.type === "appraised") found.push(event.rarity)
  }
  // 光るガラクタ（必ず R 以上）を先に、次にふつうのガラクタを鑑定する
  for (const [good, rare] of [
    [catalog.data.rareJunk, true],
    [junk, false],
  ] as const) {
    if (!good) continue
    for (let guard = 0; guard < 40; guard++) {
      const have =
        session.state.bag.find((entry) => entry.good === good)?.count ?? 0
      if (!have) break
      const events = session.send(
        rare
          ? { type: "appraise", shop: shop.id, rare }
          : { type: "appraise", shop: shop.id }
      )
      if (!Array.isArray(events)) break
      for (const event of events)
        if (event.type === "appraised") found.push(event.rarity)
    }
  }
  return found
}

type Bonus = Partial<Record<"str" | "tec" | "spd" | "maxHp", number>>

/** 防具の良さの目安。耐久は1点＝HP1点ぶんとして控えめに数える。 */
function worth(bonus: Bonus | undefined, durability = 0) {
  return (
    durability * 0.15 +
    (bonus?.str ?? 0) * 1.2 +
    (bonus?.tec ?? 0) * 1.2 +
    (bonus?.spd ?? 0) * 0.6 +
    (bonus?.maxHp ?? 0) * 0.15
  )
}

/**
 * 持っている武器の個体のうち、その仲間がいちばん強く振れるものを着ける。
 * 比べる攻撃力には強化の段と個体の上振れ（レア度）を含める。
 */
export function equipBestWeapon(session: Session) {
  const { catalog, queries } = session
  for (const member of queries.party(session.state)) {
    // ユニークの仲間は装備を変えられない
    if (member.unique) continue
    const now = queries.member(session.state, member.id)?.weapon?.attack ?? 0
    let best: { gear: string; attack: number } | null = null
    for (const gear of session.state.gear) {
      if (gear.owner) continue
      if (catalog.good(gear.good)?.kind !== "weapon") continue
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
