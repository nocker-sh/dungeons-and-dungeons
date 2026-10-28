import { places, tuning } from "@/content/looks/data"

/** 場所の slug（人が読む名前。/previews の URL などに使う）。 */
export function placeSlug(key: string): string {
  return places.get(tuning.places[key] ?? key)?.slug ?? key
}
