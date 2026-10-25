import { WizWorldEnvironment } from "@/lib/wiz/core/world/world"
import { GameCatalog } from "@/lib/wiz/content"
import { Game } from "@/lib/wiz/game"
import { GameQueries } from "@/lib/wiz/queries"
import type { GameState } from "@/lib/wiz/state"
import type { GameDependencies } from "@/lib/wiz/application/game-dependencies"
import {
  createGameRules,
  type GameRules,
} from "@/lib/wiz/definition/game-rules"
import { createInitialState } from "@/lib/wiz/definition/initial-state"
import { createSaveCodec } from "@/lib/wiz/definition/save-codec"
import {
  createStateOwnership,
  validateState,
} from "@/lib/wiz/definition/state-ownership"
import { saveIdentity } from "@/lib/wiz/definition/save-identity"
import { createGameWorld } from "@/lib/wiz/definition/game-world"

/**
 * データ・計算規則・環境から一つのプレイを組み立てる合成ルート。
 * 規則の組み立てはここだけで行い、ユースケースは受け取った規則しか使わない。
 */
export class GameDefinition {
  readonly catalog: GameCatalog
  readonly identity: string
  readonly legacyIdentity: string
  readonly previousIdentity: string
  /** 組み立て済みのデータと計算規則。 */
  readonly rules: GameDependencies

  constructor(
    content: unknown,
    options: { rules?: GameRules; rulesRevision?: string } = {}
  ) {
    if (options.rules && !options.rulesRevision)
      throw new Error("Injected rules need an explicit rulesRevision")
    this.catalog =
      content instanceof GameCatalog ? content : new GameCatalog(content)
    this.rules = createGameRules(this.catalog, options.rules)
    this.identity = saveIdentity(options.rulesRevision)
    this.previousIdentity = saveIdentity(
      options.rulesRevision,
      "dungeons-state-10"
    )
    this.legacyIdentity = saveIdentity(
      options.rulesRevision,
      "dungeons-state-9"
    )
    Object.freeze(this)
  }

  create(
    environment: WizWorldEnvironment = WizWorldEnvironment.create(),
    initialState?: GameState
  ): Game {
    const world = createGameWorld(
      this.rules,
      validateState(
        initialState ?? this.initialState(environment),
        this.catalog
      ),
      environment,
      createStateOwnership()
    )
    return new Game(
      new GameQueries(
        this.catalog,
        this.rules.party,
        this.rules.weapons,
        this.rules.expedition
      ),
      world as never,
      createSaveCodec(
        this.identity,
        this.catalog,
        this.legacyIdentity,
        this.previousIdentity,
        this.rules.party,
        this.rules.weapons
      )
    )
  }

  /** はじめから。装備の個体IDは連番（環境のIDは使わず、毎回同じ初期状態にする）。 */
  initialState(environment?: WizWorldEnvironment): GameState {
    const state = createInitialState(
      this.catalog,
      this.rules.weapons,
      environment?.random
    )
    return {
      ...state,
      members: state.members.map((member) => ({
        ...member,
        hp: this.rules.party.stats(member, state).maxHp,
      })),
    }
  }
}
