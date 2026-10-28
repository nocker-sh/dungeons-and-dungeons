import { healItemFor } from "@/builder/lib/policy/heal-item-for"
import { Session } from "@/builder/lib/session"

/**
 * 回復薬を持たせてから測る。お膳立てなので代金は数えない（levelTo と同じ作り）。
 * 深く潜るほど消耗するので、薬がないと「進むほど得か」を測れない。
 */
export function stockPotions(session: Session, want: number) {
  const potion = healItemFor(session)
  const shop = session.catalog.data.shops.find((entry) =>
    potion ? entry.goods.includes(potion.id) : false
  )
  if (!potion || !shop) return
  const gold = session.state.gold
  session.patch((state) => {
    state.gold = 1_000_000
  })
  for (let guard = 0; guard < want; guard++)
    session.send({ type: "buy", shop: shop.id, good: potion.id })
  session.patch((state) => {
    state.gold = gold
  })
}
