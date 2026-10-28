import demons from "@/content/data/demons.json"
import foes from "@/content/data/foes.json"
import { people, places, tuning } from "@/content/looks/data"
import { portraitOf } from "@/content/looks/portrait-of"

/** 悪魔：立ち絵と説明は資料から。 */
export const DEMON_ART: Record<
  string,
  { img: string; fx: number; color: string; note: string }
> = Object.fromEntries(
  [
    ...new Set([
      ...demons.map((entry) => entry.id),
      ...Object.keys(tuning.demons),
    ]),
  ].map((id) => {
    const tune = { ...tuning.defaults, ...tuning.demons[id] }
    return [
      id,
      {
        img: portraitOf(id),
        fx: tune.fx,
        color: tune.color,
        note: people.get(id)?.introduction ?? "",
      },
    ]
  })
)

/** 敵：通常と攻撃中の全身画像は資料の world から。 */
export const FOE_ART: Record<
  string,
  {
    img?: string
    attack?: string
    attacks?: string[]
    skills?: Partial<Record<string, string>>
    sleeping?: string
    defeated?: string
    glow: string
    appearances?: {
      img: string
      attack?: string
      attacks?: string[]
      skills?: Partial<Record<string, string>>
      sleeping?: string
      defeated?: string
    }[]
  }
> = Object.fromEntries(
  foes.map((entry) => {
    const place = places.get(entry.id)
    return [
      entry.id,
      {
        img: place?.image,
        attack: place?.attackImage,
        attacks: place?.attackImages,
        skills: place?.skillPortraits,
        sleeping: place?.sleepingImage,
        defeated: place?.defeatedImage,
        appearances: place?.appearances?.map((appearance) => ({
          img: appearance.image,
          attack: appearance.attackImage,
          attacks: appearance.attackImages,
          skills: appearance.skillPortraits,
          sleeping: appearance.sleepingImage,
          defeated: appearance.defeatedImage,
        })),
        glow: tuning.foes[entry.id]?.glow ?? "#aa9fd4",
      },
    ]
  })
)
