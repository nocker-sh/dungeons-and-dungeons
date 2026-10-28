import { hero, people } from "@/content/looks/data"
import type { Person } from "@/content/looks/types"

/** 資料の人物（主人公は外見の資料から）。 */
export function personOf(id: string): Person | undefined {
  return hero.get(id) ?? people.get(id)
}
