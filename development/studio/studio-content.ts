import { contentSource, toGameContent } from "@/content/game-content"
import { characterGroups } from "@/concept/characters"
import type { GameContent } from "@/lib/wiz/content/content-schema"
import type { StudioConfig } from "@/development/studio/config"

export const studioCharacters = characterGroups
  .filter((group) => ["キャラの一覧", "募集の仲間"].includes(group.label))
  .flatMap((group) => group.characters)

/** 数値が未実装の人物は同ロールの既存能力で表示を検証する。作品データには書き戻さない。 */
export function studioContent(config: StudioConfig): GameContent {
  const source = structuredClone(contentSource)
  source.startingCompanions = []
  const definitions = [
    ...source.party,
    ...source.recruits.map((entry) => entry.member),
  ]
  source.party = config.party.map((slug) => {
    const found = definitions.find((member) => member.slug === slug)
    if (found) return structuredClone(found) as (typeof source.party)[number]
    const character = studioCharacters.find((member) => member.slug === slug)
    if (!character) throw new Error(`キャラがありません: ${slug}`)
    const role =
      character.role === "ヒーラー"
        ? "healer"
        : character.role === "タンク"
          ? "tank"
          : "damage"
    const template =
      definitions.find(
        (member) => member.role === role && !("hero" in member)
      ) ?? definitions[0]
    return {
      ...structuredClone(template),
      id: character.id,
      slug,
      name: character.name,
      role,
      job: character.job ?? role,
    } as (typeof source.party)[number]
  })
  // 出撃枠へ入れた仲間は募集から外す（同じ id が二度出ると仲間の id が重複する）
  const inParty = new Set(source.party.map((member) => member.id))
  source.recruits = source.recruits.filter(
    (entry) => !inParty.has(entry.member.id)
  )
  source.recruiting = {
    ...source.recruiting,
    initial: source.recruiting.initial.filter((id) =>
      source.recruits.some((entry) => entry.id === id)
    ),
  }
  return toGameContent(source)
}
