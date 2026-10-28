import { conversationTriggers } from "@/lib/wiz/conversations/schema"
import { z } from "zod"
import type { WizDeepReadonly } from "@/lib/wiz/core/immutable-value"

const id = z.string().min(1)

/** 画面から送れる操作。外部入力はこのschemaで検証してから規則へ渡す。 */
export const commands = {
  startConversation: z.strictObject({
    type: z.literal("start-conversation"),
    trigger: z.enum(conversationTriggers),
    /** talk で話しかけた住人。 */
    resident: id.optional(),
    /** visit で入った場所。 */
    place: id.optional(),
  }),
  finishConversation: z.strictObject({
    type: z.literal("finish-conversation"),
    /** 選んだ答えの番号。選択肢のない会話では省く。 */
    choice: z.number().int().nonnegative().optional(),
  }),
  /** 始めるときに、主人公の外見と名前を決める。 */
  createHero: z.strictObject({
    type: z.literal("create-hero"),
    name: z.string(),
    look: id,
  }),
  /** 主人公の名前を変える。 */
  renameHero: z.strictObject({
    type: z.literal("rename-hero"),
    name: z.string(),
  }),
  chooseHeroLook: z.strictObject({
    type: z.literal("choose-hero-look"),
    look: id,
    outfit: id.nullable().optional(),
  }),
  /** 登録用紙に名前を書き、写真（容姿）を選ぶ。look を省くと今の容姿。 */
  registerHero: z.strictObject({
    type: z.literal("register-hero"),
    name: z.string(),
    look: id.optional(),
  }),
  /** 開幕の野営を終えて街へ着く。 */
  leaveCamp: z.strictObject({ type: z.literal("leave-camp") }),
  pack: z.strictObject({
    type: z.literal("pack"),
    good: id,
    count: z.number().int().min(0).max(8),
  }),
  depart: z.strictObject({ type: z.literal("depart"), layer: id }),
  advance: z.strictObject({ type: z.literal("advance"), to: id }),
  survey: z.strictObject({ type: z.literal("survey"), to: id }),
  discover: z.strictObject({
    type: z.literal("discover"),
    choice: id,
    skill: id.optional(),
    member: id.optional(),
  }),
  inscribe: z.strictObject({
    type: z.literal("inscribe"),
    gear: id,
    slot: z.number().int().min(1).max(2),
    skill: id,
  }),
  acknowledge: z.strictObject({ type: z.literal("acknowledge") }),
  retreat: z.strictObject({ type: z.literal("retreat") }),
  act: z.strictObject({
    type: z.literal("act"),
    /** pact：悪魔と契約して戦う仲間（R）の「ケイヤク」。モードを変えて手番を使う。 */
    command: z.enum(["skill", "guard", "item", "brawl", "pact"]),
    skill: id.optional(),
    good: id.optional(),
    /** ケイヤクで変えるモードの番号。 */
    mode: z.number().int().nonnegative().optional(),
    /** 狙う敵、または助ける仲間。省略で自動。 */
    target: id.optional(),
  }),
  foeTurn: z.strictObject({ type: z.literal("foe-turn") }),
  rest: z.strictObject({ type: z.literal("rest"), room: id }),
  buy: z.strictObject({ type: z.literal("buy"), shop: id, good: id }),
  sell: z.union([
    z.strictObject({
      type: z.literal("sell"),
      good: id,
      gear: z.undefined().optional(),
    }),
    z.strictObject({
      type: z.literal("sell"),
      gear: id,
      good: z.undefined().optional(),
    }),
  ]),
  appraise: z.strictObject({
    type: z.literal("appraise"),
    shop: id,
    /** 光るガラクタを鑑定する（必ず R 以上の武器）。 */
    rare: z.boolean().optional(),
    /** 拾った未鑑定武器の個体を調べる。抽選し直さない。 */
    gear: id.optional(),
  }),
  equip: z.strictObject({ type: z.literal("equip"), gear: id, member: id }),
  unequip: z.strictObject({ type: z.literal("unequip"), gear: id }),
  swap: z.strictObject({ type: z.literal("swap"), out: id, in: id }),
  swapRows: z.strictObject({ type: z.literal("swap-rows"), a: id, b: id }),
  use: z.strictObject({
    type: z.literal("use"),
    good: id,
    member: id.optional(),
  }),
  recruit: z.strictObject({ type: z.literal("recruit"), recruit: id }),
  summon: z.strictObject({ type: z.literal("summon") }),
  invokeDemon: z.strictObject({ type: z.literal("invoke-demon"), demon: id }),
  moveWorld: z.strictObject({ type: z.literal("move-world"), tile: id }),
  visitWorld: z.strictObject({ type: z.literal("visit-world") }),
  travelWorld: z.strictObject({ type: z.literal("travel-world"), tile: id }),
  contractDemon: z.strictObject({
    type: z.literal("contract-demon"),
    demon: id,
  }),
  chooseDemon: z.strictObject({ type: z.literal("choose-demon"), demon: id }),
  reroll: z.strictObject({ type: z.literal("reroll") }),
  upgrade: z.strictObject({ type: z.literal("upgrade"), gear: id }),
  /** ユニークの固有の武器を、拾った武器（material）を素材にして鍛え直す。 */
  reforge: z.strictObject({
    type: z.literal("reforge"),
    gear: id,
    material: id,
  }),
  dismissWipe: z.strictObject({ type: z.literal("dismiss-wipe") }),
  seeEnding: z.strictObject({ type: z.literal("see-ending") }),
  /** 防具の耐久を直す。member を省くと着けている防具すべて。 */
  repair: z.strictObject({
    type: z.literal("repair"),
    member: id.optional(),
  }),
  craft: z.strictObject({ type: z.literal("craft"), recipe: id }),
  fightQuest: z.strictObject({ type: z.literal("fight-quest"), quest: id }),
  acceptQuest: z.strictObject({ type: z.literal("accept-quest"), quest: id }),
  claimQuest: z.strictObject({ type: z.literal("claim-quest"), quest: id }),
  chat: z.strictObject({ type: z.literal("chat"), liked: id }),
}

export type GameAction = WizDeepReadonly<
  z.infer<(typeof commands)[keyof typeof commands]>
>
export type GameActionOf<T extends GameAction["type"]> = Extract<
  GameAction,
  { type: T }
>
export type BattleCommand = GameActionOf<"act">["command"]
