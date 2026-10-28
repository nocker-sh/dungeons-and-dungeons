import { personOf } from "@/content/looks/person-of"

/**
 * 仲間の必殺技の専用イラスト（`skillPortraits` にワザの id で登録した絵）。
 * 未登録なら null を返し、画面はいつもの立ち絵でワザを見せる。
 */
export function specialArtOf(id: string, skill: string): string | null {
  return personOf(id)?.skillPortraits?.[skill] ?? null
}
