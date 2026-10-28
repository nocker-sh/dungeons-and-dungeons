import {
  FIXED_WEAPON_SKILLS,
  WEAPON_SKILLS,
  growthTypes,
  rarities,
  weaponTypes,
} from "@/lib/wiz/content/constants"
import { slotOf } from "@/lib/wiz/content/slot-of"
import type { ContentVerification } from "@/lib/wiz/content/content-verification/context"

export function verifyEquipment({ catalog, need }: ContentVerification) {
  const data = catalog.data
  const members = [...data.party, ...data.recruits.map((entry) => entry.member)]

  for (const good of data.goods) {
    if (good.allowedJobs) {
      need(good.kind === "armor", `${good.id} の職業制限は防具にだけ付ける`)
      need(
        new Set(good.allowedJobs).size === good.allowedJobs.length,
        `${good.id} の装備職業が重複している`
      )
      for (const job of good.allowedJobs)
        need(
          members.some((member) => member.job === job),
          `${good.id} の装備職業 ${job} が存在しない`
        )
    }
    if (good.appraiseFrom !== undefined)
      need(
        data.layers.some((layer) => layer.no === good.appraiseFrom),
        `品物 ${good.id} の鑑定の到達層 ${good.appraiseFrom} がない`
      )
    if (good.kind !== "armor")
      need(
        good.durability === undefined,
        `${good.id} は防具ではないので耐久は持てない`
      )
    if (good.kind === "armor") {
      need(good.durability, `防具 ${good.id} に耐久（durability）がない`)
      // 防具は一人一つ。部位を分けない（暫定）
      need(
        slotOf(good) === "armor",
        `防具 ${good.id} の部位は armor だけにする`
      )
    }
    if (good.kind !== "weapon") {
      need(
        good.weaponType === undefined && good.skills === undefined,
        `${good.id} は武器ではないので武器種とワザは持てない`
      )
      continue
    }
    need(good.weaponType, `武器 ${good.id} に武器種（weaponType）がない`)
    need(good.power, `武器 ${good.id} に攻撃力（power）がない`)
    need(good.need, `武器 ${good.id} に必要な筋力・技量（need）がない`)
    need(
      good.skills?.length === WEAPON_SKILLS,
      `武器 ${good.id} のワザはちょうど${WEAPON_SKILLS}つにする`
    )
    // 同じワザが二つ並ぶと、残りの使用回数を分け合う指示が二つ出てしまう
    need(
      new Set(good.skills ?? []).size === (good.skills?.length ?? 0),
      `武器 ${good.id} のワザが重複している`
    )
    for (const skill of good.skills ?? []) {
      need(catalog.skill(skill), `武器 ${good.id} のワザ ${skill} がない`)
      need(
        !catalog.skill(skill)?.blessing,
        `武器 ${good.id} に祝福は付けられない`
      )
      need(
        catalog.skill(skill)?.uses,
        `武器 ${good.id} のワザ ${skill} に使用回数（uses）がない`
      )
    }
  }
  const curve = data.balance.growthCurve
  need(
    curve.bands[0] < curve.bands[1],
    "成長の段の境目は [序盤の終わり, 中盤の終わり] の順にする"
  )
  for (const type of growthTypes)
    need(curve.types[type], `成長の型 ${type} の倍率がない`)
  const rarity = data.balance.weapon.rarity
  need(
    Object.values(rarity.randomSkills).every((count) => count === 2),
    "武器のランダム枠は全レア度で2つにする"
  )
  if (data.smithy?.skillBook)
    need(
      catalog.good(data.smithy.skillBook)?.kind === "material",
      "スキルの書は素材にする"
    )
  const randomSlots = Math.max(...Object.values(rarity.randomSkills))
  need(
    randomSlots <= WEAPON_SKILLS - FIXED_WEAPON_SKILLS,
    `ランダムなワザの枠は${WEAPON_SKILLS - FIXED_WEAPON_SKILLS}つまで`
  )
  for (const entry of rarities)
    need(
      rarity.powerRate[entry][0] <= rarity.powerRate[entry][1],
      `レア度 ${entry} の上振れは [少ない, 多い]`
    )
  for (const type of weaponTypes) {
    const pool = data.weaponSkills[type]
    need(
      pool.length >= randomSlots,
      `武器種 ${type} のランダムなワザの候補が${randomSlots}つに足りない`
    )
    need(
      new Set(pool).size === pool.length,
      `武器種 ${type} のランダムなワザの候補が重複している`
    )
    for (const skill of pool) {
      need(catalog.skill(skill), `武器種 ${type} のワザ ${skill} がない`)
      need(
        !catalog.skill(skill)?.blessing,
        `武器種 ${type} の候補に祝福は入れられない`
      )
      need(
        catalog.skill(skill)?.uses,
        `武器種 ${type} のワザ ${skill} に使用回数（uses）がない`
      )
    }
  }
}
