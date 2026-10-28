import { describe, expect, it } from "vite-plus/test"
import { GameCatalog } from "@/lib/wiz/content/game-catalog"
import { GameCommandError } from "@/lib/wiz/game/game-command-error"
import type { GameState } from "@/lib/wiz/state/state-schema"
import { stateProblems } from "@/lib/wiz/integrity/state-problems"
import { aState } from "@/lib/wiz/testing/state-builder"
import { contentId } from "@/lib/wiz/testing/content-id"
import { goodBySlug } from "@/lib/wiz/testing/good-by-slug"
import { realContent } from "@/lib/wiz/testing/real-content"
import { realSmithy } from "@/lib/wiz/testing/real-smithy"
import { createTestGame } from "@/lib/wiz/testing/create-test-game"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"
import { sequentialIds } from "@/lib/wiz/testing/sequential-ids"

const catalog = new GameCatalog(realContent())

// 武器の個体も壊せるように、アルダに鉄の両手剣を持たせた状態を土台にする
const baseState = () => aState().withEquipped("alda", "greatsword").build()
const weaponGear = baseState().gear.find((gear) => gear.weapon)!
const armorGear = baseState().gear.find((gear) => !gear.weapon)!
const upgradeSteps = realSmithy().upgrades.length

function problemsOf(patch: (state: GameState) => unknown) {
  return stateProblems(patch(baseState()) as GameState, catalog)
}

/** 状態を直接壊す（保存の境界で拒否されるはずのもの）。 */
const broken: readonly (readonly [string, (state: GameState) => unknown])[] = [
  [
    "仲間が重複している",
    (state) => ({ ...state, members: [...state.members, state.members[0]] }),
  ],
  [
    "仲間 ghost がコンテンツにない",
    (state) => ({
      ...state,
      members: state.members.map((member, index) =>
        index === 2 ? { ...member, id: "ghost" } : member
      ),
      party: state.party.map((id) =>
        id === state.members[2].id ? "ghost" : id
      ),
      gear: state.gear.filter((gear) => gear.owner !== state.members[2].id),
    }),
  ],
  [
    "出撃メンバーが重複している",
    (state) => ({
      ...state,
      party: ["alda", "alda", "hero"].map((slug) => contentId(slug)),
    }),
  ],
  [
    `出撃メンバー ${contentId("jig")} を雇っていない`,
    (state) => ({
      ...state,
      party: ["alda", "jig", "hero"].map((slug) => contentId(slug)),
    }),
  ],
  [
    "主人公が出撃メンバーにいない",
    (state) => ({
      ...state,
      party: ["alda", "mort"].map((slug) => contentId(slug)),
    }),
  ],
  [
    "持ち物 ghost がコンテンツにない",
    (state) => ({ ...state, bag: [{ good: "ghost", count: 1 }] }),
  ],
  [
    `装備 ${armorGear.id} が重複している`,
    (state) => ({ ...state, gear: [...state.gear, state.gear[0]] }),
  ],
  [
    "装備 ghost がコンテンツにない",
    (state) => ({
      ...state,
      gear: state.gear.map((gear, index) =>
        index === 0 ? { ...gear, good: "ghost" } : gear
      ),
    }),
  ],
  [
    `装備 ${armorGear.id} の持ち主 ghost がいない`,
    (state) => ({
      ...state,
      gear: state.gear.map((gear) =>
        gear.id === armorGear.id ? { ...gear, owner: "ghost" } : gear
      ),
    }),
  ],
  [
    `${contentId("alda")} が同じ部位を二つ装備している`,
    (state) => ({
      ...state,
      gear: [
        ...state.gear,
        {
          id: "extra",
          good: contentId("sword"),
          owner: contentId("alda"),
          plus: 0,
          progress: 0,
          wear: 0,
          weapon: {
            rarity: "N",
            extraPower: 0,
            skills: goodBySlug("sword").skills!,
          },
        },
      ],
    }),
  ],
  [
    "悪魔 ghost がコンテンツにない",
    (state) => ({
      ...state,
      demons: [{ id: "ghost", lv: 1, exp: 0 }],
      contract: "ghost",
    }),
  ],
  [
    "同じ悪魔が重なっている",
    (state) => ({
      ...state,
      demons: [
        { id: "nui", lv: 1, exp: 0 },
        { id: "nui", lv: 2, exp: 0 },
      ],
    }),
  ],
  [
    "合体する悪魔と契約していない",
    (state) => ({ ...state, contract: contentId("lox") }),
  ],
  [
    "募集 ghost がコンテンツにない",
    (state) => ({ ...state, board: ["ghost"] }),
  ],
  [
    `装備 ${weaponGear.id} の強化が上限を超えている`,
    (state) => ({
      ...state,
      gear: state.gear.map((gear) =>
        gear.id === weaponGear.id ? { ...gear, plus: upgradeSteps + 1 } : gear
      ),
    }),
  ],
  // 防具は鍛え直しで伸びた段のまま着替えられるので、上限は鍛え直しの段（maxPlus）
  [
    `装備 ${armorGear.id} の強化が上限を超えている`,
    (state) => ({
      ...state,
      gear: state.gear.map((gear) =>
        gear.id === armorGear.id
          ? { ...gear, plus: realContent().balance.unique.maxPlus + 1 }
          : gear
      ),
    }),
  ],
  [
    `装備 ${armorGear.id} の鍛え直しの手応えが合わない`,
    (state) => ({
      ...state,
      gear: state.gear.map((gear) =>
        gear.id === armorGear.id ? { ...gear, progress: 1 } : gear
      ),
    }),
  ],
  [
    `防具でない装備 ${weaponGear.id} に耐久の減りがある`,
    (state) => ({
      ...state,
      gear: state.gear.map((gear) =>
        gear.id === weaponGear.id ? { ...gear, wear: 1 } : gear
      ),
    }),
  ],
  [
    `武器 ${weaponGear.id} に個体（レア度とワザ）がない`,
    (state) => ({
      ...state,
      gear: state.gear.map((gear) =>
        gear.id === weaponGear.id ? { ...gear, weapon: null } : gear
      ),
    }),
  ],
  [
    `武器 ${weaponGear.id} のワザ ghost がコンテンツにない`,
    (state) => ({
      ...state,
      gear: state.gear.map((gear) =>
        gear.id === weaponGear.id
          ? {
              ...gear,
              weapon: {
                ...gear.weapon!,
                skills: ["ghost", ...gear.weapon!.skills.slice(1)],
              },
            }
          : gear
      ),
    }),
  ],
  [
    "到達した層がコンテンツにない",
    (state) => ({ ...state, reached: realContent().layers.length }),
  ],
  [
    "層 ghost がコンテンツにない",
    (state) => ({ ...state, lastLayer: "ghost" }),
  ],
  [
    `${contentId("alda")} が使ったワザ ghost がコンテンツにない`,
    (state) => ({
      ...state,
      members: state.members.map((member) =>
        member.id === contentId("alda")
          ? { ...member, used: [{ skill: "ghost", count: 1 }] }
          : member
      ),
    }),
  ],
  [
    "依頼 ghost がコンテンツにない",
    (state) => ({
      ...state,
      quests: [{ id: "ghost", progress: 0, claimed: false }],
    }),
  ],
  [
    "募集 ghost がコンテンツにない",
    (state) => ({ ...state, recruited: ["ghost"] }),
  ],
]

describe("状態とコンテンツの食い違い（hunt）", () => {
  it("はじめからの状態には食い違いがない", () => {
    expect(stateProblems(baseState(), catalog)).toEqual([])
  })

  it("出撃が3人を超えた状態は、多すぎると返す（4人の古い保存は読み込み時に3人へ移す）", () => {
    const state = aState().withJoined("jig").build()
    expect(
      stateProblems(
        { ...state, party: [...state.party, contentId("jig")] },
        catalog
      )
    ).toContain("出撃メンバーが多すぎる")
  })

  it("壊した状態はそれぞれの理由を返す", () => {
    for (const [message, patch] of broken)
      expect(problemsOf(patch), message).toContain(message)
  })

  it("壊した状態はどれも保存として読み込まれない", () => {
    const game = createTestGame({ ids: sequentialIds("probe") })
    const save = JSON.parse(JSON.stringify(game.save()))
    const before = game.state
    for (const [message, patch] of broken) {
      const input = {
        ...save,
        snapshot: JSON.parse(JSON.stringify(patch(baseState()))),
      }
      const error = game.restore(input)
      expect(error, message).toBeInstanceOf(GameCommandError)
      expect(game.state, message).toBe(before)
    }
  })

  it("探索中の地点や行動順の食い違いも見つける", () => {
    const state = aState()
      .inBattle({ foes: ["kamokutsu"], order: ["alda", "foe-1"] })
      .build()
    const phase = state.phase as Extract<GameState["phase"], { type: "battle" }>
    expect(stateProblems(state, catalog)).toEqual([])
    const withPhase = (patch: Record<string, unknown>) =>
      stateProblems(
        { ...state, phase: { ...phase, ...patch } } as GameState,
        catalog
      )
    expect(
      withPhase({ expedition: { ...phase.expedition, at: "ghost" } })
    ).toContain("地点 ghost が道のりにない")
    expect(
      withPhase({ expedition: { ...phase.expedition, visited: ["ghost"] } })
    ).toContain("地点 ghost が道のりにない")
    expect(
      withPhase({
        battle: {
          ...phase.battle,
          foes: [{ ...phase.battle.foes[0], foe: "ghost" }],
        },
      })
    ).toContain("敵 ghost がコンテンツにない")
    expect(
      withPhase({
        battle: {
          ...phase.battle,
          order: [
            { kind: "member", id: "ghost" },
            { kind: "foe", id: "foe-1" },
          ],
        },
      })
    ).toContain("行動順の ghost がいない")
  })

  it("探索中に拾った物がコンテンツから消えたら見つける", () => {
    const state = aState()
      .inExpedition({ loot: { gold: 0, goods: [{ good: "ghost", count: 1 }] } })
      .build()
    expect(stateProblems(state, catalog)).toContain(
      "拾い物 ghost がコンテンツにない"
    )
  })

  it("食い違いをまとめて返す（一つ目で止めない）", () => {
    const state = {
      ...aState().build(),
      bag: [{ good: "ghost", count: 1 }],
      board: ["ghost2"],
      reached: 9,
    } as GameState
    expect(stateProblems(state, catalog).length).toBeGreaterThanOrEqual(3)
  })

  it("ユニークの固有の武器だけは鍛え直しの段まで上がれる", () => {
    const game = createTestGame({
      state: aState().withGold(500).withBoard(["sr-husky"]).build(),
    })
    eventsOrThrow(
      game.send({ type: "recruit", recruit: contentId("sr-husky") })
    )
    const sword = game.state.gear.find(
      (gear) => gear.good === contentId("iron-gloves")
    )!
    const raised = (plus: number, progress: number) =>
      ({
        ...game.state,
        gear: game.state.gear.map((gear) =>
          gear.id === sword.id ? { ...gear, plus, progress } : gear
        ),
      }) as GameState
    // 鍛冶屋の強化は upgrades の段までだが、固有の武器は maxPlus まで
    const { maxPlus, progressPerStep } = realContent().balance.unique
    expect(maxPlus).toBeGreaterThan(upgradeSteps)
    expect(
      stateProblems(raised(maxPlus, progressPerStep - 1), catalog)
    ).toEqual([])
    expect(stateProblems(raised(maxPlus + 1, 0), catalog)).toContain(
      `装備 ${sword.id} の強化が上限を超えている`
    )
    // 手応えは次の段に届く前の値だけ
    expect(stateProblems(raised(3, progressPerStep), catalog)).toContain(
      `装備 ${sword.id} の鍛え直しの手応えが合わない`
    )
  })

  it("契約の仲間のモードは契約にある番号だけで、装備を持たない", () => {
    const alma = contentId("alma")
    const base = aState().withExtraMember("alma", { lv: 12 })
    expect(
      stateProblems(base.withMember("alma", { mode: 0 }).build(), catalog)
    ).toEqual([])
    // モードは1人1つなので、0のほかは契約にない
    expect(
      stateProblems(base.withMember("alma", { mode: 1 }).build(), catalog)
    ).toContain(`${alma} のモード 1 が契約にない`)
    const leather = {
      id: "worn",
      good: contentId("leather"),
      owner: alma,
      plus: 0,
      progress: 0,
      wear: 0,
      weapon: null,
    }
    expect(stateProblems(base.withGear([leather]).build(), catalog)).toContain(
      `装備 worn は ${catalog.member(alma)!.job} が装備できない`
    )
  })

  it("防具の耐久は強化で増えた最大までしか減っていられない", () => {
    const game = createTestGame({ state: aState().withGold(500).build() })
    eventsOrThrow(
      game.send({
        type: "buy",
        shop: contentId("armory"),
        good: contentId("coat"),
      })
    )
    const coat = game.state.gear.find(
      (gear) => gear.good === contentId("coat")
    )!
    const durability = goodBySlug("coat").durability!
    const perPlus = realContent().balance.armor.durabilityPerPlus
    const worn = (plus: number, wear: number) =>
      ({
        ...game.state,
        gear: game.state.gear.map((gear) =>
          gear.id === coat.id ? { ...gear, plus, wear } : gear
        ),
      }) as GameState
    expect(stateProblems(worn(0, durability), catalog)).toEqual([])
    expect(stateProblems(worn(0, durability + 1), catalog)).toContain(
      `防具 ${coat.id} の耐久が最大を超えて減っている`
    )
    // 強化1段で durabilityPerPlus だけ増える
    expect(stateProblems(worn(1, durability + perPlus), catalog)).toEqual([])
    expect(stateProblems(worn(1, durability + perPlus + 1), catalog)).toContain(
      `防具 ${coat.id} の耐久が最大を超えて減っている`
    )
  })

  it("到達していない層を前回の層にした保存は読み込まない（乗り場が潜れない層を選ぶため）", () => {
    const layer2 = contentId("layer2")
    const state = { ...aState().build(), reached: 0, lastLayer: layer2 }
    expect(stateProblems(state as GameState, catalog)).toContain(
      `前回の層 ${layer2} に到達していない`
    )
    const game = createTestGame({ ids: sequentialIds("probe") })
    const save = JSON.parse(JSON.stringify(game.save()))
    const before = game.state
    expect(
      game.restore({
        ...save,
        snapshot: JSON.parse(JSON.stringify(state)),
      })
    ).toBeInstanceOf(GameCommandError)
    expect(game.state).toBe(before)
    // 到達済みならそのまま読み込める
    expect(
      stateProblems(
        { ...aState().build(), reached: 2, lastLayer: layer2 } as GameState,
        catalog
      )
    ).toEqual([])
  })

  it("診断の Query は同じ食い違いを返す", () => {
    const state = { ...aState().build(), reached: 9 } as GameState
    const game = createTestGame()
    expect(game.queries.problems(state)).toEqual(stateProblems(state, catalog))
  })
})
