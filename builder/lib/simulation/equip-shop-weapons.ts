import { buyGear } from "@/builder/lib/policy/buy-gear"
import { equipBestWeapon } from "@/builder/lib/policy/equip-best-weapon"
import { Session } from "@/builder/lib/session"

/**
 * 店の品ぞろえから、その仲間がいちばん強く振れる武器を着ける。
 * 育ち方を測るためのお膳立てなので、代金は数えない（levelTo と同じ作り）。
 */
export function equipShopWeapons(session: Session) {
  const gold = session.state.gold
  session.patch((state) => {
    state.gold = 1_000_000
  })
  buyGear(session, 0, "weapon")
  equipBestWeapon(session)
  session.patch((state) => {
    state.gold = gold
  })
}
