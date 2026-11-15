import { contentSource, toGameContent } from "@/content/game-content"
import { characterGroups } from "@/concept/characters"
import type { GameContent } from "@/lib/wiz/content/content-schema"
import type { StudioConfig } from "@/development/studio/config"

export const studioCharacters = characterGroups
  .filter((group) => ["キャラの一覧", "募集の仲間"].includes(group.label))
  .flatMap((group) => group.characters)
  .filter((character) => !character.retired)

/** 隊列ごとに作った作品データ。場面を開くたびに全データを複製・検証し直さない。 */
const built = new Map<string, GameContent>()
const BUILT_LIMIT = 4

/**
 * 隊列に選んだ仲間を、はじめからいる仲間として開始する。プレイヤーは戦わないので隊列に入れない。
 * 数値が未実装の人物は同ロールの既存能力で表示を検証する。作品データには書き戻さない。
 * 同じ隊列には同じ作品データを返す（定義の使い回しの鍵になる）。受け取った側は書き換えない。
 */
export function studioContent(config: StudioConfig): GameContent {
  const key = JSON.stringify(config.party)
  const cached = built.get(key)
  if (cached) return cached
  const source = structuredClone(contentSource)
  const recruits = source.recruits.filter((entry) => !entry.retired)
  source.startingCompanions = config.party.map((slug) => {
    const found = recruits.find((entry) => entry.member.slug === slug)
    if (found) return found.member.id
    const character = studioCharacters.find((member) => member.slug === slug)
    if (!character) throw new Error(`キャラがありません: ${slug}`)
    const role =
      character.role === "ヒーラー"
        ? "healer"
        : character.role === "タンク"
          ? "tank"
          : "damage"
    const template =
      recruits.find((entry) => entry.member.role === role) ?? recruits[0]
    source.recruits.push({
      ...structuredClone(template),
      id: `studio-recruit-${slug}`,
      member: {
        ...structuredClone(template.member),
        id: character.id,
        slug,
        name: character.name,
        role,
        job: character.job ?? role,
      },
    } as (typeof source.recruits)[number])
    return character.id
  })
  // 隊列に入れた仲間は募集の掲示から外す（雇った者が掲示に残らないようにする）
  const inParty = new Set(source.startingCompanions)
  source.recruiting = {
    ...source.recruiting,
    initial: source.recruiting.initial.filter(
      (id) =>
        !inParty.has(
          source.recruits.find((entry) => entry.id === id)?.member.id ?? ""
        )
    ),
  }
  // 同じ作品データを場面どうしで共有するので凍結し、どこかで書き換えたらその場で気付けるようにする。
  // toGameContent は新しい木を作るので、元の contentSource は凍結しない。
  const content = toGameContent(source)
  freeze(content)
  built.set(key, content)
  // 開発中に隊列を何通りも試しても、古い組み合わせから捨てて記憶を増やし続けない
  for (const old of built.keys()) {
    if (built.size <= BUILT_LIMIT) break
    built.delete(old)
  }
  return content
}

function freeze(value: unknown): void {
  if (typeof value !== "object" || value === null || Object.isFrozen(value))
    return
  for (const child of Object.values(value)) freeze(child)
  Object.freeze(value)
}
