import { describe, expect, it } from "vite-plus/test"
import players from "@/lib/concept/data/players.json"
import { outfitImage } from "@/lib/concept/outfits"
import { gameContent } from "@/lib/content/game-content"
import { wearableArmor } from "./outfits"

describe("devの衣装一覧", () => {
  it("主人公は装備できなくても登録された見た目用衣装を確認できる", () => {
    const hero = gameContent.party[0]
    expect(wearableArmor(hero.id)).toEqual([])
    for (const player of players) {
      const clothes = wearableArmor(hero.id, player.id)
      expect(clothes.map((good) => good.id).sort()).toEqual(
        [...(gameContent.hero.outfits ?? [])].sort()
      )
      expect(clothes.length).toBeGreaterThan(0)
      for (const good of clothes) {
        expect(outfitImage(player.id, good.id)).toBeTruthy()
      }
    }
  })
})
