import { stateSchema } from "@/lib/wiz/state"
import { layoutPatterns, layoutPattern } from "./patterns"
import { contentSource, toGameContent } from "@/lib/content/game-content"
import { characterGroups } from "@/lib/concept/characters"
import {
  GameDefinition,
  GameCommandError,
  inPhase,
  BattleRules,
  PartyRules,
  type GameContent,
} from "@/lib/wiz"
import { previews } from "@/lib/dev/scenarios"
import { seededEnvironment } from "@/lib/game-client/seeded-environment"
export { seededEnvironment } from "@/lib/game-client/seeded-environment"
import type { PreviewStart } from "@/lib/game-client/start"
import type { StudioConfig } from "./config"

export const studioCharacters = characterGroups
  .filter((group) => ["キャラの一覧", "募集の仲間"].includes(group.label))
  .flatMap((group) => group.characters)
export const studioMembers = [
  { slug: "hero", name: "あなた" },
  ...studioCharacters,
]
export const studioFoes = contentSource.foes
export const studioScenes = [
  { slug: "battle", title: "戦闘（組み合わせ）" },
  { slug: "components", title: "コンポーネント・演出" },
  ...previews().filter((entry) => entry.slug !== "battle"),
  ...layoutPatterns,
]

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

export function createStudioStart(config: StudioConfig): PreviewStart {
  const content = studioContent(config)
  const definition = new GameDefinition(content)
  const environment = seededEnvironment(config.seed)
  const game = definition.create(environment)
  // はじめからは主人公を作る場面なので、既定の名前と外見で作って街から始める
  const hero = game.queries.hero(game.state)
  if (hero.creating)
    inPhase(game, "creating")?.createHero(hero.suggestion, hero.look)
  if (config.scene === "components")
    return {
      content,
      environment: seededEnvironment(config.seed),
      screen: { name: "town" },
    }
  const scene = layoutPattern(config.scene)?.scene ?? config.scene
  if (scene !== "battle") {
    const preview = previews({ content, seed: config.seed }).find(
      (entry) => entry.slug === scene
    )
    if (!preview) throw new Error(`場面がありません: ${config.scene}`)
    return preview.start()
  }
  const layer = content.layers[0]
  const departed = inPhase(game, "town")?.depart(layer.id)
  if (!departed || departed instanceof GameCommandError)
    throw new Error("戦闘の準備で出撃できません")
  const next = layer.stations.find((station) => station.id === layer.start)
    ?.next[0]
  const advanced = next && inPhase(game, "expedition")?.advance(next)
  if (
    !advanced ||
    advanced instanceof GameCommandError ||
    game.state.phase.type !== "battle"
  )
    throw new Error("開始地点が戦闘ではありません")
  const original = game.save()
  const save = { ...original, snapshot: stateSchema.parse(original.snapshot) }
  // 復元の検証を通し、手番はエンジンの規則で作り直す。
  const state = save.snapshot
  if (state.phase.type !== "battle") throw new Error("戦闘状態がありません")
  state.phase.battle.foes = config.foes.map((slug, index) => {
    const entry = contentSource.foes.find((foe) => foe.slug === slug)
    if (!entry) throw new Error(`敵がありません: ${slug}`)
    return {
      id: `studio-foe-${index}`,
      foe: entry.id,
      hp: entry.hp,
      maxHp: entry.hp,
      status: [],
    }
  })
  for (const [index, id] of state.party.entries()) {
    const member = state.members.find((member) => member.id === id)!
    member.hp = Math.round((member.stats.maxHp * config.hp[index]) / 100)
  }
  state.phase.battle.order = new BattleRules(
    definition.catalog,
    new PartyRules(definition.catalog)
  ).order(state, state.phase.battle.foes)
  state.phase.battle.turn = 0
  const failed = game.restore(save)
  if (failed) throw failed
  return {
    save: game.save(),
    initialState: game.state,
    content,
    environment,
    screen: { name: "expedition" },
  }
}
