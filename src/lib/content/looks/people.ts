import { outfitImage } from "@/lib/concept/outfits"
import { hero, people, tuning, lines, sayings } from "./data"
import type { Person, Portraits } from "./types"

/** 絵がまだない者の仮の影絵。 */
export const PLACEHOLDER = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 300"><path d="M100 28 L128 40 L136 78 L122 108 L160 124 L184 300 L16 300 L40 124 L78 108 L64 78 L72 40Z" fill="#1b2030" stroke="#eeebe3" stroke-width="5" stroke-linejoin="miter"/><path d="M80 70 L96 76 L82 80Z M120 70 L104 76 L118 80Z" fill="#eeebe3"/></svg>`
)}`

/** 資料の人物（主人公は外見の資料から）。 */
export function personOf(id: string): Person | undefined {
  return hero.get(id) ?? people.get(id)
}

/** 立ち絵。表情がなければ通常。 */
export function portraitOf(
  id: string,
  state: keyof Portraits = "normal"
): string {
  const person = personOf(id)
  return (
    (state === "skill"
      ? person?.bustPortraits?.normal
      : (person?.bustPortraits?.[state] ?? person?.bustPortraits?.normal)) ??
    person?.portraits?.[state] ??
    person?.portraits?.normal ??
    person?.image ??
    PLACEHOLDER
  )
}

/** 使用するワザに対応する上半身。未登録のワザは通常絵へ戻す。 */
export function skillPortraitOf(id: string, skill: string): string {
  return personOf(id)?.skillPortraits?.[skill] ?? portraitOf(id, "skill")
}

/**
 * 仲間の必殺技の専用イラスト（`skillPortraits` にワザの id で登録した絵）。
 * 未登録なら null を返し、画面はいつもの立ち絵でワザを見せる。
 */
export function specialArtOf(id: string, skill: string): string | null {
  return personOf(id)?.skillPortraits?.[skill] ?? null
}

export type Frame = {
  img: string
  /** 上半身の絵。隊列の札や行動順の顔に使う。なければ立ち絵を切り抜く。 */
  bust?: string
  fx: number
  fy: number
  zoom: number
  ratio: number
  color: string
  line: string
}

/** 仲間の見た目：立ち絵・上半身の絵・顔の位置・色・ひとこと。 */
export function frameOf(
  id: string,
  armor?: string | null,
  pactMode?: number
): Frame {
  const person = personOf(id)
  const tune = { ...tuning.defaults, ...tuning.members[id] }
  const outfit = outfitImage(id, armor)
  const contract =
    pactMode === undefined
      ? undefined
      : person?.contractModes?.[pactMode]?.battlePortrait
  const said = sayings(id).find((entry) => entry.scene === "ひとこと")?.text
  return {
    img: contract ?? outfit ?? portraitOf(id),
    bust: contract ?? outfit ?? person?.bustPortraits?.normal ?? person?.image,
    fx: 0.5,
    fy: 0.25,
    zoom: 1.6,
    ratio: 4 / 3,
    color: tune.color,
    line: said ?? lines.members[id] ?? "",
  }
}
