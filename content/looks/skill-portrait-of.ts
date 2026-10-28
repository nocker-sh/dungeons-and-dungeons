import { personOf } from "@/content/looks/person-of"
import { portraitOf } from "@/content/looks/portrait-of"

/** 使用するワザに対応する上半身。未登録のワザは通常絵へ戻す。 */
export function skillPortraitOf(id: string, skill: string): string {
  return personOf(id)?.skillPortraits?.[skill] ?? portraitOf(id, "skill")
}
