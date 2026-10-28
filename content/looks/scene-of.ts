import { places, tuning } from "@/content/looks/data"

/** 場所の背景。looks.json の places が資料の world の id を指す。 */
export function sceneOf(key: string, wide = false): string | null {
  const place = places.get(tuning.places[key] ?? key)
  return (wide ? (place?.wideImage ?? place?.image) : place?.image) ?? null
}
