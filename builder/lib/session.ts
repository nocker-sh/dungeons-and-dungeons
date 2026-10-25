import { stateSchema } from "@/lib/wiz/state"
import {
  GameCommandError,
  GameDefinition,
  WizWorldEnvironment,
  type Game,
  type GameAction,
  type GameEvent,
  type GameState,
} from "@/lib/wiz"
import { buildContent, idOf, type Built } from "./content"
import { SeededRandom } from "./random"

/** 同じデータの定義は使い回す（検証は一度だけ）。 */
const definitions = new WeakMap<Built, GameDefinition>()
function definitionOf(built: Built) {
  let definition = definitions.get(built)
  if (!definition) {
    definition = new GameDefinition(built.content)
    definitions.set(built, definition)
  }
  return definition
}

type Mutable<T> = { -readonly [K in keyof T]: Mutable<T[K]> }
export type EditableState = Mutable<GameState>

/** 一回のプレイ。乱数とIDは種から決まり、保存すれば同じ続きを再現できる。 */
export class Session {
  readonly game: Game
  readonly definition: GameDefinition
  readonly random: SeededRandom
  serial: number

  constructor(
    readonly built: Built,
    seed: number,
    resume?: { rng: number; serial: number; save: unknown }
  ) {
    this.random = new SeededRandom(seed)
    this.serial = 0
    if (resume) {
      this.random.state = resume.rng
      this.serial = resume.serial
    }
    this.definition = definitionOf(built)
    this.game = this.definition.create(
      WizWorldEnvironment.create({
        random: this.random.next,
        now: () => 0,
        nextId: () => `g${++this.serial}`,
      })
    )
    if (resume) {
      const failed = this.game.restore(resume.save)
      if (failed) throw failed
    }
    // はじめからは主人公を作る場面。名前と外見は測定に関係しないので既定で作る
    if (this.state.phase.type === "creating") {
      const hero = this.queries.hero(this.state)
      this.must({
        type: "create-hero",
        name: hero.suggestion,
        look: hero.look,
      })
    }
  }

  static create(overrides: readonly string[] = [], seed = 1) {
    return new Session(buildContent(overrides), seed)
  }

  get state() {
    return this.game.state
  }

  get queries() {
    return this.game.queries
  }

  get catalog() {
    return this.definition.catalog
  }

  /** slug か id から id。 */
  id(key: string, kind?: string) {
    return idOf(this.built.source, key, kind) ?? key
  }

  slug(id: string) {
    return this.built.slugs.get(id) ?? id
  }

  /** 表示名（slug つき）。 */
  label(id: string) {
    const name =
      this.catalog.member(id)?.name ??
      this.catalog.foe(id)?.name ??
      this.catalog.good(id)?.name ??
      this.catalog.skill(id)?.name ??
      this.catalog.layer(id)?.name ??
      this.catalog.demon(id)?.name ??
      this.catalog.room(id)?.name ??
      this.catalog.recruit(id)?.member.name ??
      this.catalog.quest(id)?.name
    const slug = this.slug(id)
    return name ? `${name}(${slug})` : slug
  }

  send(action: GameAction): readonly GameEvent[] | GameCommandError {
    return this.game.send(action)
  }

  /** 送って、拒否されたら例外。 */
  must(action: GameAction): readonly GameEvent[] {
    const result = this.game.send(action)
    if (result instanceof GameCommandError)
      throw new Error(`${action.type} が拒否された: ${result.code}`)
    return result
  }

  /** 状態を直接書き換える（検証を通して戻す）。実験の前提づくり専用。 */
  patch(edit: (state: EditableState) => void) {
    const original = this.game.save()
    const save = { ...original, snapshot: stateSchema.parse(original.snapshot) }
    edit(save.snapshot)
    const failed = this.game.restore(save)
    if (failed) throw failed
  }

  /** 出撃の3人を、宿のレベルアップと同じ規則で level まで育てる。 */
  levelTo(level: number) {
    const room = this.catalog.data.rooms.find((entry) => entry.levelUp)
    if (!room) throw new Error("レベルが上がる部屋がない")
    const gold = this.state.gold
    for (let guard = 0; guard < 99; guard++) {
      const party = this.state.members.filter(
        (member) =>
          this.state.party.includes(member.id) &&
          !this.catalog.member(member.id)?.hero
      )
      if (party.every((member) => member.lv >= level)) break
      // 次のレベルまでの経験値はエンジンの規則から引く（式を builder に写さない）
      const need = new Map(
        party.map((member) => [
          member.id,
          this.queries.member(this.state, member.id)?.next ?? 0,
        ])
      )
      this.patch((state) => {
        state.gold = Math.max(state.gold, room.price)
        for (const member of state.members)
          if (
            state.party.includes(member.id) &&
            !this.catalog.member(member.id)?.hero &&
            member.lv < level
          )
            member.exp = Math.max(member.exp, need.get(member.id) ?? 0)
      })
      this.must({ type: "rest", room: room.id })
    }
    this.patch((state) => {
      state.gold = gold
    })
  }

  /** 続きから再開するための記録。 */
  dump() {
    return {
      rng: this.random.state,
      serial: this.serial,
      save: this.game.save(),
    }
  }
}
