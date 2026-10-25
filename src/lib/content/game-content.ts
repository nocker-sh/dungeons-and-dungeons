import conversations from "@/lib/content/data/conversations.json"
import worldMap from "@/lib/content/data/world-map.json"
import type { GameContent } from "@/lib/wiz"
import characters from "@/lib/concept/data/characters.json"
import world from "@/lib/concept/data/world.json"
import settings from "@/lib/content/data/settings.json"
import party from "@/lib/content/data/party.json"
import skills from "@/lib/content/data/skills.json"
import goods from "@/lib/content/data/goods.json"
import foes from "@/lib/content/data/foes.json"
import layers from "@/lib/content/data/layers.json"
import demons from "@/lib/content/data/demons.json"
import rooms from "@/lib/content/data/rooms.json"
import shops from "@/lib/content/data/shops.json"
import recruits from "@/lib/content/data/recruits.json"
import quests from "@/lib/content/data/quests.json"
import smithy from "@/lib/content/data/smithy.json"
import looks from "@/lib/content/data/looks.json"

/**
 * 作品のデータを JSON から組み立てる。
 * - 数値・ワザ・品物・層など遊びの規則は src/lib/content/data/*.json
 * - 名前・職業は設定資料（src/lib/concept/data/*.json）を正とし、同じ id から引く
 * 中身の検証はエンジン（GameCatalog）が起動時に行う。
 */
type Named = { id: string; name?: string; job?: string }

type Person = { id: string; name: string; role?: string; job?: string }
const people = new Map<string, Person>(
  characters
    .flatMap<Person>((group) => group.characters)
    .map((entry) => [entry.id, entry])
)
type PlaceEntry = {
  id: string
  name: string
  attack?: { name: string; reach: "melee" | "ranged" }
  skillNames?: Record<string, string>
  scenes?: { key: string; kind: "path" | "treasure" | "rest" }[]
}
const places = new Map(
  (world as PlaceEntry[]).map((entry) => [entry.id, entry])
)

/** 層の背景の候補：絵は設定資料の world（層の場所の scenes）を正とし、識別子だけをエンジンへ渡す。 */
function layerWithScenes<T extends { id: string }>(layer: T) {
  const placeId = (looks.layers as Record<string, { scene?: string }>)[layer.id]
    ?.scene
  const scenes = placeId ? places.get(placeId)?.scenes : undefined
  if (!scenes?.length) return layer
  const keys = (kind: "path" | "treasure" | "rest") =>
    scenes.filter((entry) => entry.kind === kind).map((entry) => entry.key)
  const [path, treasure, rest] = [keys("path"), keys("treasure"), keys("rest")]
  if (!path.length) return layer
  return {
    ...layer,
    scenes: {
      path,
      ...(treasure.length ? { treasure } : {}),
      ...(rest.length ? { rest } : {}),
    },
  }
}

/** 仲間：名前と職業は設定資料から。資料にない者はデータの値を使う。 */
function person<T extends Named>(entry: T): T & { name: string; job: string } {
  const found = people.get(entry.id)
  return {
    ...entry,
    name: found?.name ?? entry.name ?? entry.id,
    job: found?.job ?? entry.job ?? found?.role ?? "",
  }
}

/** 悪魔：「赤糸の悪魔」＋「ヌイ」のように、資料の肩書きと名前をつなぐ。 */
function demon<T extends Named>(entry: T): T & { name: string } {
  const found = people.get(entry.id)
  return {
    ...entry,
    name: found ? `${found.role ?? ""}${found.name}` : (entry.name ?? entry.id),
  }
}

/** 敵：名前は資料の world から。 */
function foe<T extends Named>(entry: T): T & { name: string } {
  return {
    ...entry,
    name: places.get(entry.id)?.name ?? entry.name ?? entry.id,
    ...(places.get(entry.id)?.attack
      ? { attack: places.get(entry.id)!.attack }
      : {}),
    ...(places.get(entry.id)?.skillNames
      ? { skillNames: places.get(entry.id)!.skillNames }
      : {}),
  }
}

/** slug は JSON を人が読むための元の名前。エンジンへは渡さない。 */
function withoutSlug<T>(value: T): T {
  if (Array.isArray(value)) return value.map(withoutSlug) as T
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== "slug")
        .map(([key, entry]) => [key, withoutSlug(entry)])
    ) as T
  return value
}

/**
 * slug 付きの作品データ（名前は設定資料から補ったもの）。
 * 調整ツール（builder）はこれを複製して数値を書き換え、toGameContent でエンジンへ渡す。
 */
export const contentSource = {
  ...settings,
  conversations,
  worldMap,
  conversationResidents: characters
    .filter((group) => group.label === "街の住人")
    .flatMap((group) => group.characters.map((person) => person.id)),
  conversationPlaces: [
    ...new Set([
      ...Object.values(looks.places),
      ...worldMap.tiles.flatMap((tile) =>
        "place" in tile ? [tile.place] : []
      ),
    ]),
  ],
  party: party.map(person),
  skills,
  goods,
  foes: foes.map(foe),
  layers: layers.map(layerWithScenes),
  demons: demons.map(demon),
  rooms,
  shops,
  recruits: recruits.map((recruit) => ({
    ...recruit,
    member: person(recruit.member),
  })),
  quests,
  smithy,
}
export type ContentSource = typeof contentSource

/** slug を外してエンジンの形にする。中身の検証はエンジン（GameCatalog）が行う。 */
export function toGameContent(source: unknown): GameContent {
  return withoutSlug(source) as GameContent
}

export const gameContent = toGameContent(contentSource)
