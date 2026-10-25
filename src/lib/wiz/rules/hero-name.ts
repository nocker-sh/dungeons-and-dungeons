import { HERO_NAME_MAX } from "@/lib/wiz/content"

/** 全角カタカナ（ァ〜ヶ）と長音「ー」だけの並び。 */
const KATAKANA_ONLY = /^[ァ-ヶー]+$/u

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

/**
 * 名前の欄に入った文字を、名前に使える文字だけにする（入力欄の補助）。
 * 半角カタカナは全角へ、ひらがなはカタカナへ寄せ、全角カタカナと長音のほかは落とす。
 */
export function katakanaOf(raw: string): string {
  return Array.from(
    raw
      .normalize("NFKC")
      .replace(/[ぁ-ゖ]/gu, (letter) =>
        String.fromCharCode(letter.charCodeAt(0) + 0x60)
      )
  )
    .filter((letter) => KATAKANA_ONLY.test(letter))
    .join("")
}
