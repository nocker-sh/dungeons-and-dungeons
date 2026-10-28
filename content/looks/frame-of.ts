import { outfitImage } from "@/concept/outfits"
import { tuning, lines, sayings } from "@/content/looks/data"
import { personOf } from "@/content/looks/person-of"
import { portraitOf } from "@/content/looks/portrait-of"

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
