import { z } from "zod"
import type { WizDeepReadonly } from "@/lib/wiz/core/immutable-value"
import {
  HERO_NAME_STORED_MAX,
  PARTY_STORED_MAX,
  WEAPON_SKILLS,
  eventKinds,
  rarities,
  statusKinds,
} from "@/lib/wiz/content"

/**
 * 保存・復元の境界で検証する状態の形。
 * 名前・職業などコンテンツが決めるものは持たず、IDでコンテンツを引く。
 */
const id = z.string().min(1)
const count = z.number().int().nonnegative()
const stack = z.strictObject({ good: id, count: z.number().int().positive() })
const status = z.strictObject({
  kind: z.enum(statusKinds),
  turns: z.number().int().positive(),
})

export const memberSchema = z.strictObject({
  blessing: id.optional(),
  /** コンテンツの仲間の id。 */
  id,
  lv: z.number().int().positive(),
  exp: count,
  hp: count,
  /** 成長を含む素の能力（装備の補正は含まない）。 */
  stats: z.strictObject({
    maxHp: z.number().int().positive(),
    str: count,
    tec: count,
    spd: count,
  }),
  /** ワザごとに使った回数。宿で泊まると空になる。 */
  used: z.array(
    z.strictObject({ skill: id, count: z.number().int().positive() })
  ),
  status: z.array(status),
  fatigue: z.number().int().min(0).max(100),
  dirt: z.number().int().min(0).max(100),
  like: count,
  /** 悪魔と契約して戦う仲間（R）の、いまのモード（契約の `modes` の番号）。省略で最初のモード。 */
  mode: count.optional(),
})

const loot = z.strictObject({
  gold: count,
  goods: z.array(stack),
  /** この探索で敵が落とした武器の個体の id（全滅すると失う）。 */
  weapons: z.array(id).optional(),
})

const pending = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("discovery") }),
  z.strictObject({
    kind: z.literal("treasure"),
    note: z.string().optional(),
    gold: count,
    goods: z.array(stack),
  }),
  z.strictObject({ kind: z.literal("trap"), damage: count }),
  z.strictObject({
    kind: z.literal("loot"),
    gold: count,
    goods: z.array(stack),
    boss: z.boolean(),
    /** 中ボス・ボスが落とした召喚石。 */
    stones: count,
    /** 敵が落とした武器の個体の id。 */
    weapons: z.array(id).optional(),
  }),
])

export const expeditionSchema = z.strictObject({
  layer: id,
  surveyed: z
    .array(z.strictObject({ station: id, kind: z.enum(eventKinds) }))
    .max(2)
    .optional(),
  at: id,
  visited: z.array(id),
  events: z.array(z.strictObject({ station: id, kind: z.enum(eventKinds) })),
  pending: pending.nullable(),
  loot,
  cleared: z.boolean(),
})

const actorRef = z.strictObject({ kind: z.enum(["member", "foe"]), id })

export const battleSchema = z.strictObject({
  foes: z
    .array(
      z.strictObject({
        id,
        foe: id,
        /** 個体の外見を安定して選ぶ識別子。旧保存では未設定。 */
        appearanceId: id.optional(),
        hp: count,
        maxHp: z.number().int().positive(),
        status: z.array(status),
      })
    )
    .min(1),
  order: z.array(actorRef).min(2),
  turn: count,
  guarding: z.array(id),
  boss: z.boolean(),
})

export const phaseSchema = z.discriminatedUnion("type", [
  /** 始める前：主人公の外見と名前を決める。 */
  z.strictObject({ type: z.literal("creating") }),
  z.strictObject({ type: z.literal("town") }),
  z.strictObject({
    type: z.literal("expedition"),
    expedition: expeditionSchema,
  }),
  z.strictObject({
    type: z.literal("battle"),
    expedition: expeditionSchema,
    battle: battleSchema,
    /** 街・農場の単発戦闘。expeditionは既存戦闘の空の互換フレーム。探索として扱わない。 */
    townQuest: id.optional(),
  }),
])

export const stateSchema = z.strictObject({
  journey: z
    .strictObject({ at: id, visited: z.array(id), collected: z.array(id) })
    .optional(),
  conversation: z
    .strictObject({
      active: id.nullable(),
      last: id.nullable(),
      seen: z.array(id),
      /** 会話で立ったフラグ。従来の保存にはない。 */
      flags: z.array(id).optional(),
      /** 場所ごとに、最後に場面が始まった夜の数。同じ夜は二度始めない。 */
      visits: z.record(id, count).optional(),
    })
    .optional(),
  gold: count,
  stones: count,
  /** 主人公。ギルドの登録用紙で名前と容姿（写真）を決める。 */
  hero: z.strictObject({
    /** 登録の規則（全角カタカナ1〜6文字）より広く受け、古い保存の名前も読み込む。 */
    name: z.string().min(1).max(HERO_NAME_STORED_MAX),
    /** 選んだ外見の id（コンテンツの `hero.looks` のどれか）。 */
    look: id,
    /** 主人公の衣装。防具の個体とは独立した見た目だけの選択。 */
    outfit: id.nullable().optional(),
    /** 新しい開始手順の登録待ち。従来の保存にはなく、登録済みとして扱う。 */
    registrationPending: z.boolean().optional(),
  }),
  /** 雇っている仲間全員（出撃中の3人と控え）。始めたては主人公だけ。 */
  members: z.array(memberSchema).min(1),
  /** 出撃する仲間。隊列の並び順。3人そろうまで出撃できない。4人の古い保存は読み込み時に3人へ移す。 */
  party: z.array(id).min(1).max(PARTY_STORED_MAX),
  /** 道具と素材。 */
  bag: z.array(stack),
  /** 倉庫からの持ち出し設定。出撃時に在庫を確定し、探索中の使用で減る。旧保存は最初の8個を選ぶ。 */
  provisions: z
    .array(stack)
    .refine(
      (entries) => entries.reduce((total, entry) => total + entry.count, 0) <= 8
    )
    .optional(),
  /** 武器と防具は一つずつの個体。owner が装備している仲間。 */
  gear: z.array(
    z.strictObject({
      id,
      good: id,
      owner: id.nullable(),
      /** 拾った武器は鑑定まで正体・強化値・ワザが不明。旧保存は鑑定済み。 */
      unidentified: z.boolean().optional(),
      /** 鍛冶屋で強化した回数（ユニークの固有の武器は鍛え直した段）。 */
      plus: count,
      /** ユニークの固有の武器を鍛え直すときの、次の段までの手応え。ほかは0。 */
      progress: count,
      /** 防具の減った耐久（最大 − 今）。自然には戻らず、鍛冶屋で直す。武器は常に0。 */
      wear: count,
      /** 同じ武器でも個体ごとに変わる部分。防具は null。 */
      weapon: z
        .strictObject({
          rarity: z.enum(rarities),
          /** 武器の固定の攻撃力に足す上振れ分。 */
          extraPower: count,
          /** この個体に付く3つのワザ。先頭1つは武器で固定。 */
          skills: z.array(id).length(WEAPON_SKILLS),
        })
        .nullable(),
    })
  ),
  /** 契約した悪魔。同じ悪魔は重ならず、重なった分は経験値になる。始めたては空。 */
  demons: z.array(
    z.strictObject({ id, lv: z.number().int().positive(), exp: count })
  ),
  /** 戦闘で合体する悪魔。まだ契約していなければ null（合体の効果もワザもない）。 */
  contract: id.nullable(),
  /** 冒険者の募集の枠。引き直すまで残る。 */
  board: z.array(id),
  reached: count,
  /** 最後に出撃した層。まだ一度も出ていなければ null。 */
  lastLayer: id.nullable(),
  /** 最後の層のボスを倒した（ダンジョンを踏破した）。踏破後も遊べる。 */
  cleared: z.boolean(),
  /** 踏破の場面をもう見た。 */
  endingSeen: z.boolean(),
  /** 直前の全滅で失った物（と持ち帰れた物）。街で結果を見せ、閉じると null になる。 */
  wipe: z
    .strictObject({
      layer: id,
      gold: count,
      goods: z.array(stack),
      /** 正体が不明のまま失った武器。結果にも実名を出さない。 */
      unidentifiedWeapons: z.array(stack).optional(),
      /** 全滅しても持ち帰れたガラクタ（balance.wipe.keepJunk）。 */
      kept: z.array(stack).optional(),
    })
    .nullable(),
  quests: z.array(
    z.strictObject({ id, progress: count, claimed: z.boolean() })
  ),
  recruited: z.array(id),
  nights: count,
  /** 今夜すでに雑談した仲間。宿に泊まると空になる（一晩に仲間ひとりずつ一度）。 */
  chatted: z.array(id),
  phase: phaseSchema,
})

export type GameState = WizDeepReadonly<z.infer<typeof stateSchema>>
export type Member = GameState["members"][number]
/** 主人公の名前と外見。 */
export type Hero = GameState["hero"]
/** 武器・防具の個体。 */
export type Gear = GameState["gear"][number]
/** 武器の個体差（レア度・上振れ・3つのワザ）。 */
export type WeaponIndividual = NonNullable<Gear["weapon"]>
export type Expedition = WizDeepReadonly<z.infer<typeof expeditionSchema>>
export type Battle = WizDeepReadonly<z.infer<typeof battleSchema>>
export type FoeState = Battle["foes"][number]
export type Status = z.infer<typeof status>
export type Phase = GameState["phase"]
export type Stack = z.infer<typeof stack>
export type ActorRef = z.infer<typeof actorRef>
