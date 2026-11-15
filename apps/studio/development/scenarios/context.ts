import { gameContent } from "@/content/game-content"
import { GameCommandError } from "@/lib/wiz/game/game-command-error"
import { studioDefinition } from "@/development/studio/studio-definition"
import { PARTY_SLOTS } from "@/lib/wiz/content/constants"
import { inPhase } from "@/lib/wiz/phases/in-phase"
import type { Game } from "@/lib/wiz/game/game"
import type { PreviewStart } from "@/client/game/preview-start"
import type { Screen } from "@/client/game/navigation"
import type { WizWorldEnvironment } from "@/lib/wiz/core/world/world"
import { seededEnvironment } from "@/development/seeded-environment"
import type { PreviewOptions } from "@/development/scenarios/types"

/** 種・環境・保存をプレビューの一回の組み立てに閉じ込める。 */
export function createPreviewContext(options: PreviewOptions = {}) {
  const content = options.content ?? gameContent
  // 場面ごとのプレイは別々の状態・環境を持ち、検証済みの定義だけを共有する
  const definition = studioDefinition(content)

  const seedOffset = (options.seed ?? 1) - 1

  const environments = new WeakMap<Game, WizWorldEnvironment>()

  /**
   * 遊べる街まで進めた新しいプレイ。
   * はじめからはプレイヤーの名前を決める場面なので、場面の確認用にここで既定の名前で登録する。
   * 隊列が3人に満たない作品データでは募集からそろえ、開始時のロクス契約を使う。
   */
  function play(seed: number) {
    const environment = seededEnvironment(seed + seedOffset)
    const game = definition.create(environment)
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
    definition,
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
