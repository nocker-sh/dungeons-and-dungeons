import type { Game, GameEvent } from "@/lib/wiz"

/** 戦闘の見え方（エンジンのQueryが返す形）。 */
export type BattleView = NonNullable<ReturnType<Game["queries"]["battle"]>>
export type FoeView = BattleView["foes"][number]
/** 再生中だけ保つ攻撃の絵。同じ攻撃の途中で別ポーズへ切り替えない。 */
export type FoeAttack = { id: string; skill?: string }
/** 手番の仲間が選べる指示。 */
export type Commands = NonNullable<ReturnType<Game["queries"]["commands"]>>
export type Acted = Extract<GameEvent, { type: "acted" }>
export type Menu = "command" | "skill" | "item" | "pact" | null

export const STATUS_WORDS: Record<string, string> = {
  poison: "毒！",
  bind: "縛り！",
  charge: "溜め！",
  protect: "守り！",
  regen: "再生！",
  taunt: "挑発！",
}

/**
 * ワザの添え書き。札の中では折り返さず、長いと右へはみ出て切れるので、
 * 流派・相性・代償のような読み落とせない印を先に置き、説明を後ろへ回す。
 */
export function skillNote(skill: Commands["skills"][number], extra?: string) {
  const marks = [
    skill.schoolName ? `流派：${skill.schoolName}` : null,
    skill.affinity ? "相性◎" : null,
    skill.blocked ? "流派が合わない" : null,
    skill.cost ? `代償 HP−${skill.cost}` : null,
    skill.weak ? "後衛から近接：威力半分" : null,
    extra ?? null,
  ].filter(Boolean)
  return marks.length ? `${marks.join("・")}／${skill.desc}` : skill.desc
}

/** 戦闘の進み方。突入 → 敵が落ちてくる → 指示 → 終わり。 */
export type BattlePhase = "intro" | "stage" | "fight" | "end"
