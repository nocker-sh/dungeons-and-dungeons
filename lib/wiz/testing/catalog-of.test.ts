import { expect, it } from "vite-plus/test"
import { GameCatalog } from "@/lib/wiz/content/game-catalog"
import { ContentError } from "@/lib/wiz/content/content-error"
import { aContent } from "@/lib/wiz/testing/content-builder"
import { catalogOf } from "@/lib/wiz/testing/catalog-of"
import { realContent } from "@/lib/wiz/testing/real-content"

it("同じ作品データからは、検証済みの同じ定義を返す", () => {
  const first = catalogOf(realContent())
  expect(first).toBeInstanceOf(GameCatalog)
  expect(catalogOf(realContent())).toBe(first)
  // 定義をそのまま渡したら作り直さない
  expect(catalogOf(first)).toBe(first)
})

it("別の作品データからは別の定義を作る", () => {
  const changed = aContent().withWeaponPower(900).build()
  const catalog = catalogOf(changed)
  expect(catalog).not.toBe(catalogOf(realContent()))
  expect(catalogOf(changed)).toBe(catalog)
})

it("誤った作品データは覚えず、呼ぶたびに同じ誤りを投げる", () => {
  const broken = { ...realContent(), startingGold: -1 }
  expect(() => catalogOf(broken)).toThrow(ContentError)
  expect(() => catalogOf(broken)).toThrow(ContentError)
})
