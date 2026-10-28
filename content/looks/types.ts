import type { BustPortraitState } from "@/concept/portrait-types"

export type Portraits = Partial<
  Record<
    | "normal"
    | "talk"
    | "happy"
    | "sigh"
    | "angry"
    | "surprised"
    | "surprisedLarge"
    | "thinking"
    | "shy"
    | "skill",
    string | null
  >
>
export type Person = {
  id: string
  name: string
  role?: string
  job?: string
  introduction?: string
  portraits?: Portraits
  bustPortraits?: Partial<Omit<Portraits, "skill">>
  skillPortraits?: Partial<Record<string, string>>
  contractModes?: import("@/concept/characters").ConceptCharacter["contractModes"]
  image?: string
}
export type Place = {
  id: string
  slug?: string
  name: string
  image?: string
  wideImage?: string
  /** 戦闘用の背景（敵が立つ床を広く取った別の絵）。なければ image / wideImage。 */
  battleImage?: string
  battleWideImage?: string
  attackImage?: string
  attackImages?: string[]
  skillPortraits?: Partial<Record<string, string>>
  sleepingImage?: string
  defeatedImage?: string
  appearances?: {
    image: string
    attackImage?: string
    attackImages?: string[]
    skillPortraits?: Partial<Record<string, string>>
    sleepingImage?: string
    defeatedImage?: string
  }[]
  note?: string
  /** 層の背景の候補。key はエンジンが選ぶ識別子、kind は道中・宝箱・休憩。 */
  scenes?: LayerSceneArt[]
  /** 店主・案内人が背景のどこにどの大きさで立つか（画面に対する割合）。縦長と横長で別。 */
  stands?: { narrow: Stand[]; wide: Stand[] }
  /** 吹き出しの先端を置く入口の位置（画像の左上0・右下1）。縦長の絵と横長の絵で別。 */
  entrances?: {
    narrow: Record<string, readonly [number, number]>
    wide: Record<string, readonly [number, number]>
  }
}
/** 立ち絵の枠の左端・下端・高さ（CSS の長さ）。 */
/** 立ち位置。足元は常に画面の下に付くので、横の位置と高さだけを持つ。 */
export type Stand = { left: string; height: string }
export type LayerSceneArt = {
  key: string
  kind: "path" | "treasure" | "rest"
  image: string
  wideImage?: string
}
export type Tuning = {
  fx?: number
  fy?: number
  zoom?: number
  ratio?: number
  color?: string
}

/** 夜の雑談。who は仲間の id。選択肢は親しみが上がる相手を持つ。 */
export type NightTalk = {
  pair: readonly [string, string]
  lines: readonly (readonly [
    who: string,
    text: string,
    expression?: Exclude<BustPortraitState, "special">,
  ])[]
  choice: {
    ask: string
    options: readonly (readonly [
      label: string,
      who: string,
      reply: string,
      expression?: Exclude<BustPortraitState, "special">,
    ])[]
  }
}
