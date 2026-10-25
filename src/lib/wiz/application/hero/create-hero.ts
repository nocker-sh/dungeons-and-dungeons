import type { GameActionOf } from "@/lib/wiz/commands"
import { heroName } from "@/lib/wiz/rules"
import type { GameState } from "@/lib/wiz/state"
import type { GameDependencies } from "@/lib/wiz/application/game-dependencies"
import {
  accept,
  reject,
  type Transition,
} from "@/lib/wiz/application/transition"

/**
 * 主人公の外見と名前をまとめて決めて、登録済みとして街へ出る（場面の準備・CLI用）。
 * 名前は登録と同じ全角カタカナ1〜6文字か、登録前の仮の呼び名。
 */
export class CreateHero {
  static readonly featureId = "W029"
  constructor(private readonly deps: Pick<GameDependencies, "catalog">) {}

  execute(state: GameState, input: GameActionOf<"create-hero">): Transition {
    if (state.phase.type !== "creating") return reject("WRONG_PHASE")
    if (!this.deps.catalog.data.hero.looks.includes(input.look))
      return reject("UNKNOWN")
    const provisional = this.deps.catalog.data.hero.name
    const name =
      input.name.trim() === provisional ? provisional : heroName(input.name)
    if (!name) return reject("INVALID_ACTION")
    return accept(
      { ...state, hero: { name, look: input.look }, phase: { type: "town" } },
      { type: "hero-created", name, look: input.look }
    )
  }
}
