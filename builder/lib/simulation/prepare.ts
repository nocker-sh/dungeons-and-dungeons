import { startParty } from "@/builder/lib/policy/start-party"
import { Session } from "@/builder/lib/session"
import { equipShopWeapons } from "@/builder/lib/simulation/equip-shop-weapons"
import { stockPotions } from "@/builder/lib/simulation/stock-potions"

export type Setup = {
  level?: number
  /** 店で買える一番強く振れる武器に持ち替えてから始める。防具は初期のまま。 */
  weapons?: boolean
  /** 到達した層の深さ。深い層でしか並ばない武器・防具を買えるようになる。 */
  reached?: number
  /** 回復薬をこの数だけ持って始める（深さごとの稼ぎを測るため）。 */
  potions?: number
}

export function prepare(session: Session, setup: Setup) {
  // 出撃には3人と悪魔が要る。足りなければ募集で雇い、召喚して合体してから測る
  startParty(session)
  const reached = setup.reached
  if (reached !== undefined)
    session.patch((state) => {
      state.reached = reached
    })
  if (setup.level) session.levelTo(setup.level)
  if (setup.weapons) equipShopWeapons(session)
  if (setup.potions) stockPotions(session, setup.potions)
}
