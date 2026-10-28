import { places, tuning } from "@/content/looks/data"

export function placeName(key: string): string {
  return places.get(tuning.places[key] ?? key)?.name ?? key
}
