import { existsSync } from "node:fs"
import { describe, expect, it } from "vite-plus/test"
import goods from "@/content/data/goods.json"
import foes from "@/content/data/foes.json"
import artwork from "@/concept/data/goods-art.json"

const additions = [
  ["crystal-claw", "kamokutsu", 51],
  ["statue-shard", "kabemimi", 21],
  ["rust-fang", "kubikoki", 47],
  ["venom-petal", "tsubomimu", 139],
  // ガラクタの落とし物を減らした分（2→1個）だけ総額が下がっている
  ["spore-pouch", "numa-koki", 71],
  ["contract-scrap", "tsunofood", 103],
] as const

describe("素材の入手と画像", () => {
  it.each(additions)(
    "%s を対応する敵から入手でき、売却総額を保つ",
    (slug, enemySlug, total) => {
      const material = goods.find((good) => good.slug === slug)!
      const foe = foes.find((enemy) => enemy.slug === enemySlug)!
      expect(material.kind).toBe("material")
      expect(foe.drops).toContainEqual({ good: material.id, count: 1 })
      expect(
        foe.drops.reduce(
          (sum, drop) =>
            sum +
            (goods.find((good) => good.id === drop.good)?.sell ?? 0) *
              drop.count,
          0
        )
      ).toBe(total)
    }
  )

  it("全素材に画像参照と公開ファイルがある", () => {
    for (const material of goods.filter((good) => good.kind === "material")) {
      const image = artwork.find((entry) => entry.id === material.id)?.image
      expect(image, material.name).toBeTruthy()
      expect(existsSync(`public${image}`), material.name).toBe(true)
    }
  })
})
