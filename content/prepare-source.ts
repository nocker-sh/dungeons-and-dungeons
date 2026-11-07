import worldMap from "@/content/data/world-map.json"
import characters from "@/concept/data/characters.json"
import world from "@/concept/data/world.json"
import looks from "@/content/data/looks.json"
import type { sourceData } from "@/content/source-data"

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

export function prepareSource(raw: typeof sourceData) {
  return {
    ...raw,
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
    party: raw.party.map(person),
    foes: raw.foes.map(foe),
    layers: raw.layers.map(layerWithScenes),
    demons: raw.demons.map(demon),
    recruits: raw.recruits.map((recruit) => ({
      ...recruit,
      member: person(recruit.member),
    })),
  }
}
