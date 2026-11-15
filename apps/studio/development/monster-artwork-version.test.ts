import { describe, expect, it } from "vite-plus/test"
import type { ConceptEntry } from "@/concept/database"
import { monsterArtworkVersion } from "@/development/monster-artwork-version"

describe("モンスターの画像バージョン", () => {
  const entry: ConceptEntry = {
    id: "foe",
    slug: "foe",
    name: "敵",
    category: "敵",
    role: "敵",
    image: "v0-normal",
    attackImage: "v0-attack",
    sleepingImage: "v0-sleep",
    defeatedImage: "v0-defeated",
    skillPortraits: { fire: "v0-fire" },
    artworkVersions: [
      {
        version: "v1",
        image: "v1-normal",
        attackImages: ["v1-attack", "v1-attack2"],
      },
      { version: "v2", image: "v2-normal" },
    ],
  }

  it("未生成の状態へ他版の画像を混ぜず、攻撃とワザの枠は維持する", () => {
    const projected = monsterArtworkVersion(entry, "v2")
    expect(projected.image).toBe("v2-normal")
    expect(projected.attackImage).toBeUndefined()
    expect(projected.attackImages).toEqual(["", ""])
    expect(projected.skillPortraits).toEqual({ fire: "" })
    expect(projected.sleepingImage).toBeUndefined()
    expect(projected.defeatedImage).toBeUndefined()
    expect(entry.image).toBe("v0-normal")
  })

  it("全版で同じ枠数を保ち、選択版の攻撃画像を解決する", () => {
    for (const version of ["v0", "v1", "v2"]) {
      expect(monsterArtworkVersion(entry, version).attackImages).toHaveLength(2)
    }
    expect(monsterArtworkVersion(entry, "v1").attackImage).toBe("v1-attack")
    expect(monsterArtworkVersion(entry, "v0").attackImage).toBe("v0-attack")
  })
})
