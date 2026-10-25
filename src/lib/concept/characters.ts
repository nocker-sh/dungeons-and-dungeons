import data from "./data/characters.json"
import type {
  BustPortraitSlots,
  BustPortraitState,
  PortraitSlots,
} from "./portrait-types"

export interface ConceptCharacter {
  id: string
  slug: string
  name: string
  title?: string
  job?: string
  role: string
  rarity?: string
  unique?: boolean
  equipmentChangeable?: boolean
  weapon?: string
  shield?: string
  introduction: string
  portraits?: PortraitSlots
  bustPortraits?: BustPortraitSlots
  bustPortraitVersions?: {
    version: string
    portraits: Partial<BustPortraitSlots>
  }[]
  /** 敵へ向いた背面の上半身。 */
  battleRearPortrait?: string
  skillPortraits?: Partial<Record<string, string>>
  specialMotion?: string
  costumePortraits?: {
    slug: string
    name: string
    image: string
    portraits?: Partial<Record<BustPortraitState, string>>
  }[]
  contractModes?: {
    weapon: string
    name: string
    level: number
    description: string
    costume: string
    bargain?: {
      partner: string
      borrow: string
      price: string
    }
    roles?: string[]
    combatStyle?: string
    battlePortrait: string
  }[]
  image?: string
}

export const characterGroups: {
  label: string
  characters: ConceptCharacter[]
}[] = data.map((group) => ({
  ...group,
  characters: group.characters.map((character) => ({
    ...character,
    image:
      (group.label === "契約する悪魔" && "bustPortraits" in character
        ? character.bustPortraits?.normal
        : character.portraits.normal) ?? undefined,
  })),
}))
