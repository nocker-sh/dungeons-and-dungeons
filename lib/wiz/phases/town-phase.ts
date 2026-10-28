import type { MemberTurnPhase } from "@/lib/wiz/phases/member-turn-phase"
import type { FoeTurnPhase } from "@/lib/wiz/phases/foe-turn-phase"
import type { ConversationPhase } from "@/lib/wiz/phases/conversation-phase"
import type { GameAction } from "@/lib/wiz/commands"
import { PhaseBase } from "@/lib/wiz/phases/phase-base"
import type { ExpeditionPhase } from "@/lib/wiz/phases/expedition-phase"

/** 街：施設・買い物・編成・出撃。 */
export class TownPhase extends PhaseBase {
  readonly kind = "town"

  chooseHeroLook(look: string, outfit?: string | null) {
    return this.#stay({
      type: "choose-hero-look",
      look,
      ...(outfit !== undefined ? { outfit } : {}),
    })
  }

  /** 登録用紙に名前を書き、写真（容姿）を選んで登録する。 */
  registerHero(name: string, look?: string) {
    return this.#stay({
      type: "register-hero",
      name,
      ...(look !== undefined ? { look } : {}),
    })
  }

  startConversation(trigger: "inn") {
    return this.send<ConversationPhase>(
      { type: "start-conversation", trigger },
      ["conversation"]
    )
  }

  /** 街の住人に話しかける。 */
  talkTo(resident: string) {
    return this.send<ConversationPhase>(
      { type: "start-conversation", trigger: "talk", resident },
      ["conversation"]
    )
  }

  /** 街の場所に入る。条件と確率に当たれば場面が始まる。 */
  visit(place: string) {
    return this.send<ConversationPhase>(
      { type: "start-conversation", trigger: "visit", place },
      ["conversation"]
    )
  }

  pack(good: string, count: number) {
    return this.#stay({ type: "pack", good, count })
  }

  depart(layer: string) {
    return this.send<ExpeditionPhase>({ type: "depart", layer }, ["expedition"])
  }
  /** 主人公の名前を変える（立ち絵の画面から）。 */
  renameHero(name: string) {
    return this.#stay({ type: "rename-hero", name })
  }
  rest(room: string) {
    return this.#stay({ type: "rest", room })
  }
  buy(shop: string, good: string) {
    return this.#stay({ type: "buy", shop, good })
  }
  sellGood(good: string) {
    return this.#stay({ type: "sell", good })
  }
  sellGear(gear: string) {
    return this.#stay({ type: "sell", gear })
  }
  /** ガラクタを一つ鑑定する。rare なら光るガラクタ（必ず R 以上の武器）。 */
  appraise(shop: string, rare = false, gear?: string) {
    if (gear) return this.#stay({ type: "appraise", shop, gear })
    return this.#stay(
      rare ? { type: "appraise", shop, rare } : { type: "appraise", shop }
    )
  }
  recruit(recruit: string) {
    return this.#stay({ type: "recruit", recruit })
  }
  reroll() {
    return this.#stay({ type: "reroll" })
  }
  summon() {
    return this.#stay({ type: "summon" })
  }
  contractDemon(demon: string) {
    return this.#stay({ type: "contract-demon", demon })
  }
  invokeDemon(demon: string) {
    return this.send<ConversationPhase>({ type: "invoke-demon", demon }, [
      "conversation",
    ])
  }
  moveWorld(tile: string) {
    return this.#stay({ type: "move-world", tile })
  }
  travelWorld(tile: string) {
    return this.#stay({ type: "travel-world", tile })
  }
  visitWorld() {
    return this.send<TownPhase | ConversationPhase>({ type: "visit-world" }, [
      "town",
      "conversation",
    ])
  }
  chooseDemon(demon: string) {
    return this.#stay({ type: "choose-demon", demon })
  }
  upgrade(gear: string) {
    return this.#stay({ type: "upgrade", gear })
  }
  /** ユニークの固有の武器を、拾った武器を素材にして鍛え直す。 */
  reforge(gear: string, material: string) {
    return this.#stay({ type: "reforge", gear, material })
  }
  /** 全滅の結果を閉じる。 */
  dismissWipe() {
    return this.#stay({ type: "dismiss-wipe" })
  }
  /** 踏破の場面を見終える。 */
  seeEnding() {
    return this.#stay({ type: "see-ending" })
  }
  /** 防具の耐久を直す。member を省くと着けている防具すべて。 */
  repair(member?: string) {
    return this.#stay({ type: "repair", member })
  }
  craft(recipe: string) {
    return this.#stay({ type: "craft", recipe })
  }
  inscribe(gear: string, slot: number, skill: string) {
    return this.#stay({ type: "inscribe", gear, slot, skill })
  }
  fightQuest(quest: string) {
    return this.send<MemberTurnPhase | FoeTurnPhase>(
      { type: "fight-quest", quest },
      ["member-turn", "foe-turn"]
    )
  }
  acceptQuest(quest: string) {
    return this.#stay({ type: "accept-quest", quest })
  }
  claimQuest(quest: string) {
    return this.#stay({ type: "claim-quest", quest })
  }
  chat(liked: string) {
    return this.#stay({ type: "chat", liked })
  }
  equip(gear: string, member: string) {
    return this.#stay({ type: "equip", gear, member })
  }
  unequip(gear: string) {
    return this.#stay({ type: "unequip", gear })
  }
  swap(out: string, incoming: string) {
    return this.#stay({ type: "swap", out, in: incoming })
  }
  swapRows(a: string, b: string) {
    return this.#stay({ type: "swap-rows", a, b })
  }
  use(good: string, member?: string) {
    return this.#stay({ type: "use", good, member })
  }

  #stay(action: GameAction) {
    return this.send<TownPhase>(action, ["town"])
  }
}
