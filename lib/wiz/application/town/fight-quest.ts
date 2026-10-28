import type { GameActionOf } from "@/lib/wiz/commands"
import type { GameState } from "@/lib/wiz/state/state-schema"
import type { GameDependencies } from "@/lib/wiz/application/game-dependencies"
import type { WizWorldEnvironment } from "@/lib/wiz/core/world/world"
import { PARTY_SLOTS } from "@/lib/wiz/content/constants"
import { SupplyRules } from "@/lib/wiz/rules/supply-rules"
import { partyMembers } from "@/lib/wiz/application/party-members"
import { accept } from "@/lib/wiz/application/accept"
import { reject } from "@/lib/wiz/application/reject"

/** 受注・移動を挟まず、一度限りの街の依頼戦闘を始める。 */
export class FightQuest {
  static readonly featureId = "W039"
  constructor(
    private readonly deps: Pick<
      GameDependencies,
      "catalog" | "battle" | "expedition"
    >
  ) {}

  execute(
    state: GameState,
    input: GameActionOf<"fight-quest">,
    environment: WizWorldEnvironment
  ) {
    if (state.phase.type !== "town" || state.conversation?.active || state.wipe)
      return reject("WRONG_PHASE")
    const quest = this.deps.catalog.quest(input.quest)
    if (!quest?.encounter) return reject("UNKNOWN")
    if (
      state.reached < quest.encounter.reached ||
      (quest.requiresCleared && !state.cleared)
    )
      return reject("LOCKED")
    const owned = state.quests.find((entry) => entry.id === quest.id)
    if (owned?.claimed || (owned && owned.progress >= quest.count))
      return reject("ALREADY")
    const party = partyMembers(state)
    if (party.length !== PARTY_SLOTS) return reject("SHORT")
    if (party.some((member) => member.hp <= 0)) return reject("DOWN")
    if (party.some((member) => this.deps.expedition.exhausted(member.fatigue)))
      return reject("TIRED")
    const foes = quest.encounter.foes.map((id, index) => {
      const definition = this.deps.catalog.foe(id)!
      return {
        id: `foe-${index + 1}`,
        foe: id,
        appearanceId: environment.nextId(),
        hp: definition.hp,
        maxHp: definition.hp,
        status: [],
      }
    })
    // 戦闘の保存形式を保つ空のフレーム。出撃履歴・疲れ・探索・層解放は変更しない。
    const layer = this.deps.catalog.data.layers[0]
    return accept(
      {
        ...state,
        quests: owned
          ? state.quests
          : [...state.quests, { id: quest.id, progress: 0, claimed: false }],
        provisions: SupplyRules.packed(state, this.deps.catalog),
        phase: {
          type: "battle",
          townQuest: quest.id,
          expedition: {
            layer: layer.id,
            at: layer.start,
            visited: [layer.start],
            events: [],
            pending: null,
            loot: { gold: 0, goods: [] },
            cleared: false,
          },
          battle: {
            foes,
            order: this.deps.battle.order(state, foes),
            turn: 0,
            guarding: [],
            boss: false,
          },
        },
      },
      { type: "encounter", foes: quest.encounter.foes, boss: false }
    )
  }
}
