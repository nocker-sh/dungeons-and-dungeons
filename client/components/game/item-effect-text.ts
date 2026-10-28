import type { GameQueries } from "@/lib/wiz/queries/game-queries"

type Item = ReturnType<GameQueries["items"]>[number]

/** 数値と対象はQueryに任せ、バッグと相手選択に同じ効果を伝える。 */
export function itemEffectDetails(item: Item) {
  if (item.healing)
    return item.healing.map((member) => {
      const description = `${item.revive ? "蘇生後の" : ""}HP（生命力） ${member.hp}/${member.maxHp} → ${member.after}/${member.maxHp}（+${member.restored}）`
      return {
        member: member.id,
        name: member.name,
        summary: description,
        description,
      }
    })
  const refill = item.refill
  if (refill)
    return refill.members.map((member) => ({
      member: member.id,
      name: member.name,
      summary: `合計${member.restored}回戻る`,
      description: `各ワザの残りを${refill.perSkill}回ずつ戻す。合計${member.restored}回戻る。`,
    }))
  return (
    item.curing?.map((member) => {
      const description = `${member.names.join("・")}を治す`
      return {
        member: member.id,
        name: member.name,
        summary: description,
        description,
      }
    }) ?? []
  )
}
