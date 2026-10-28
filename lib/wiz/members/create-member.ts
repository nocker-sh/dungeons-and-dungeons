import type { MemberDef } from "@/lib/wiz/content/content-schema"
import type { WizDeepReadonly } from "@/lib/wiz/core/immutable-value"
import type { Member } from "@/lib/wiz/state/state-schema"

/** 仲間の定義から、雇ったばかりの状態を作る。 */
export function createMember(def: WizDeepReadonly<MemberDef>): Member {
  return {
    id: def.id,
    lv: def.lv,
    exp: 0,
    hp: def.stats.maxHp,
    stats: { ...def.stats },
    used: [],
    status: [],
    fatigue: 0,
    dirt: 0,
    like: 0,
  }
}
