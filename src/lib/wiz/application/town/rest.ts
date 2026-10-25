import type { WizWorldEnvironment } from "@/lib/wiz/core/world/world"
import type { GameActionOf } from "@/lib/wiz/commands"
import type { GameState, LevelUp } from "@/lib/wiz/state"
import type { GameDependencies } from "@/lib/wiz/application/game-dependencies"
import { inTown } from "@/lib/wiz/application/in-town"
import {
  accept,
  reject,
  type Transition,
} from "@/lib/wiz/application/transition"

/** 宿に泊まる。部屋ごとに回復・疲れ・汚れが変わり、良い部屋では経験値に応じてレベルが上がる。ワザの使用回数は必ず戻る。 */
export class Rest {
  static readonly featureId = "W007"
  constructor(
    private readonly deps: Pick<GameDependencies, "catalog" | "party">
  ) {}

  execute(
    state: GameState,
    input: GameActionOf<"rest">,
    environment: WizWorldEnvironment
  ): Transition {
    if (!inTown(state)) return reject("WRONG_PHASE")
    const room = this.deps.catalog.room(input.room)
    if (!room) return reject("UNKNOWN")
    if (state.gold < room.price) return reject("NO_GOLD")
    const levelUps: LevelUp[] = []
    const members = state.members.map((member) => {
      if (!state.party.includes(member.id)) return member
      const grown = room.levelUp
        ? this.deps.party.growth.grow(member, environment.random)
        : member
      if (grown.lv > member.lv)
        levelUps.push({
          member: member.id,
          from: member.lv,
          to: grown.lv,
          before: member.stats,
          after: grown.stats,
        })
      const max = this.deps.party.stats(grown, state)
      const hp =
        room.heal === "full"
          ? max.maxHp
          : Math.min(
              max.maxHp,
              Math.max(1, grown.hp) + Math.ceil(max.maxHp / 2)
            )
      return {
        ...grown,
        hp,
        // 宿で泊まるとワザの使用回数が戻る（仮ルール：部屋によらず全部）
        used: [],
        status: [],
        fatigue: Math.max(0, Math.min(100, grown.fatigue + room.fatigue)),
        // 同じ宿で夜を越すと、少し打ち解ける（主人公を除く）
        like: this.deps.catalog.member(member.id)?.hero
          ? member.like
          : member.like + 1,
        dirt: room.clean
          ? 0
          : Math.max(0, Math.min(100, grown.dirt + room.dirt)),
      }
    })
    return accept(
      {
        ...state,
        gold: state.gold - room.price,
        members,
        nights: state.nights + 1,
        // 夜が明けるので、また仲間ひとりずつ雑談できる
        chatted: [],
      },
      { type: "rested", room: room.id, levelUps }
    )
  }
}
