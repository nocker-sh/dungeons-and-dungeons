import type { WizWorldEnvironment } from "@/lib/wiz/core/world/world"
import type { GameActionOf } from "@/lib/wiz/commands"
import { PARTY_SLOTS } from "@/lib/wiz/content/constants"
import { createMember } from "@/lib/wiz/members/create-member"
import { starterGear } from "@/lib/wiz/members/starter-gear"
import type { GameState } from "@/lib/wiz/state/state-schema"
import type { GameDependencies } from "@/lib/wiz/application/game-dependencies"
import { inTown } from "@/lib/wiz/application/in-town"
import { accept } from "@/lib/wiz/application/accept"
import { reject } from "@/lib/wiz/application/reject"
import type { Transition } from "@/lib/wiz/application/transition"

/**
 * 募集の枠にいる冒険者と契約する。同じ募集は一度だけ。
 * 出撃の3人がそろっていなければそのまま隊列へ入り、そろっていれば控えに入る。
 */
export class Recruit {
  static readonly featureId = "W011"
  constructor(
    private readonly deps: Pick<GameDependencies, "catalog" | "weapons">
  ) {}

  execute(
    state: GameState,
    input: GameActionOf<"recruit">,
    environment: WizWorldEnvironment
  ): Transition {
    if (!inTown(state)) return reject("WRONG_PHASE")
    if (state.hero.registrationPending) return reject("INVALID_ACTION")
    const recruit = this.deps.catalog.recruit(input.recruit)
    if (!recruit) return reject("UNKNOWN")
    if (recruit.retired) return reject("UNAVAILABLE")
    if (!state.board.includes(recruit.id)) return reject("UNAVAILABLE")
    if (
      state.recruited.includes(recruit.id) ||
      state.members.some((member) => member.id === recruit.member.id)
    )
      return reject("ALREADY")
    if (state.gold < recruit.price) return reject("NO_GOLD")
    const joins = state.party.length < PARTY_SLOTS
    const party = joins ? [...state.party, recruit.member.id] : [...state.party]
    // 初めて3人が揃うときだけ、主人公・守り役を前衛へ。以後の手動編成は変えない。
    if (joins && party.length === PARTY_SLOTS) {
      const priority = (id: string) => {
        const member = this.deps.catalog.member(id)!
        return member.hero
          ? 0
          : member.role === "tank"
            ? 1
            : member.role === "healer"
              ? 3
              : 2
      }
      party.sort((left, right) => priority(left) - priority(right))
    }
    return accept(
      {
        ...state,
        gold: state.gold - recruit.price,
        members: [...state.members, createMember(recruit.member)],
        party,
        gear: [
          ...state.gear,
          ...starterGear(
            recruit.member,
            environment.nextId,
            this.deps.weapons,
            environment.random
          ),
        ],
        recruited: [...state.recruited, recruit.id],
      },
      { type: "recruited", member: recruit.member.id }
    )
  }
}
