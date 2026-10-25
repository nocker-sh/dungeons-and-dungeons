import type { EventKind, Rarity, StatusKind } from "@/lib/wiz/content"
import type { ActionResult } from "@/lib/wiz/state/action-result"
import type { LevelUp } from "@/lib/wiz/state/level-up"
import type { ActorRef, Stack } from "@/lib/wiz/state/state-schema"

/** 操作の結果として画面へ渡す出来事。演出はこの並びから組み立てる。 */
export type GameEvent =
  | Readonly<{ type: "surveyed"; station: string; kind: EventKind }>
  | Readonly<{ type: "hero-look-chosen"; look: string }>
  | Readonly<{ type: "hero-registered"; name: string; look: string }>
  /** 開幕の野営を終えて街へ着いた。 */
  | Readonly<{ type: "camp-left" }>
  | Readonly<{ type: "inscribed"; gear: string; slot: number; skill: string }>
  /** 主人公を作った（外見と名前を決めた）。 */
  | Readonly<{ type: "hero-created"; name: string; look: string }>
  /** 主人公の名前を変えた。 */
  | Readonly<{ type: "hero-renamed"; name: string }>
  | Readonly<{ type: "packed"; good: string; count: number }>
  | Readonly<{ type: "departed"; layer: string }>
  | Readonly<{
      type: "arrived"
      station: string
      kind: EventKind
    }>
  | Readonly<{ type: "treasure"; gold: number; goods: readonly Stack[] }>
  | Readonly<{ type: "discovered"; choice: string }>
  | Readonly<{ type: "trap"; damage: number }>
  | Readonly<{ type: "encounter"; foes: readonly string[]; boss: boolean }>
  | Readonly<{
      type: "acted"
      actor: ActorRef
      command: "attack" | "skill" | "guard" | "item" | "brawl" | "pact"
      name: string
      skill?: string
      good?: string
      /** ケイヤクで変えたモードの番号。 */
      mode?: number
      /** 自分を削って放つワザで払ったHP（悪魔の流派）。 */
      paid?: number
      results: readonly ActionResult[]
    }>
  /** 毒・再生など、手番の終わりに動いたHP。 */
  | Readonly<{
      type: "ticked"
      target: ActorRef
      status: StatusKind
      /** 毒で失ったHP。 */
      damage?: number
      /** 再生で戻ったHP。 */
      heal?: number
      down: boolean
    }>
  /** 縛られて手番を飛ばした。 */
  | Readonly<{ type: "skipped"; actor: ActorRef; status: StatusKind }>
  | Readonly<{
      type: "victory"
      exp: number
      gold: number
      goods: readonly Stack[]
      boss: boolean
      /** 中ボス・ボスが落とした召喚石。 */
      stones?: number
      /** 敵が落とした武器の個体の id。 */
      weapons?: readonly string[]
    }>
  | Readonly<{ type: "layer-cleared"; layer: string; opened: string | null }>
  /** 最後の層のボスを倒した（踏破）。 */
  | Readonly<{ type: "game-cleared"; layer: string }>
  | Readonly<{ type: "defeated" }>
  /** 全滅の結果を閉じた。 */
  | Readonly<{ type: "wipe-dismissed" }>
  /** 踏破の場面を見終えた。 */
  | Readonly<{ type: "ending-seen" }>
  | Readonly<{
      type: "returned"
      gold: number
      goods: readonly Stack[]
      /** 中ボスを倒してから戻ったときの金貨の手当て。 */
      bonus: number
    }>
  | Readonly<{ type: "acknowledged" }>
  | Readonly<{ type: "rested"; room: string; levelUps: readonly LevelUp[] }>
  | Readonly<{ type: "bought"; good: string; price: number }>
  | Readonly<{ type: "sold"; good: string; price: number }>
  | Readonly<{
      type: "appraised"
      good: string
      /** 武器・防具なら生まれた個体。袋に入る品物は null。 */
      gear: string | null
      /** 武器なら引いたレア度。 */
      rarity: Rarity | null
    }>
  | Readonly<{
      type: "equipped"
      gear: string
      member: string
      replaced: string | null
    }>
  | Readonly<{ type: "unequipped"; gear: string; member: string }>
  | Readonly<{ type: "swapped"; out: string; in: string }>
  | Readonly<{ type: "rows-swapped"; front: string; back: string }>
  | Readonly<{ type: "used"; good: string; results: readonly ActionResult[] }>
  | Readonly<{ type: "recruited"; member: string }>
  | Readonly<{
      type: "summoned"
      demon: string
      /** はじめての悪魔。false なら経験値になった。 */
      fresh: boolean
      lv: number
      /** 経験値でレベルが上がった数。 */
      leveled: number
    }>
  | Readonly<{ type: "summon-failed"; goods: readonly Stack[] }>
  | Readonly<{ type: "demon-contracted"; demon: string }>
  | Readonly<{ type: "demon-chosen"; demon: string }>
  | Readonly<{ type: "rerolled"; board: readonly string[] }>
  | Readonly<{ type: "upgraded"; gear: string; plus: number }>
  /** ユニークの固有の武器を、拾った武器を素材にして鍛え直した。 */
  | Readonly<{
      type: "reforged"
      gear: string
      /** 素材にした武器の個体。 */
      material: string
      /** 得た手応え。 */
      gained: number
      /** 鍛え直した後の段。 */
      plus: number
      /** 次の段までの残りの手応え。 */
      progress: number
    }>
  /** 鍛冶屋で防具の耐久を直した。 */
  | Readonly<{
      type: "repaired"
      /** 直した防具の個体。 */
      gears: readonly string[]
      /** 戻した耐久の合計。 */
      durability: number
      gold: number
    }>
  | Readonly<{
      type: "crafted"
      recipe: string
      good: string
      gear: string | null
    }>
  | Readonly<{ type: "quest-accepted"; quest: string }>
  | Readonly<{ type: "quest-claimed"; quest: string; gold: number }>
  | Readonly<{ type: "chatted"; liked: string }>
