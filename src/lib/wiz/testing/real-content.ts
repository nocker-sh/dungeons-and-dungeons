import { contentSource, toGameContent } from "@/lib/content/game-content"
import type { GameContent } from "@/lib/wiz/content"

/**
 * テストが使う作品データの唯一の入口。
 * 本物のゲームのデータ（src/lib/content）をそのままエンジンの形にして渡すので、
 * テストは実際に遊ぶ数値の上で規則を確かめる。
 * 人が読める名前（slug）から id を引く小さな道具もここに置く。
 */
const content = toGameContent(contentSource)

export type RealMember = GameContent["party"][number]
export type RealSkill = GameContent["skills"][number]
export type RealGood = GameContent["goods"][number]
export type RealFoe = GameContent["foes"][number]
export type RealLayer = GameContent["layers"][number]
export type RealStation = RealLayer["stations"][number]
export type RealDemon = GameContent["demons"][number]
export type RealRoom = GameContent["rooms"][number]
export type RealShop = GameContent["shops"][number]
export type RealRecruit = GameContent["recruits"][number]
export type RealQuest = GameContent["quests"][number]
export type RealRecipe = NonNullable<GameContent["smithy"]>["recipes"][number]

/** 本物の作品データ（エンジンへ渡す形。slug は外してある）。 */
export function realContent(): GameContent {
  return content
}

/** 鍛冶屋のデータ（強化の費用と生産のレシピ）。 */
export function realSmithy(): NonNullable<GameContent["smithy"]> {
  const smithy = content.smithy
  if (!smithy) throw new Error("作品データに鍛冶屋がない")
  return smithy
}

/** 規則の数値（balance）。テストは数値を書き写さず、ここから読む。 */
export function realBalance(): GameContent["balance"] {
  return content.balance
}

type Slugged = { readonly id: string; readonly slug?: string }

/** 人が読める名前で指せる一覧の種類。 */
export type ContentKind =
  | "member"
  | "skill"
  | "good"
  | "foe"
  | "layer"
  | "demon"
  | "room"
  | "shop"
  | "recruit"
  | "quest"
  | "recipe"

const source: {
  party: readonly Slugged[]
  skills: readonly Slugged[]
  goods: readonly Slugged[]
  foes: readonly Slugged[]
  layers: readonly Slugged[]
  demons: readonly Slugged[]
  rooms: readonly Slugged[]
  shops: readonly Slugged[]
  recruits: readonly (Slugged & { member: Slugged })[]
  quests: readonly Slugged[]
  smithy?: { recipes: readonly Slugged[] }
} = contentSource

const sluggedEntries: Record<ContentKind, readonly Slugged[]> = {
  member: [...source.party, ...source.recruits.map((entry) => entry.member)],
  skill: source.skills,
  good: source.goods,
  foe: source.foes,
  layer: source.layers,
  demon: source.demons,
  room: source.rooms,
  shop: source.shops,
  recruit: source.recruits,
  quest: source.quests,
  recipe: source.smithy?.recipes ?? [],
}

const slugToId = new Map<ContentKind, Map<string, string>>(
  Object.entries(sluggedEntries).map(([kind, entries]) => [
    kind as ContentKind,
    new Map(entries.map((entry) => [entry.slug ?? entry.id, entry.id])),
  ])
)

const allSlugs = new Map<string, string>(
  Object.values(sluggedEntries).flatMap((entries) =>
    entries.flatMap((entry) =>
      entry.slug ? [[entry.slug, entry.id] as const] : []
    )
  )
)

const idToSlug = new Map<string, string>(
  Object.values(sluggedEntries).flatMap((entries) =>
    entries.map((entry) => [entry.id, entry.slug ?? entry.id] as const)
  )
)

/**
 * 人が読める名前（slug）から id。すでに id ならそのまま返す。
 * 組み立て器（`aState()`・`aContent()`）が内側で使い、テストに uuid を書かせない。
 */
export function idOfSlug(kind: ContentKind, key: string): string {
  return slugToId.get(kind)?.get(key) ?? key
}

/**
 * 人が読める名前（slug）から id。作品データ全体で slug は重ならないので種類は要らない。
 * エンジンへ送る操作や、状態・出来事と比べる id はこれで書く（テストに uuid を書かない）。
 */
export function contentId(slug: string): string {
  const found = allSlugs.get(slug)
  if (!found) throw new Error(`作品データに ${slug} がない`)
  return found
}

/** id から人が読める名前。失敗の読みやすさのために使う。 */
export function slugOfId(id: string): string {
  return idToSlug.get(id) ?? id
}

function finder<T extends { id: string }>(
  kind: ContentKind,
  list: readonly T[]
) {
  return (key: string): T => {
    const id = idOfSlug(kind, key)
    const found = list.find((entry) => entry.id === id)
    if (!found) throw new Error(`作品データに ${kind} の ${key} がない`)
    return found
  }
}

const members: readonly RealMember[] = [
  ...content.party,
  ...content.recruits.map((entry) => entry.member),
]

/** 仲間の定義（主人公と募集の冒険者）。 */
export const memberBySlug = finder<RealMember>("member", members)
/** ワザの定義。 */
export const skillBySlug = finder<RealSkill>("skill", content.skills)
/** 品物の定義（値段・攻撃力などの数値はここから読む）。 */
export const goodBySlug = finder<RealGood>("good", content.goods)
/** 敵の定義。 */
export const foeBySlug = finder<RealFoe>("foe", content.foes)
/** 層の定義。 */
export const layerBySlug = finder<RealLayer>("layer", content.layers)
/** 悪魔の定義。 */
export const demonBySlug = finder<RealDemon>("demon", content.demons)
/** 宿の部屋の定義。 */
export const roomBySlug = finder<RealRoom>("room", content.rooms)
/** 店の定義。 */
export const shopBySlug = finder<RealShop>("shop", content.shops)
/** 募集の定義（値段と冒険者）。 */
export const recruitBySlug = finder<RealRecruit>("recruit", content.recruits)
/** 討伐依頼の定義。 */
export const questBySlug = finder<RealQuest>("quest", content.quests)
/** 鍛冶屋の生産のレシピ。 */
export const recipeBySlug = finder<RealRecipe>(
  "recipe",
  content.smithy?.recipes ?? []
)
