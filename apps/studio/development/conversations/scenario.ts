import { GameDefinition } from "@/lib/wiz/definition/game-definition"
import type { GameState } from "@/lib/wiz/state/state-schema"
import { createMember } from "@/lib/wiz/members/create-member"
import { PARTY_SLOTS } from "@/lib/wiz/content/constants"
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
  // プレイヤーは仲間にならない。はじめからいる仲間は二重に加えない
  const owned = config.owned.flatMap((id) => {
    const member = catalog.member(id)
    return member &&
      !member.hero &&
      !initial.members.some((entry) => entry.id === id)
      ? [createMember(member)]
      : []
  })
  const members = [...initial.members, ...owned]
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
    members,
    // 指定の隊列を先に並べ、空きをはじめからいる仲間で埋める
    party: [
      ...new Set([
        ...config.party.filter((id) =>
          members.some((member) => member.id === id)
        ),
        ...initial.party,
      ]),
    ].slice(0, PARTY_SLOTS),
    demons: config.demons.map((id) => ({ id, lv: 1, exp: 0 })),
    contract: config.demons[0] ?? null,
    board: initial.board.filter(
      (id) =>
        !members.some((member) => member.id === catalog.recruit(id)?.member.id)
    ),
    recruited: catalog.data.recruits
      .filter((entry) =>
        members.some((member) => member.id === entry.member.id)
      )
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
