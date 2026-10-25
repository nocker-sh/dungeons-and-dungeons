import { type GameCatalog, type GrowthType } from "@/lib/wiz/content"
import type { Member } from "@/lib/wiz/state"
import type { Random } from "@/lib/wiz/rules/random"

/** 仲間の経験値と成長曲線。数値はCatalogから取得する。 */
export class PartyGrowth {
  constructor(private readonly catalog: GameCatalog) {}

  /**
   * 次のレベルまでの経験値 = expBase × レベル^expPower。
   * expPower が1より大きいほど上のレベルが遠くなり、1レベルの重みが増える。
   */
  expToNext(lv: number) {
    const { expBase, expPower } = this.catalog.data.balance
    return Math.max(1, Math.round(expBase * lv ** expPower))
  }

  /** この仲間の成長の型。 */
  growthTypeOf(member: Pick<Member, "id">): GrowthType {
    return this.catalog.member(member.id)?.growthType ?? "normal"
  }

  /** そのレベルから次のレベルへ上がるときの段（序盤・中盤・終盤）。 */
  bandOf(lv: number): "early" | "middle" | "late" {
    const [early, middle] = this.catalog.data.balance.growthCurve.bands
    if (lv < early) return "early"
    if (lv < middle) return "middle"
    return "late"
  }

  /** 成長の型と段で決まる、伸びの倍率。 */
  growthFactor(member: Pick<Member, "id">, lv: number) {
    const curve = this.catalog.data.balance.growthCurve
    return curve.types[this.growthTypeOf(member)][this.bandOf(lv)]
  }

  /** この仲間の1レベルあたりの伸び（型の倍率をかける前）。 */
  growthOf(member: Pick<Member, "id">) {
    return (
      this.catalog.member(member.id)?.growth ?? this.catalog.data.balance.growth
    )
  }

  /**
   * 加入時のレベルから lv に届くまでに積み上がる伸びの合計（型の倍率つき）。
   * 端数を切り捨てた差で1レベル分の伸びを出すので、段ごとの倍率がそのまま合計に効く。
   */
  #accumulated(member: Pick<Member, "id">, lv: number, from: number) {
    const growth = this.growthOf(member)
    let maxHp = 0
    let str = 0
    let tec = 0
    for (let level = from; level < lv; level++) {
      const factor = this.growthFactor(member, level)
      maxHp += growth.maxHp * factor
      str += growth.str * factor
      tec += growth.tec * factor
    }
    return { maxHp, str, tec }
  }

  /** レベルが lv から lv+1 へ上がるときに伸びる量。spd は伸びる確率。 */
  growthGain(member: Pick<Member, "id">, lv: number) {
    const from = this.catalog.member(member.id)?.lv ?? 1
    const now = this.#accumulated(member, lv, from)
    const next = this.#accumulated(member, lv + 1, from)
    return {
      maxHp: Math.floor(next.maxHp) - Math.floor(now.maxHp),
      str: Math.floor(next.str) - Math.floor(now.str),
      tec: Math.floor(next.tec) - Math.floor(now.tec),
      spd: Math.min(
        1,
        this.growthOf(member).spd * this.growthFactor(member, lv)
      ),
    }
  }

  /** 経験値の分だけレベルを上げる。宿で呼ぶ。 */
  grow(member: Member, random: Random): Member {
    if (this.catalog.member(member.id)?.hero) return member
    let next: Member = member
    while (next.exp >= this.expToNext(next.lv)) {
      const exp = next.exp - this.expToNext(next.lv)
      const gain = this.growthGain(member, next.lv)
      const stats = {
        maxHp: next.stats.maxHp + gain.maxHp,
        str: next.stats.str + gain.str,
        tec: next.stats.tec + gain.tec,
        spd: next.stats.spd + (random() < gain.spd ? 1 : 0),
      }
      next = { ...next, lv: next.lv + 1, exp, stats }
    }
    return next
  }
}
