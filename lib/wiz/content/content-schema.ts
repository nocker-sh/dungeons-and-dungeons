import { conversationSchema } from "@/lib/wiz/conversations/schema"
import { z } from "zod"
import type { WizDeepReadonly } from "@/lib/wiz/core/immutable-value"
import { PARTY_SLOTS, weaponTypes } from "@/lib/wiz/content/constants"
import { positive, id, count } from "./schema/primitives"
import { good, effect } from "./schema/goods"
import { hero, member } from "./schema/members"
import { skill, foe } from "./schema/combat"
import { layer } from "./schema/expedition"
import {
  demon,
  room,
  shop,
  recruit,
  quest,
  summon,
  recruiting,
  smithy,
} from "./schema/town"
import { balance } from "./schema/balance"

export const contentSchema = z.strictObject({
  worldMap: z
    .strictObject({
      width: positive,
      height: positive,
      start: id,
      tiles: z
        .array(
          z.strictObject({
            id,
            x: count,
            y: count,
            name: z.string().min(1),
            biome: z.enum(["road", "village", "forest", "wetland", "mountain"]),
            settlement: z.boolean().optional(),
            requires: z.array(id).optional(),
            minimumReached: count.optional(),
            goods: z
              .array(z.strictObject({ good: id, count: positive }))
              .optional(),
            place: id.optional(),
            dungeon: id.optional(),
          })
        )
        .min(1),
    })
    .optional(),
  startingCompanions: z
    .array(id)
    .max(PARTY_SLOTS - 1)
    .optional(),
  conversations: z.array(conversationSchema).optional(),
  conversationResidents: z.array(id).optional(),
  /** 入ったときに場面が始まりうる街の場所。 */
  conversationPlaces: z.array(id).optional(),
  startingGold: count,
  startingStones: count,
  /** 最初から契約・合体している悪魔。召喚石は使わない。 */
  startingDemon: id.optional(),
  startingBag: z.array(z.strictObject({ good: id, count: positive })),
  hero,
  junk: id,
  /** 光るガラクタ。鑑定すると必ず R 以上の武器になる。 */
  rareJunk: id.optional(),
  /** 使える手が尽きたときの弱い攻撃（使用回数なし）。 */
  brawl: id,
  reached: count,
  /** 最初からいる仲間（今は主人公だけ）。残りは募集で集める。 */
  party: z.array(member).min(1).max(PARTY_SLOTS),
  skills: z.array(skill),
  /** 武器種ごとの、ランダムなワザの候補。レア度の高い個体に付く。 */
  weaponSkills: z.record(z.enum(weaponTypes), z.array(id)),
  goods: z.array(good),
  foes: z.array(foe),
  layers: z.array(layer).min(1),
  demons: z.array(demon).min(1),
  rooms: z.array(room).min(1),
  shops: z.array(shop),
  recruits: z.array(recruit),
  quests: z.array(quest),
  balance,
  summon,
  recruiting,
  smithy: smithy.optional(),
})

export type GameContent = z.input<typeof contentSchema>

export type ReadonlyContent = WizDeepReadonly<z.output<typeof contentSchema>>

type Content = z.output<typeof contentSchema>

export type MemberDef = Content["party"][number]

export type HeroDef = Content["hero"]

export type SkillDef = Content["skills"][number]

export type GoodDef = Content["goods"][number]

export type FoeDef = Content["foes"][number]

export type LayerDef = Content["layers"][number]

export type StationDef = LayerDef["stations"][number]

export type DemonDef = Content["demons"][number]

export type RoomDef = Content["rooms"][number]

export type ShopDef = Content["shops"][number]

export type RecruitDef = Content["recruits"][number]

export type QuestDef = Content["quests"][number]

export type RecipeDef = NonNullable<Content["smithy"]>["recipes"][number]

export type CostDef = NonNullable<Content["smithy"]>["upgrades"][number]

export type Effect = z.output<typeof effect>
