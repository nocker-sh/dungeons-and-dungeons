export const devCategories = [
  { value: "player", label: "プレイヤー" },
  { value: "characters", label: "キャラ" },
  { value: "residents", label: "住民" },
  { value: "demons", label: "悪魔" },
  { value: "backgrounds", label: "背景" },
  { value: "monsters", label: "モンスター" },
  { value: "weapons", label: "武器" },
  { value: "armor", label: "防具" },
  { value: "items", label: "道具" },
  { value: "materials", label: "素材" },
  { value: "conversations", label: "会話" },
  { value: "effects", label: "Effects" },
] as const

export type DevCategory = (typeof devCategories)[number]["value"]
export type DevDataCategory = Exclude<DevCategory, "conversations" | "effects">
