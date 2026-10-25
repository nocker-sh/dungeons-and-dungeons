import { gameContent } from "@/lib/content/game-content"

import {
  GameCommandError,
  GameDefinition,
  PARTY_SLOTS,
  inPhase,
  type Game,
} from "@/lib/wiz"
import type { PreviewStart } from "@/lib/game-client/start"
import type { Screen } from "@/lib/game-client/navigation"
import type { WizWorldEnvironment } from "@/lib/wiz"

import { seededEnvironment } from "@/lib/game-client/seeded-environment"
import type { PreviewOptions } from "./types"

/** 種・環境・保存をプレビューの一回の組み立てに閉じ込める。 */
export function createPreviewContext(options: PreviewOptions = {}) {
  const content = options.content ?? gameContent

  const seedOffset = (options.seed ?? 1) - 1

  const environments = new WeakMap<Game, WizWorldEnvironment>()

  /**
   * 遊べる街まで進めた新しいプレイ。
   * はじめからは主人公を作る場面・仲間なし・悪魔なしなので、
   * 場面の確認用にここでキャラクターを作り、募集から3人そろえ、開始時のロクス契約を使う。
   */
  function play(seed: number) {
    const environment = seededEnvironment(seed + seedOffset)
    const game = new GameDefinition(content).create(environment)
    environments.set(game, environment)
    const hero = game.queries.hero(game.state)
    if (hero.creating)
      inPhase(game, "creating")?.createHero(hero.suggestion, hero.look)
    fillParty(game)
    // 開始時のロクス契約を使う。ガチャで相棒を選ばない。
    return game
  }

  /** 募集の枠から、払える安い順に3人そろえる。 */
  function fillParty(game: Game) {
    for (let guard = 0; guard < 8; guard++) {
      if (game.state.party.length >= PARTY_SLOTS) return
      const next = game.queries
        .recruits(game.state)
        .filter((entry) => !entry.hired && entry.affordable)
        .sort((a, b) => a.price - b.price)[0]
      if (!next) return
      const hired = inPhase(game, "town")?.recruit(next.id)
      if (!hired || hired instanceof GameCommandError) return
    }
  }

  function prepared(
    game: Game,
    screen: Screen,
    overlay?: PreviewStart["overlay"]
  ): PreviewStart {
    return {
      content,
      environment: environments.get(game),
      save: game.save(),
      initialState: game.state,
      screen,
      overlay,
    }
  }

  const firstLayer = () => content.layers[0].id

  const town = (): PreviewStart => prepared(play(1), { name: "town" })

  const party = () => play(1).state.party
  const remember = (game: Game, environment: WizWorldEnvironment) =>
    environments.set(game, environment)
  return {
    content,
    seedOffset,
    play,
    prepared,
    firstLayer,
    town,
    party,
    remember,
  }
}
export type PreviewContext = ReturnType<typeof createPreviewContext>
