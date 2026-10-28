import { GameDefinition } from "@/lib/wiz/definition/game-definition"
import type { GameState } from "@/lib/wiz/state/state-schema"
import { createMember } from "@/lib/wiz/members/create-member"
import type { ConversationTrigger } from "@/lib/wiz/conversations/schema"

export type ConversationScenario = {
  owned: string[]
  party: string[]
  demons: string[]
  reached: number
  cleared: boolean
  trigger: ConversationTrigger
  seen: string[]
  /** 立っているフラグ。省略は何も立っていない。 */
  flags?: string[]
  /** 宿で過ごした夜の数。省略は1。 */
  nights?: number
}

/** 制作画面でも本物の GameState と条件判定を使う。報酬の注入は試験用状態に限定。 */
export function conversationScenario(
  definition: GameDefinition,
  config: ConversationScenario
): GameState {
  const initial = definition.initialState()
  const catalog = definition.catalog
  const owned = config.owned.flatMap((id) => {
    const member = catalog.member(id)
    return member && !member.hero ? [createMember(member)] : []
  })
  const layer =
    catalog.data.layers[
      Math.min(config.reached, catalog.data.layers.length - 1)
    ]
  const station =
    config.trigger === "branch"
      ? (layer.stations.find((entry) => entry.next.length > 1) ??
        layer.stations[0])
      : layer.stations[0]
  const phase: GameState["phase"] =
    config.trigger === "opening"
      ? { type: "creating" }
      : config.trigger === "inn" ||
          config.trigger === "talk" ||
          config.trigger === "visit"
        ? { type: "town" }
        : {
            type: "expedition",
            expedition: {
              layer: layer.id,
              at: station.id,
              visited: [station.id],
              events: [],
              cleared: false,
              loot: { gold: 0, goods: [] },
              pending:
                config.trigger === "branch"
                  ? null
                  : {
                      kind: "treasure",
                      gold: 0,
                      goods: [{ good: catalog.data.junk, count: 1 }],
                    },
            },
          }
  return {
    ...initial,
    members: [...initial.members, ...owned],
    party: [
      ...initial.party,
      ...config.party.filter((id) => config.owned.includes(id)).slice(0, 3),
    ],
    demons: config.demons.map((id) => ({ id, lv: 1, exp: 0 })),
    contract: config.demons[0] ?? null,
    board: initial.board.filter(
      (id) => !config.owned.includes(catalog.recruit(id)?.member.id ?? "")
    ),
    recruited: catalog.data.recruits
      .filter((entry) => config.owned.includes(entry.member.id))
      .map((entry) => entry.id),
    reached: config.reached,
    cleared: config.cleared,
    // 登録待ちのあいだは街の会話が始まらない。制作画面と試験は登録済みで再生する
    hero: { ...initial.hero, registrationPending: false },
    nights: config.nights ?? 1,
    phase,
    conversation: {
      active: null,
      last: null,
      seen: config.seen,
      flags: config.flags ?? [],
    },
  }
}
