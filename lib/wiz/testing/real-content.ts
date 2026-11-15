import { contentSource, toGameContent } from "@/content/game-content"
import type { GameContent } from "@/lib/wiz/content/content-schema"
import type { RealLayer } from "@/lib/wiz/testing/layer-by-slug"

/**
 * テストが使う作品データの唯一の入口。
 * 本物のゲームのデータ（content）をそのままエンジンの形にして渡すので、
 * テストは実際に遊ぶ数値の上で規則を確かめる。
 * 人が読める名前（slug）から id を引く小さな道具もここに置く。
 * 全テストで同じ1つを共有するので凍結し、どこかのテストが書き換えたらその場で失敗させる
 * （変えた作品データが要るテストは `aContent()` で複製から作る）。
 */
export const content = deepFreeze(toGameContent(contentSource))

export type RealStation = RealLayer["stations"][number]

/** 本物の作品データ（エンジンへ渡す形。slug は外してある）。 */
export function realContent(): GameContent {
  return content
}

export type Slugged = { readonly id: string; readonly slug?: string }

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

export const sluggedEntries: Record<ContentKind, readonly Slugged[]> = {
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

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value))
    return value
  for (const child of Object.values(value)) deepFreeze(child)
  return Object.freeze(value)
}
