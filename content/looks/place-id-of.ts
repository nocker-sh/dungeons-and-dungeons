import { tuning } from "@/content/looks/data"

/** 場所の id（設定資料の背景）。入ったときの場面の条件に使う。 */
export function placeIdOf(key: string): string {
  return tuning.places[key] ?? key
}
