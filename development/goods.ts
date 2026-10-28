import { contentSource, gameContent } from "@/content/game-content"
import { goodImage } from "@/concept/goods-art"
import { GameDefinition } from "@/lib/wiz/definition/game-definition"
import { GoodViews } from "@/lib/wiz/queries/good-views"
import { baseSellPrice } from "@/lib/wiz/rules/base-sell-price"
import { usableInField } from "@/lib/wiz/rules/field-usable"

const definition = new GameDefinition(gameContent)
const views = new GoodViews(
  definition.catalog,
  definition.rules.party,
  definition.rules.weapons
)
const slugs = new Map(contentSource.goods.map((good) => [good.id, good.slug]))
const shopNames = ["武器と防具", "道具屋", "薬屋"]

export const goodKindsByCategory = {
  weapons: "weapon",
  armor: "armor",
  items: "item",
  materials: "material",
} as const

export type GoodsDevCategory = keyof typeof goodKindsByCategory

export function isGoodsCategory(
  category: string
): category is GoodsDevCategory {
  return Object.hasOwn(goodKindsByCategory, category)
}

/** 実行用データとエンジンの表示値から、開発用の図鑑を組み立てる。 */
export const goodsCatalog = definition.catalog.data.goods.map((good) => {
  const sources: string[] = []
  for (const [index, shop] of definition.catalog.data.shops.entries()) {
    if (shop.goods.includes(good.id))
      sources.push(`${shopNames[index] ?? "店"}・${good.unlock ?? 0}層から`)
    if (shop.appraise?.includes(good.id))
      sources.push(
        `${shopNames[index] ?? "店"}で鑑定${good.appraiseFrom !== undefined ? `・${good.appraiseFrom}層から` : ""}`
      )
  }
  if (
    definition.catalog.data.smithy?.recipes.some(
      (recipe) => recipe.good === good.id
    )
  )
    sources.push("鍛冶屋で生産")
  for (const layer of definition.catalog.data.layers)
    if (layer.treasure.goods.some((entry) => entry.good === good.id))
      sources.push(`${layer.no}層の宝箱`)
  const droppingFoes = definition.catalog.data.foes.filter((foe) =>
    foe.drops.some((entry) => entry.good === good.id)
  )
  if (droppingFoes.length)
    sources.push(
      `敵の落とし物：${droppingFoes.map((foe) => foe.name).join("・")}`
    )
  if (good.id === definition.catalog.data.junk) sources.push("探索の戦利品")
  if (!sources.length && good.kind === "weapon")
    sources.push("初期装備・キャラ固有装備")
  const recipes =
    definition.catalog.data.smithy?.recipes.filter((recipe) =>
      recipe.materials.some((entry) => entry.good === good.id)
    ) ?? []
  const materialUses = recipes
    .map((recipe) => definition.catalog.good(recipe.good)?.name ?? "")
    .filter(Boolean)
  const upgradeMaterial =
    definition.catalog.data.smithy?.upgrades.some((upgrade) =>
      upgrade.materials.some((entry) => entry.good === good.id)
    ) ?? false
  return {
    ...views.entry(good, {}),
    slug: slugs.get(good.id) ?? good.id,
    image: goodImage(good.id),
    imageVersions: { v1: goodImage(good.id, "v1") },
    price: good.price ?? null,
    sell: baseSellPrice(good),
    layer: good.appraiseFrom ?? good.unlock ?? 0,
    exclusive: good.appraiseFrom !== undefined,
    sources,
    usage:
      good.kind === "item"
        ? usableInField(good.effect)
          ? "戦闘・街・探索で使える"
          : good.effect
            ? "戦闘で使える"
            : "使用効果なし"
        : null,
    effectType: good.effect?.type ?? null,
    materialUses,
    upgradeMaterial,
  }
})

export type CatalogGood = (typeof goodsCatalog)[number]
