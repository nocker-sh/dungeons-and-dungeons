import artwork from "./data/goods-art.json"
import goods from "@/lib/content/data/goods.json"

// VITE_EQUIPMENT_IMAGES=off で武器・防具の絵を出さず、記号の表示に戻す
const equipmentImagesOff = import.meta.env.VITE_EQUIPMENT_IMAGES === "off"
const equipment = new Set(
  (goods as { id: string; kind: string }[])
    .filter((good) => good.kind === "weapon" || good.kind === "armor")
    .map((good) => good.id)
)

const images = new Map(
  (
    artwork as {
      id: string
      image?: string
      imageVersions?: Record<string, string>
    }[]
  )
    .filter((entry) => !(equipmentImagesOff && equipment.has(entry.id)))
    .map((entry) => [entry.id, entry])
)

export function goodImage(id: string, version = "v0"): string | undefined {
  const entry = images.get(id)
  return version === "v0" ? entry?.image : entry?.imageVersions?.[version]
}
