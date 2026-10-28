import { personOf } from "@/content/looks/person-of"

/** 台本の {id} を資料の名前に差し替える（名前が変わっても台本を直さなくてよい）。 */
export function named(text: string) {
  return text.replace(
    /\{([\w-]+)\}/g,
    (all, id: string) => personOf(id)?.name ?? all
  )
}
