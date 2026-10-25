import {
  HERO_NAME_MAX,
  HERO_REGISTERED_FLAG,
  PARTY_SLOTS,
  type GameCatalog,
} from "@/lib/wiz/content"
import { ConversationRules } from "@/lib/wiz/conversations/conversation-rules"
import { heroName } from "@/lib/wiz/rules"
import type { GameState } from "@/lib/wiz/state"

/**
 * 主人公の見え方：決めた名前と外見、選べる外見の候補、名前の決まり。
 * 外見の絵と名前は画面側が同じ id から引く（エンジンは id だけを持つ）。
 */
export class HeroViews {
  constructor(private readonly catalog: GameCatalog) {}

  hero(state: GameState) {
    const companionId = this.catalog.data.startingDemon
    const companion =
      companionId && state.demons.some((entry) => entry.id === companionId)
        ? this.catalog.demon(companionId)
        : null
    const conversations = new ConversationRules(this.catalog)
    return {
      companion: companion
        ? {
            id: companion.id,
            name: companion.name,
            canTalk:
              conversations.canStart(state, "talk", {
                resident: companion.id,
              }) &&
              conversations.available(state, "talk", { resident: companion.id })
                .length > 0,
          }
        : null,
      name: state.hero.name,
      look: state.hero.look,
      outfit: state.hero.outfit ?? null,
      outfits: (this.catalog.data.hero.outfits ?? []).map((id) => ({
        id,
        name: this.catalog.good(id)?.name ?? id,
      })),
      registrationPending: state.hero.registrationPending === true,
      /** 名前の文字数の上限。 */
      maxName: HERO_NAME_MAX,
      /** 名前の初期の案。 */
      suggestion: this.catalog.data.hero.name,
      /** まだ街に出ていない（容姿を決める場面）。 */
      creating: state.phase.type === "creating",
      /** 選べる外見。 */
      looks: this.catalog.data.hero.looks.map((look) => ({
        id: look,
        chosen: look === state.hero.look,
      })),
    }
  }

  /** 新しい開始手順だけを案内。募集の進捗は所持仲間から求め、保存からも再開できる。 */
  onboarding(state: GameState) {
    if (
      state.phase.type !== "town" ||
      state.hero.registrationPending === undefined ||
      state.lastLayer !== null
    )
      return null
    const remaining = Math.max(0, PARTY_SLOTS - state.members.length)
    const step = state.hero.registrationPending
      ? "register"
      : remaining
        ? "recruit"
        : "depart"
    return {
      step,
      remaining,
      count: Math.min(PARTY_SLOTS, state.members.length),
      total: PARTY_SLOTS,
    } as const
  }

  /**
   * はじめから遊ぶときの流れ。ギルドで登録 → 初出撃の順に自動で進め、その間は街を歩かせない。
   * 戦闘より先に登録するので、戦闘の札と見せ場には登録した名前と容姿が出る。初出撃で終わる。
   * 登録の印（`hero:registered`）のない旧保存は対象にしない。
   */
  prologue(state: GameState): "register" | "depart" | null {
    if (state.lastLayer !== null || state.phase.type !== "town") return null
    if (state.hero.registrationPending) return "register"
    const registered =
      state.conversation?.flags?.includes(HERO_REGISTERED_FLAG) ?? false
    return registered && state.members.length >= PARTY_SLOTS ? "depart" : null
  }

  /** 入れた名前を受け付けられるか（前後の空白を落として、空でなく長すぎない）。 */
  nameAccepted(raw: string) {
    return heroName(raw) !== null
  }
}
