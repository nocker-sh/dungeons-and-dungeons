import data from "./data/outfits.json"

export type OutfitArtwork = { look: string; armor: string; image: string }
export const outfitArtwork = data as OutfitArtwork[]
const images = new Map(
  outfitArtwork.map((entry) => [`${entry.look}/${entry.armor}`, entry.image])
)

/** 外見と装備中の防具に対応する上半身。未登録なら通常の上半身へ戻す。 */
export function outfitImage(look: string, armor?: string | null) {
  return armor ? images.get(`${look}/${armor}`) : undefined
}
