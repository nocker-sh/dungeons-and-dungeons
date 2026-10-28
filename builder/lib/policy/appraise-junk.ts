import type { Session } from "@/builder/lib/session"

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
