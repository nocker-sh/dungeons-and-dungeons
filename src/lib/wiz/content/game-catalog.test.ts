import { describe, expect, it } from "vite-plus/test"
import { realContent } from "@/lib/wiz/testing"
import { ContentError, GameCatalog } from "@/lib/wiz"

describe("コンテンツ", () => {
  it("誤りをまとめて返す", () => {
    const broken = {
      ...realContent(),
      hero: { ...realContent().hero, looks: ["purple", "purple"] },
      shops: [...realContent().shops, { id: "ghost", goods: ["nothing"] }],
    }
    try {
      new GameCatalog(broken)
      expect.unreachable()
    } catch (error) {
      expect(error).toBeInstanceOf(ContentError)
      expect((error as ContentError).problems).toEqual(
        expect.arrayContaining([
          "主人公の外見の候補が重複している",
          "店 ghost の品物 nothing がない",
        ])
      )
    }
  })
})
