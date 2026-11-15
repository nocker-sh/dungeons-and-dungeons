import { layoutPatterns } from "@/development/studio/layout-pattern"
import { previews } from "@/development/scenarios/index"
import { studioCharacters } from "@/development/studio/studio-content"

/** 隊列に選べる仲間。プレイヤーは戦わないので含めない。 */
export const studioMembers = studioCharacters.map((character) => ({
  slug: character.slug,
  name: character.name,
}))

export const studioScenes = [
  { slug: "battle", title: "戦闘（組み合わせ）" },
  { slug: "components", title: "コンポーネント・演出" },
  ...previews().filter((entry) => entry.slug !== "battle"),
  ...layoutPatterns,
]
