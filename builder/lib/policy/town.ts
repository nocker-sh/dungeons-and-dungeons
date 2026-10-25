import type { Session } from "../session"
import { fillParty, hireRecruits, chooseFirstPartner } from "./party"
import { healItemFor } from "./healing"
import {
  buyGear,
  equipBestArmor,
  equipBestWeapon,
  reforgeUnique,
  appraiseJunk,
} from "./equipment"

/** 街での一日の結果。出撃する層と、その日の鑑定・修理・買い物。 */
export type TownDayResult = {
  layer: string
  /** 鑑定で出た武器のレア度（武器でなければ null）。 */
  appraised: (string | null)[]
  /** 防具の修理に払った額。 */
  repairGold: number
  /** 買い物と強化に払った額。 */
  spentGold: number
}

type UpgradeEntry = NonNullable<
  ReturnType<Session["queries"]["smithy"]>
>["upgrades"][number]

/**
 * 素材だけが足りない強化のうち、足りない素材がすべて店で買えて、
 * 代金と強化の費用を払っても reserve が残るものを1つ選び、素材を買いそろえる。
 */
function buyUpgradeMaterials(
  session: Session,
  upgrades: readonly UpgradeEntry[],
  reserve: number
): UpgradeEntry | null {
  const { catalog } = session
  const shopOf = (good: string) =>
    catalog.data.shops.find((shop) => shop.goods.includes(good))
  // 次の買い替えに備えて、いま買える一番高い武器・防具の代金は残す（強化は余ったお金で）
  const saving = Math.max(
    0,
    ...catalog.data.shops
      .flatMap((shop) => shop.goods)
      .map((id) => catalog.good(id))
      .filter(
        (good) =>
          good &&
          (good.kind === "weapon" || good.kind === "armor") &&
          (good.unlock ?? 0) <= session.state.reached
      )
      .map((good) => good?.price ?? 0)
  )
  for (const entry of upgrades) {
    if (!entry.ownerId || entry.max || !entry.missingMaterials) continue
    const lacking = entry.materials.filter((item) => item.have < item.count)
    if (lacking.some((item) => !shopOf(item.good))) continue
    const materialGold = lacking.reduce(
      (sum, item) =>
        sum +
        (catalog.good(item.good)?.price ?? Infinity) * (item.count - item.have),
      0
    )
    if (
      session.state.gold - materialGold - (entry.gold ?? 0) <
      reserve + saving
    )
      continue
    for (const item of lacking)
      for (let count = item.have; count < item.count; count++)
        session.send({
          type: "buy",
          shop: shopOf(item.good)!.id,
          good: item.good,
        })
    return entry
  }
  return null
}

/** 街での一日：依頼、宿、鑑定、買い物、修理、強化。 */
export function townDay(
  session: Session,
  options: {
    potions: number
    upgrade: boolean
    summon: boolean
    shop?: boolean
  }
): TownDayResult {
  const { queries } = session
  const state = () => session.state
  const appraised: (string | null)[] = []
  let repairGold = 0
  let spentGold = 0
  // 全滅の結果と踏破の場面は、街に着いたら閉じる（画面でいう板を消す）
  if (state().wipe) session.send({ type: "dismiss-wipe" })
  if (state().cleared && !state().endingSeen)
    session.send({ type: "see-ending" })
  if (options.summon) {
    // ガチャは廃止。石を消費するループは作らない。
    chooseFirstPartner(session)
  }
  for (const quest of queries
    .quests(state())
    .filter((quest) => !quest.encounter)) {
    if (quest.status === "ready")
      session.send({ type: "claim-quest", quest: quest.id })
    if (quest.status === "open")
      session.send({ type: "accept-quest", quest: quest.id })
  }
  // 宿：レベルが上がる一番安い部屋。払えなければ一番安い部屋
  const rooms = [...queries.rooms(state())].sort((a, b) => a.price - b.price)
  const room =
    rooms.find((entry) => entry.levelUp && entry.affordable) ??
    rooms.find((entry) => entry.affordable)
  if (room) session.send({ type: "rest", room: room.id })
  const reserve = (rooms.find((entry) => entry.levelUp)?.price ?? 0) * 2
  // まず出撃の3人をそろえる（始めたては主人公ひとり）
  spentGold += fillParty(session, 0)
  // 求人で強い仲間を入れる（0層は最初の3人のまま）
  spentGold += hireRecruits(session, reserve)
  // 回復薬を持っておく
  const potion = healItemFor(session)
  const shop = session.catalog.data.shops.find(
    (entry) => potion && entry.goods.includes(potion.id)
  )
  if (potion && shop) {
    const before = state().gold
    // 深い層ではHPの総量が増えるので、パーティのHPの6割ぶんを持って行く
    const heal = potion.effect?.type === "heal" ? potion.effect.hp : 0
    const pool = queries
      .party(state())
      .reduce((sum, member) => sum + member.maxHp, 0)
    const want =
      state().reached >= 1 && heal
        ? Math.min(
            24,
            Math.max(options.potions, Math.ceil((pool * 0.6) / heal))
          )
        : options.potions
    for (let guard = 0; guard < 30; guard++) {
      const have =
        state().bag.find((entry) => entry.good === potion.id)?.count ?? 0
      if (have >= want) break
      if (state().gold - (potion.price ?? 0) < reserve) break
      if (
        !Array.isArray(
          session.send({ type: "buy", shop: shop.id, good: potion.id })
        )
      )
        break
    }
    spentGold += before - state().gold
  }
  // 出撃前に持ち出し枠を組み直す。倉庫の在庫すべては持ち込めない。
  for (const item of queries.supplies(state()).items)
    session.send({ type: "pack", good: item.id, count: 0 })
  if (potion) {
    const available = queries
      .supplies(state())
      .items.find((item) => item.id === potion.id)
    if (available)
      session.send({
        type: "pack",
        good: potion.id,
        count: Math.min(8, available.total),
      })
  }
  // 拾ったガラクタを鑑定する（武器が出る店で。武器集めが強くなる道筋）
  appraised.push(...appraiseJunk(session))
  // 拾った武器（鑑定の個体）を含めて、いちばん強く振れる武器を着ける
  equipBestWeapon(session)
  equipBestArmor(session)
  // 装備を買い替える：部位ごとに今より良い物があり、払えれば買って着ける
  if (options.shop) {
    const before = state().gold
    buyGear(session, reserve)
    spentGold += before - state().gold
  }
  // 防具の耐久を直す（払える分から、減りが大きい仲間の順に）
  for (let guard = 0; guard < 8; guard++) {
    const rows = queries
      .repairs(state())
      .rows.filter((row) => row.inParty && row.wear > 0)
      .sort((a, b) => b.wear - a.wear)
    const next = rows.find((row) => row.gold <= state().gold - reserve)
    if (!next) break
    const before = state().gold
    if (!Array.isArray(session.send({ type: "repair", member: next.member })))
      break
    repairGold += before - state().gold
  }
  // 着けている装備を強化する
  if (options.upgrade)
    for (let guard = 0; guard < 20; guard++) {
      const smithy = queries.smithy(state())
      const next =
        smithy?.upgrades.find(
          (entry) =>
            entry.ownerId &&
            entry.ready &&
            (entry.gold ?? 0) <= state().gold - reserve
        ) ?? buyUpgradeMaterials(session, smithy?.upgrades ?? [], reserve)
      if (!next) break
      const before = state().gold
      session.send({ type: "upgrade", gear: next.gear })
      spentGold += before - state().gold
    }
  // ユニークの仲間の固有の武器を、余った N の武器を素材にして鍛え直す
  spentGold += reforgeUnique(session, reserve)
  return {
    layer:
      session.catalog.data.layers[
        Math.min(state().reached, session.catalog.data.layers.length - 1)
      ].id,
    appraised,
    repairGold,
    spentGold,
  }
}
