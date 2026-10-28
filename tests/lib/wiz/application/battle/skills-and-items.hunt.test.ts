import { describe, expect, it } from "vite-plus/test"
import { aContent } from "@/lib/wiz/testing/content-builder"
import { aState } from "@/lib/wiz/testing/state-builder"
import { battleStateOf } from "@/lib/wiz/testing/battle-state-of"
import { contentId } from "@/lib/wiz/testing/content-id"
import { goodBySlug } from "@/lib/wiz/testing/good-by-slug"
import { memberBySlug } from "@/lib/wiz/testing/member-by-slug"
import { realContent } from "@/lib/wiz/testing/real-content"
import { skillBySlug } from "@/lib/wiz/testing/skill-by-slug"
import { createTestGame } from "@/lib/wiz/testing/create-test-game"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"
import { testEnvironment } from "@/lib/wiz/testing/test-environment"

const idOf = (slug: string) => memberBySlug(slug).id
import { GameCommandError } from "@/lib/wiz/game/game-command-error"
import { GameDefinition } from "@/lib/wiz/definition/game-definition"
import type { GameContent } from "@/lib/wiz/content/content-schema"
import type { GameEvent } from "@/lib/wiz/state/game-event"
import type { GameState, Gear } from "@/lib/wiz/state/state-schema"
import type { FoeState } from "@/lib/wiz/state/state-schema"

function actedOf(events: readonly GameEvent[]) {
  const acted = events.find((event) => event.type === "acted")
  if (acted?.type !== "acted") throw new Error("行動の出来事がない")
  return acted
}

/** 防具の個体を足す（同じ部位を二つにしないよう、呼ぶ側で古い防具を外す）。 */
function armorGear(member: string, good: string, wear = 0): Gear {
  return {
    id: `armor-${member}`,
    good: contentId(good),
    owner: member,
    plus: 0,
    progress: 0,
    wear,
    weapon: null,
  }
}

/** その仲間たちの最初の防具を外した装備。 */
function withoutArmor(gear: readonly Gear[], members: readonly string[]) {
  return gear.filter(
    (entry) =>
      !(entry.weapon === null && entry.owner && members.includes(entry.owner))
  )
}

function patchFoes(
  state: GameState,
  patch: (foe: FoeState) => Partial<FoeState>
): GameState {
  if (state.phase.type !== "battle") throw new Error("戦闘ではない")
  return {
    ...state,
    phase: {
      ...state.phase,
      battle: {
        ...state.phase.battle,
        foes: state.phase.battle.foes.map((foe) => ({ ...foe, ...patch(foe) })),
      },
    },
  }
}

describe("ワザと道具の当たり方（hunt）", () => {
  const fixture = aContent()
    .withGood("old-dagger", {
      skills: [
        contentId("thrust"),
        contentId("stitch"),
        contentId("throwknife"),
      ],
    })
    .withGood("old-greatsword", {
      skills: [
        contentId("hold-line"),
        contentId("helmsplit"),
        contentId("focus"),
      ],
    })
    .build()
  const hero = idOf("hero")
  const alda = idOf("alda")
  const mort = idOf("mort")
  // アルダの素の武器（両手剣）に付く近接のワザ
  const melee = skillBySlug("helmsplit")
  const mend = skillBySlug("mend")
  const toughFoe = (content: GameContent = fixture, patch = {}) =>
    aContent(content)
      .withFoe("kamokutsu", { hp: 4000, ...patch })
      .build()

  it("[feature:W004] 守護の祝福は加護をかけ、清めのワザは毒を治す", () => {
    const content = toughFoe()
    // 祝福と清めは最初の仲間にいないシオンのワザなので、モートと入れ替えて出撃させる
    const state = aState(content)
      .withJoined("sion", { replacing: "mort" })
      .withWeaponSkills("sion", ["bless", "cleansing-light"])
      .withMember("alda", { status: [{ kind: "poison", turns: 3 }] })
      .inBattle({ foes: ["kamokutsu"], order: ["sion", "foe-1"] })
      .build()
    const bless = skillBySlug("bless")
    const cleansing = skillBySlug("cleansing-light")
    // 守護の祝福は加護をかける
    const blessed = actedOf(
      eventsOrThrow(
        createTestGame({ content, state, random: 0.5 }).send({
          type: "act",
          command: "skill",
          skill: bless.id,
          target: alda,
        })
      )
    )
    expect(blessed.results[0]).toMatchObject({
      target: { kind: "member", id: alda },
      status: "protect",
    })
    // 清めのワザは毒を治す
    const game = createTestGame({ content, state, random: 0.5 })
    const cured = actedOf(
      eventsOrThrow(
        game.send({ type: "act", command: "skill", skill: cleansing.id })
      )
    )
    expect(
      cured.results.find((result) => result.target.id === alda)
    ).toMatchObject({ cured: cleansing.cure })
    expect(game.queries.member(game.state, alda)!.status).toEqual([])
  })

  it("[feature:W004] 気合いためを使うと次の一撃が倍になり、溜めは消える", () => {
    const content = toughFoe()
    const state = aState(content)
      .inBattle({ foes: ["kamokutsu"], order: ["alda", "foe-1"] })
      .build()
    const plain = createTestGame({ content, state, random: 0.5 })
    const before = actedOf(
      eventsOrThrow(
        plain.send({ type: "act", command: "skill", skill: melee.id })
      )
    ).results[0].damage!
    const charged = createTestGame({ content, state, random: 0.5 })
    eventsOrThrow(
      charged.send({ type: "act", command: "skill", skill: contentId("focus") })
    )
    const focus = skillBySlug("focus")
    expect(charged.queries.member(charged.state, alda)!.status).toEqual([
      { kind: "charge", turns: focus.status!.turns, name: "溜め" },
    ])
    eventsOrThrow(charged.send({ type: "foe-turn" }))
    const after = actedOf(
      eventsOrThrow(
        charged.send({ type: "act", command: "skill", skill: melee.id })
      )
    ).results[0].damage!
    expect(after).toBe(before * 2)
    expect(charged.queries.member(charged.state, alda)!.status).toEqual([])
  })

  it("[feature:W004] 溜めは固定の量の道具では消えない", () => {
    const content = toughFoe()
    const state = aState(content)
      .withMember("alda", { status: [{ kind: "charge", turns: 1 }] })
      .withItem("bomb", 1)
      .inBattle({ foes: ["kamokutsu"], order: ["alda", "foe-1"] })
      .build()
    const game = createTestGame({ content, state, random: 0.5 })
    const acted = actedOf(
      eventsOrThrow(
        game.send({ type: "act", command: "item", good: contentId("bomb") })
      )
    )
    const bomb = goodBySlug("bomb")
    expect(acted.results[0].damage).toBe(
      bomb.effect?.type === "damage" ? bomb.effect.amount : 0
    )
    expect(game.queries.member(game.state, alda)!.status).toEqual([
      { kind: "charge", turns: 1, name: "溜め" },
    ])
  })

  it("[feature:W004] 状態の耐性が高い敵は状態を受け付けない", () => {
    const content = toughFoe(fixture, { resist: { bind: 1 } })
    const state = aState(content)
      .inBattle({ foes: ["kamokutsu"], order: ["hero", "foe-1"] })
      .build()
    const game = createTestGame({ content, state, random: 0 })
    const acted = actedOf(
      eventsOrThrow(
        game.send({ type: "act", command: "skill", skill: contentId("stitch") })
      )
    )
    expect(acted.results[0].resisted).toBe("bind")
    expect(acted.results[0].status).toBeUndefined()
    expect(battleStateOf(game.state).foes[0].status).toEqual([])
  })

  it("[feature:W004] 耐性のない敵は確率のとおり状態を受ける", () => {
    const content = toughFoe()
    const state = aState(content)
      .inBattle({ foes: ["kamokutsu"], order: ["hero", "foe-1"] })
      .build()
    // 赤糸縫いは0.6。乱数0.5なら掛かり、0.7なら掛からない
    const statusOf = (random: number) => {
      const game = createTestGame({ content, state, random })
      return actedOf(
        eventsOrThrow(
          game.send({
            type: "act",
            command: "skill",
            skill: contentId("stitch"),
          })
        )
      ).results[0]
    }
    expect(statusOf(0.5).status).toBe("bind")
    expect(statusOf(0.7).resisted).toBe("bind")
  })

  it("[feature:W004] 倒した敵には状態がかからない", () => {
    const content = fixture
    const base = aState(content)
      .inBattle({
        foes: ["kamokutsu", "kamokutsu"],
        order: ["hero", "foe-1", "foe-2"],
      })
      .build()
    const state = patchFoes(base, (foe) =>
      foe.id === "foe-1" ? { hp: 1 } : {}
    )
    const game = createTestGame({ content, state, random: 0 })
    const acted = actedOf(
      eventsOrThrow(
        game.send({
          type: "act",
          command: "skill",
          skill: contentId("stitch"),
          target: "foe-1",
        })
      )
    )
    expect(acted.results[0]).toMatchObject({ down: true })
    expect(acted.results[0].status).toBeUndefined()
    expect(acted.results[0].resisted).toBeUndefined()
    expect(battleStateOf(game.state).foes[0].status).toEqual([])
  })

  it("[feature:W004] 防具の修復は、指定がなければ耐久が一番減っている仲間を直す", () => {
    const content = toughFoe()
    const base = aState(content)
      .withJoined("sion", { replacing: "mort" })
      .withWeaponSkills("sion", ["mend"])
    const light = 10
    const heavy = mend.repair! + 5
    // シオンは最初の防具を少しだけ傷め、アルダの鎖帷子を大きく傷める
    const sion = idOf("sion")
    const gear = withoutArmor(base.build().gear, [alda]).map((entry) =>
      entry.weapon === null && entry.owner === sion
        ? { ...entry, wear: light }
        : entry
    )
    expect(
      gear.some((entry) => entry.weapon === null && entry.owner === sion)
    ).toBe(true)
    const state = base
      .withGear([...gear, armorGear(alda, "mail", heavy)])
      .inBattle({ foes: ["kamokutsu"], order: ["sion", "foe-1"] })
      .build()
    const game = createTestGame({ content, state, random: 0.5 })
    const acted = actedOf(
      eventsOrThrow(
        game.send({ type: "act", command: "skill", skill: mend.id })
      )
    )
    expect(acted.results[0]).toMatchObject({
      target: { kind: "member", id: alda },
      repaired: mend.repair,
    })
    expect(game.queries.member(game.state, alda)!.armor!.wear).toBe(
      heavy - mend.repair!
    )
    expect(game.queries.member(game.state, sion)!.armor!.wear).toBe(light)
  })

  it("[feature:W004] 防具の修復は減っている分までしか戻さない", () => {
    const content = toughFoe()
    const base = aState(content)
      .withJoined("sion", { replacing: "mort" })
      .withWeaponSkills("sion", ["mend"])
    const state = base
      .withGear([
        ...withoutArmor(base.build().gear, [alda]),
        armorGear(alda, "mail", 3),
      ])
      .inBattle({ foes: ["kamokutsu"], order: ["sion", "foe-1"] })
      .build()
    const game = createTestGame({ content, state, random: 0.5 })
    const acted = actedOf(
      eventsOrThrow(
        game.send({ type: "act", command: "skill", skill: mend.id })
      )
    )
    expect(acted.results[0].repaired).toBe(3)
    expect(game.queries.member(game.state, alda)!.armor!.wear).toBe(0)
  })

  it("[feature:W004] 全員を癒やす道具は生きている仲間だけを満タンにする", () => {
    const content = toughFoe()
    const state = aState(content)
      .withBag([{ good: contentId("elixir"), count: 1 }])
      .withMembers((member) => (member.id === mort ? { hp: 0 } : { hp: 10 }))
      .inBattle({ foes: ["kamokutsu"], order: ["alda", "foe-1"] })
      .build()
    const game = createTestGame({ content, state, random: 0.5 })
    const acted = actedOf(
      eventsOrThrow(
        game.send({ type: "act", command: "item", good: contentId("elixir") })
      )
    )
    expect(acted.results.map((result) => result.target.id)).toEqual(
      state.party.filter((id) => id !== mort)
    )
    for (const member of game.queries.party(game.state))
      expect(member.hp, member.id).toBe(member.id === mort ? 0 : member.maxHp)
  })

  it("[feature:W004] 煙玉は使った仲間に加護をかけ、次の一撃を防ぐ", () => {
    // 作品データの煙玉にはまだ効果がないので、加護の規則を測るためだけに足す
    const content = aContent(fixture)
      .withFoe("kamokutsu", { atk: 40 })
      .withGood("smoke", {
        effect: {
          type: "status",
          status: { kind: "protect", turns: 1 },
          target: "self",
        },
      })
      .build()
    const state = aState(content)
      .withBag([{ good: contentId("smoke"), count: 1 }])
      .inBattle({
        foes: ["kamokutsu"],
        order: ["hero", "foe-1", "alda", "mort"],
      })
      .build()
    // 乱数0では敵は並びの一人目（主人公）を狙う
    const game = createTestGame({ content, state, random: 0 })
    const acted = actedOf(
      eventsOrThrow(
        game.send({ type: "act", command: "item", good: contentId("smoke") })
      )
    )
    expect(acted.results[0]).toMatchObject({
      target: { kind: "member", id: hero },
      status: "protect",
    })
    const result = actedOf(eventsOrThrow(game.send({ type: "foe-turn" })))
      .results[0]
    expect(result).toMatchObject({ target: { id: hero }, blocked: true })
    expect(game.queries.member(game.state, hero)!.status).toEqual([])
  })

  it("[feature:W005] 敵の回復ワザは最大HPを超えない", () => {
    const healing = skillBySlug("sunlit-care")
    const content = aContent(fixture)
      .withFoe("kamokutsu", { skills: [healing.id], skillRate: 1 })
      .build()
    const base = aState(content)
      .inBattle({ foes: ["kamokutsu"], order: ["foe-1", "alda"] })
      .build()
    const state = patchFoes(base, (foe) => ({ hp: foe.maxHp - 1 }))
    const game = createTestGame({ content, state, random: 0.5 })
    const acted = actedOf(eventsOrThrow(game.send({ type: "foe-turn" })))
    expect(acted.name).toBe(healing.name)
    expect(acted.results[0]).toMatchObject({
      target: { kind: "foe", id: "foe-1" },
      heal: 1,
    })
    const foe = battleStateOf(game.state).foes[0]
    expect(foe.hp).toBe(foe.maxHp)
  })

  it("[feature:W004] 画面が使えると出す指示は必ず通り、使えない指示は必ず断られる", () => {
    const content = toughFoe()
    // データの読み直しで遅くならないよう、同じ定義から場面ごとのプレイを作る
    const definition = new GameDefinition(content)
    const base = aState(content).withBag([
      { good: contentId("potion"), count: 1 },
      { good: contentId("revive"), count: 1 },
      { good: contentId("ether"), count: 1 },
      { good: contentId("bomb"), count: 1 },
      { good: contentId("smoke"), count: 1 },
      { good: contentId("antidote"), count: 1 },
    ])
    // 最初の3人に加え、最初の仲間にいないシオンもモートと入れ替えて試す
    const lineups = [
      // down は倒れた場面で倒れている仲間（動く仲間からは外す）
      { party: base, actors: ["alda", "hero", "mort"], down: "alda" },
      { party: base, actors: ["alda", "hero", "mort"], down: "mort" },
      {
        party: base.withJoined("sion", { replacing: "mort" }),
        actors: ["sion"],
        down: "alda",
      },
    ]
    // 倒れた仲間がいる場面といない場面の両方を試す
    for (const fallen of [false, true])
      for (const lineup of lineups) {
        const withFallen = fallen
          ? lineup.party.withMember(lineup.down, { hp: 0 })
          : lineup.party
        const actors = lineup.actors.filter(
          (actor) => !fallen || actor !== lineup.down
        )
        for (const actor of actors.map(idOf)) {
          const state = withFallen
            .withUses("alda", [{ skill: melee.id, count: melee.uses! }])
            .inBattle({ foes: ["kamokutsu"], order: [actor, "foe-1"] })
            .build()
          const fresh = () =>
            definition.create(testEnvironment({ random: 0.5 }), state)
          const game = fresh()
          const commands = game.queries.commands(game.state, actor)!
          for (const skill of [...commands.weaponSkills, ...commands.skills]) {
            const result = fresh().send({
              type: "act",
              command: "skill",
              skill: skill.id,
            })
            expect(
              !(result instanceof GameCommandError),
              `${actor}/${skill.id} usable=${skill.usable} fallen=${fallen}`
            ).toBe(skill.usable)
          }
          for (const item of commands.items) {
            const result = fresh().send({
              type: "act",
              command: "item",
              good: item.id,
            })
            expect(
              !(result instanceof GameCommandError),
              `${actor}/${item.id} usable=${item.usable} fallen=${fallen}`
            ).toBe(item.usable)
          }
          const brawl = fresh().send({ type: "act", command: "brawl" })
          expect(!(brawl instanceof GameCommandError), `${actor} の殴る`).toBe(
            commands.brawl !== null
          )
        }
      }
    // 場面ごとにプレイを作り直すので、混み合っても落ちないよう長めに待つ
  }, 30000)

  it("[feature:W004] 鉄壁は生きている仲間全員に加護をかける", () => {
    const content = toughFoe()
    const state = aState(content)
      .withWeaponSkills("alda", ["wall"])
      .withMember("mort", { hp: 0 })
      .inBattle({ foes: ["kamokutsu"], order: ["alda", "foe-1"] })
      .build()
    const game = createTestGame({ content, state, random: 0.5 })
    const acted = actedOf(
      eventsOrThrow(
        game.send({ type: "act", command: "skill", skill: contentId("wall") })
      )
    )
    expect(acted.results.map((result) => result.target.id)).toEqual(
      state.party.filter((id) => id !== mort)
    )
    for (const result of acted.results) expect(result.status).toBe("protect")
    expect(game.queries.member(game.state, mort)!.status).toEqual([])
  })

  it("[feature:W004] 悪魔のレベルが上がると主人公の悪魔のワザだけ強くなる", () => {
    // 合体の攻撃力ぶんを切り離して、ワザの威力の伸びだけを測る
    const content = aContent(toughFoe())
      .withDemon("nui", { fusion: undefined })
      .build()
    const damageOf = (lv: number, skill: string) => {
      const state = aState(content)
        .withWeaponSkills("hero", [skill])
        .withDemons([{ id: "nui", lv, exp: 0 }], "nui")
        .inBattle({ foes: ["kamokutsu"], order: ["hero", "foe-1"] })
        .build()
      const game = createTestGame({ content, state, random: 0.5 })
      return actedOf(
        eventsOrThrow(game.send({ type: "act", command: "skill", skill }))
      ).results[0].damage!
    }
    // 悪魔のワザは威力 × (1 + powerPerLevel × (レベル−1))
    const per = realContent().summon.powerPerLevel
    const level = realContent().summon.maxLevel
    const shears = skillBySlug("shears").id
    const thrust = skillBySlug("thrust").id
    const low = damageOf(1, shears)
    const high = damageOf(level, shears)
    expect(high).toBeGreaterThan(low)
    // 端数の丸めのぶんだけ1まで離れる
    expect(Math.abs(high - low * (1 + per * (level - 1)))).toBeLessThanOrEqual(
      1
    )
    // 武器のワザは悪魔のレベルで変わらない
    expect(damageOf(level, thrust)).toBe(damageOf(1, thrust))
  })
})
