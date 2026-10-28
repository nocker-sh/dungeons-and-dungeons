import type { GameActionOf } from "@/lib/wiz/commands"
import { HERO_REGISTERED_FLAG } from "@/lib/wiz/content/constants"
import type { GameState } from "@/lib/wiz/state/state-schema"
import { heroName } from "@/lib/wiz/rules/hero-name"
import type { GameDependencies } from "@/lib/wiz/application/game-dependencies"
import { inTown } from "@/lib/wiz/application/in-town"
import { accept } from "@/lib/wiz/application/accept"
import { reject } from "@/lib/wiz/application/reject"
import type { Transition } from "@/lib/wiz/application/transition"

/**
 * ギルドの登録用紙に名前を書き、写真（容姿）を選んで登録する。
 * 名前は全角カタカナ1〜6文字。写真を省くと今の容姿のまま。
 */
export class RegisterHero {
  static readonly featureId = "W037"
  constructor(private readonly deps: Pick<GameDependencies, "catalog">) {}

  execute(state: GameState, input: GameActionOf<"register-hero">): Transition {
    if (!inTown(state)) return reject("WRONG_PHASE")
    if (!state.hero.registrationPending) return reject("ALREADY")
    const name = heroName(input.name)
    if (!name) return reject("INVALID_ACTION")
    const look = input.look ?? state.hero.look
    if (!this.deps.catalog.data.hero.looks.includes(look))
      return reject("UNKNOWN")
    const flags = state.conversation?.flags ?? []
    return accept(
      {
        ...state,
        hero: { ...state.hero, name, look, registrationPending: false },
        conversation: {
          active: null,
          last: null,
          seen: [],
          ...state.conversation,
          flags: flags.includes(HERO_REGISTERED_FLAG)
            ? flags
            : [...flags, HERO_REGISTERED_FLAG],
        },
      },
      { type: "hero-registered", name, look }
    )
  }
}
