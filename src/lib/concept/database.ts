import { characterGroups } from "./characters"
import world from "./data/world.json"
import type { BustPortraitSlots, PortraitSlots } from "./portrait-types"

export interface ConceptEntry {
  id: string
  slug: string
  name: string
  title?: string
  category: string
  section?: string
  job?: string
  role: string
  rarity?: string
  unique?: boolean
  equipmentChangeable?: boolean
  weapon?: string
  shield?: string
  introduction?: string
  /** 敵の攻撃中に使う3:4の全身画像。 */
  attackImage?: string
  attackImages?: string[]
  attack?: { name: string; reach: "melee" | "ranged" }
  skillNames?: Record<string, string>
  /** 敵が倒れたときに使う3:4の全身画像。 */
  defeatedImage?: string
  /** 敵が眠っているときの3:4の全身画像。 */
  sleepingImage?: string
  portraits?: PortraitSlots
  bustPortraits?: BustPortraitSlots
  bustPortraitVersions?: import("./characters").ConceptCharacter["bustPortraitVersions"]
  /** 敵へ向いた仲間の背面の上半身。 */
  battleRearPortrait?: string
  skillPortraits?: Partial<Record<string, string>>
  specialMotion?: string
  costumePortraits?: import("./characters").ConceptCharacter["costumePortraits"]
  contractModes?: import("./characters").ConceptCharacter["contractModes"]
  image?: string
  /** 同種の個体差。通常・攻撃・退場の絵を同じ個体に揃える。 */
  appearances?: {
    /** devの個体別ページで使う名前とURL。戦闘の敵IDは増やさない。 */
    slug?: string
    name?: string
    image: string
    attackImage?: string
    attackImages?: string[]
    skillPortraits?: Partial<Record<string, string>>
    sleepingImage?: string
    defeatedImage?: string
  }[]
  /** 横長の画面向けに構図を組み直した背景。 */
  wideImage?: string
  /** 戦闘用の背景（縦・横）。敵が立つ床を広く取った別の絵。 */
  battleImage?: string
  battleWideImage?: string
}

export const conceptEntries: ConceptEntry[] = [
  ...characterGroups.flatMap((group) =>
    group.characters.map((character) => ({
      ...character,
      category: group.label,
    }))
  ),
  ...(world as ConceptEntry[]),
]

export const conceptCategories = [
  ...new Set(conceptEntries.map((entry) => entry.category)),
]
