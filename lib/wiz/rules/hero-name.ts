import { HERO_NAME_MAX } from "@/lib/wiz/content/constants"

/** 全角カタカナ（ァ〜ヶ）と長音「ー」だけの並び。 */
export const KATAKANA_ONLY = /^[ァ-ヶー]+$/u

/**
 * 入れた名前を整える。前後の空白を落とし、全角カタカナ（長音ー含む）1〜6文字でなければ null（受け付けない）。
 * 画面と規則で同じ判定を使うため、ここだけに置く。
 */
export function heroName(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (Array.from(trimmed).length > HERO_NAME_MAX) return null
  if (!KATAKANA_ONLY.test(trimmed)) return null
  return trimmed
}
