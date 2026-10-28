/** 仲間ひとりの強さの目安。募集の枠と出撃中の仲間を同じ尺度で比べる。 */
export function strength(member: {
  maxHp: number
  str: number
  tec: number
  spd: number
  lv: number
}) {
  return (
    member.maxHp * 0.15 +
    member.str +
    member.tec +
    member.spd * 0.5 +
    member.lv * 2
  )
}
