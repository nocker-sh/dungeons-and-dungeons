import { contentSource } from "@/lib/content/game-content"

import { GameCommandError, GameDefinition, inPhase, type Game } from "@/lib/wiz"

import { seededEnvironment } from "@/lib/game-client/seeded-environment"
import type { PreviewContext } from "./context"
export function createCombatScenarios(context: PreviewContext) {
  const { content, play, firstLayer, remember } = context
  /** 同種3体の個体差を並べる。展示用の敵編成で本番の出現処理を使う。 */
  function slimeIndividuals(
    slugs = ["black-slime", "black-slime", "black-slime"]
  ): Game {
    const slimeIds = slugs.map(
      (slug) => contentSource.foes.find((entry) => entry.slug === slug)!.id
    )
    const displayContent = {
      ...content,
      layers: content.layers.map((layer, index) =>
        index !== 0
          ? layer
          : {
              ...layer,
              stations: layer.stations.map((station) =>
                station.id !== "n1" ? station : { ...station, foes: slimeIds }
              ),
            }
      ),
    }
    const environment = seededEnvironment(1)
    const game = new GameDefinition(displayContent).create(
      environment,
      play(1).state
    )
    remember(game, environment)
    inPhase(game, "town")?.depart(firstLayer())
    inPhase(game, "expedition")?.advance("n1")
    return game
  }

  function slimeBattle(): Game {
    const slime = contentSource.foes.find(
      (entry) => entry.slug === "black-slime"
    )!
    for (let seed = 1; seed <= 500; seed++) {
      const game = departed(seed)
      inPhase(game, "expedition")?.advance("n1")
      if (
        game.queries
          .battle(game.state)
          ?.foes.some((foe) => foe.foe === slime.id)
      )
        return game
    }
    throw new Error("タールスライムの戦闘の場面を作れない")
  }

  function departed(seed: number): Game {
    const game = play(seed)
    const step = inPhase(game, "town")?.depart(firstLayer())
    if (!step || step instanceof GameCommandError)
      throw new Error("出撃できない")
    return game
  }

  /** 最初の地点で戦闘になった状態。foes を指定すると、その数の敵が出る種を探す。 */
  function battle(foes?: number): Game {
    for (let seed = 1; seed < 500; seed++) {
      const game = departed(seed)
      const step = inPhase(game, "expedition")?.advance("n1")
      if (!step || step instanceof GameCommandError) continue
      const view = game.queries.battle(game.state)
      if (view && (!foes || view.foes.length === foes)) return game
    }
    throw new Error("戦闘の状態を作れない")
  }

  /** その層の最初の地点で戦闘になった状態（層ごとの敵の見た目の確認用）。展示用に全層へ届いたことにする。 */
  function battleIn(layerIndex: number): Game {
    for (let seed = 1; seed < 200; seed++) {
      const game = play(seed)
      const saved = game.save()
      const failed = game.restore({
        ...saved,
        snapshot: { ...saved.snapshot, reached: content.layers.length - 1 },
      })
      if (failed) throw failed
      const layer = content.layers[layerIndex]
      const departed = inPhase(game, "town")?.depart(layer.id)
      if (!departed || departed instanceof GameCommandError) continue
      const first = layer.stations.find((station) => station.id === layer.start)
      const step = inPhase(game, "expedition")?.advance(first?.next[0] ?? "")
      if (!step || step instanceof GameCommandError) continue
      if (game.queries.battle(game.state)?.foes.length === 2) return game
    }
    throw new Error("その層の戦闘を作れない")
  }
  return { slimeIndividuals, slimeBattle, departed, battle, battleIn }
}
