import { tuning } from "@/content/looks/data"

/** 品物のアイコン名。looks.json の別名、なければ種類ごとの既定。 */
export function goodIconKey(id: string, kind?: string) {
  return (
    tuning.goodIcons[id] ?? (kind ? tuning.kindIcons[kind] : undefined) ?? id
  )
}
