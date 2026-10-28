import { KATAKANA_ONLY } from "@/lib/wiz/rules/hero-name"

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
