import { gameContent } from "@/content/game-content"
import { goodsCatalog } from "@/development/goods"
import players from "@/concept/data/players.json"
import { catalog } from "@/development/outfits"

export function wearableArmor(memberId: string, lookId?: string) {
  if (players.some((player) => player.id === lookId)) {
    return goodsCatalog.filter(
      (good) =>
        good.kind === "armor" && gameContent.hero.outfits?.includes(good.id)
    )
  }
  if (catalog.member(memberId)?.unique) return []
  return goodsCatalog.filter(
    (good) => good.kind === "armor" && catalog.canEquip(memberId, good.id)
  )
}
