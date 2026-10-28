import { stateSchema } from "@/lib/wiz/state/state-schema"
import { layoutPattern } from "@/development/studio/layout-pattern"
import { contentSource } from "@/content/game-content"
import { GameDefinition } from "@/lib/wiz/definition/game-definition"
import { GameCommandError } from "@/lib/wiz/game/game-command-error"
import { inPhase } from "@/lib/wiz/phases/in-phase"
import { BattleRules } from "@/lib/wiz/rules/battle-rules"
import { PartyRules } from "@/lib/wiz/rules/party-rules"
import { previews } from "@/development/scenarios/index"
import { seededEnvironment } from "@/development/seeded-environment"
import type { PreviewStart } from "@/client/dev/preview-start"
import type { StudioConfig } from "@/development/studio/config"
import { studioContent } from "@/development/studio/studio-content"

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
