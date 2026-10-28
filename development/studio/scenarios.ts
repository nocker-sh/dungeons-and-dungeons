import { layoutPatterns } from "@/development/studio/layout-pattern"
import { previews } from "@/development/scenarios/index"
import { studioCharacters } from "@/development/studio/studio-content"

export const studioMembers = [
  { slug: "hero", name: "あなた" },
  ...studioCharacters,
]

export const studioScenes = [
  { slug: "battle", title: "戦闘（組み合わせ）" },
  { slug: "components", title: "コンポーネント・演出" },
  ...previews().filter((entry) => entry.slug !== "battle"),
  ...layoutPatterns,
]
