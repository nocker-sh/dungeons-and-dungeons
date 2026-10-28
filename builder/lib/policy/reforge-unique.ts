import type { Session } from "@/builder/lib/session"

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
