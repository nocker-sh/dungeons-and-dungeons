import characters from "@/concept/data/characters.json"
import world from "@/concept/data/world.json"
import players from "@/concept/data/players.json"
import dialogues from "@/concept/data/dialogues.json"
import looks from "@/content/data/looks.json"
import talks from "@/content/data/talks.json"
import { z } from "zod"
import { portraitStates } from "@/concept/portrait-types"
import type { Person, Place, Tuning, NightTalk } from "@/content/looks/types"

export const people = new Map<string, Person>(
  characters
    .flatMap<Person>((group) => group.characters)
    .map((entry) => [entry.id, entry])
)
export const hero = new Map<string, Person>(
  players.map((entry) => [entry.id, entry])
)
const sceneKindSchema = z.enum(["path", "treasure", "rest"])
const entranceSchema = z.record(z.string(), z.tuple([z.number(), z.number()]))

export const places = new Map<string, Place>(
  world.map((entry) => [
    entry.id,
    {
      ...entry,
      scenes: entry.scenes?.map((scene) => ({
        ...scene,
        kind: sceneKindSchema.parse(scene.kind),
      })),
      entrances: entry.entrances
        ? {
            narrow: entranceSchema.parse(entry.entrances.narrow),
            wide: entranceSchema.parse(entry.entrances.wide),
          }
        : undefined,
    },
  ])
)
const shopKindSchema = z.enum(["shop", "smithy"])
export const tuning: {
  members: Record<string, Tuning>
  defaults: Required<Tuning>
  demons: Record<string, Tuning>
  foes: Record<string, { glow?: string }>
  layers: Record<string, { scene?: string; glow?: string }>
  places: Record<string, string>
  people: Record<string, string>
  shops: Record<
    string,
    { kind: "shop" | "smithy"; place: string; keepers: string[] }
  >
  street: string[]
  goodIcons: Record<string, string>
  kindIcons: Record<string, string>
} = {
  ...looks,
  shops: Object.fromEntries(
    Object.entries(looks.shops).map(([id, shop]) => [
      id,
      {
        ...shop,
        kind: shopKindSchema.parse(shop.kind),
      },
    ])
  ),
}
const expressionSchema = z
  .enum(
    portraitStates
      .map((state) => state.value)
      .filter((value) => value !== "special" && value !== "skill")
  )
  .optional()

/** JSONの配列を、長さと表情を検証した会話のタプルへ変換する。 */
const nightTalkSchema = z.object({
  pair: z.tuple([z.string(), z.string()]),
  lines: z.array(z.tuple([z.string(), z.string(), expressionSchema])),
  choice: z.object({
    ask: z.string(),
    options: z.array(
      z.tuple([z.string(), z.string(), z.string(), expressionSchema])
    ),
  }),
})

export const lines: {
  members: Record<string, string>
  keepers: Record<string, string[]>
  layers: Record<string, string>
  guide: Record<string, string>
  rooms: Record<string, string>
  night: NightTalk[]
} = { ...talks, night: z.array(nightTalkSchema).parse(talks.night) }

/** 話す人のひとこと。資料の台詞を優先し、なければ台本。 */
export function sayings(id: string) {
  return dialogues.filter((entry) => entry.speakerId === id)
}
