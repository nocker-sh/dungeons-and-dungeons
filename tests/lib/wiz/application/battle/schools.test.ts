import { describe, expect, it } from "vite-plus/test"
import { aContent } from "@/lib/wiz/testing/content-builder"
import { aState } from "@/lib/wiz/testing/state-builder"
import { contentId } from "@/lib/wiz/testing/content-id"
import { memberBySlug } from "@/lib/wiz/testing/member-by-slug"
import { skillBySlug } from "@/lib/wiz/testing/skill-by-slug"
import { createTestGame } from "@/lib/wiz/testing/create-test-game"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"
import type { GameEvent } from "@/lib/wiz/state/game-event"
import type { GameState } from "@/lib/wiz/state/state-schema"

const idOf = (slug: string) => memberBySlug(slug).id

/** 魔法の流派・合体の効果・再生。数値は作品データの balance と summon から読む。 */
describe("魔法の流派と合体", () => {
  const hero = idOf("hero")
  const alda = idOf("alda")
  const mayu = idOf("mayu")
  const sion = idOf("sion")
  const sunlit = skillBySlug("sunlit-care")
  const offering = skillBySlug("offering")
  const sprout = skillBySlug("bud-blessing")

  /** アルダを太陽、マユを大地にして、太陽のワザ（陽の手当て）を両方に持たせる。 */
  const schooled = aContent()
    .withGood("old-greatsword", {
      skills: [contentId("hold-line"), sunlit.id, offering.id],
    })
    .withGood("old-sword", {
      skills: [contentId("prayer"), sprout.id, contentId("uppercut")],
    })
    .withRecruitMember("alda", {
      schools: ["sun", "demon"],
      skills: [contentId("focus"), sunlit.id, offering.id],
    })
    .withRecruitMember("mayu", {
      schools: ["earth"],
      skills: [contentId("taunt"), sunlit.id],
    })
    .withRecruitMember("sion", {
      schools: ["plant"],
      skills: [contentId("prayer"), sprout.id],
    })
    // 太陽の悪魔がいないので、ハロを太陽にして合う流派の悪魔として使う（ワザも太陽にそろえる）
    .withDemon("haro", { school: "sun", skills: [sunlit.id] })
    .build()

  /** 戦闘の途中から始める。手番は order の先頭。 */
  function battle(options: {
    content?: unknown
    contract?: string
    demonLevel?: number
    order?: readonly string[]
    patch?: (state: GameState) => GameState
    random?: number
    /** 大地のマユをアルダと入れ替えて出撃させる。 */
    mayu?: boolean
  }) {
    const content = options.content ?? schooled
    // 植物の流派に変えたシオンは最初の仲間にいないので、モートと入れ替えて出撃させる
    let builder = aState(content).withJoined("sion", { replacing: "mort" })
    if (options.mayu)
      builder = builder.withJoined("mayu", { replacing: "alda" })
    let state = builder
      .withDemons(
        [
          { id: "nui", lv: 1, exp: 0 },
          { id: "lox", lv: options.demonLevel ?? 1, exp: 0 },
          { id: "haro", lv: options.demonLevel ?? 1, exp: 0 },
        ],
        options.contract ?? "nui"
      )
      .inBattle({
        foes: ["kamokutsu"],
        order: options.order ?? ["alda", "sion", "hero", "foe-1"],
      })
      .build()
    if (options.patch) state = options.patch(state)
    return createTestGame({ content, state, random: options.random ?? 0.5 })
  }

  const acted = (events: readonly GameEvent[]) =>
    events[0] as Extract<GameEvent, { type: "acted" }>

  it("[feature:W004] キャラ固有スキルは別メニューに残り、流派が合わなければ選べない", () => {
    const game = battle({
      mayu: true,
      order: ["mayu", "sion", "hero", "foe-1"],
    })
    const view = game.queries
      .commands(game.state, mayu)
      ?.skills.find((skill) => skill.id === sunlit.id)
    expect(view).toMatchObject({ blocked: true, usable: false })
    const rejected = game.send({
      type: "act",
      command: "skill",
      skill: sunlit.id,
    })
    expect(rejected).toMatchObject({ code: "NO_SCHOOL" })
  })

  /** 全員を傷つけて、回復が頭打ちにならないようにする。 */
  const hurt = (state: GameState): GameState => ({
    ...state,
    members: state.members.map((member) => ({ ...member, hp: 30 })),
  })

  it("[feature:W004] 流派が合えば同じスキルを選べる", () => {
    const game = battle({ patch: hurt })
    const view = game.queries
      .commands(game.state, alda)
      ?.weaponSkills.find((skill) => skill.id === sunlit.id)
    expect(view).toMatchObject({ blocked: false, usable: true })
    const events = eventsOrThrow(
      game.send({ type: "act", command: "skill", skill: sunlit.id })
    )
    expect(acted(events).results[0].heal).toBeGreaterThan(0)
  })

  it("[feature:W004] 武器から使う魔法は流派を問わず選べる", () => {
    // 片手剣のワザを星の魔法にしても、星を使えないシオンが振れる
    const starry = skillBySlug("uppercut")
    const content = aContent(schooled)
      .withSkill("uppercut", { school: "star" })
      .build()
    const game = battle({
      content,
      order: ["sion", "alda", "hero", "foe-1"],
    })
    const view = game.queries
      .commands(game.state, sion)
      ?.weaponSkills.find((skill) => skill.id === starry.id)
    expect(view?.school).toBe("star")
    expect(view?.usable).toBe(true)
  })

  it("[feature:W004] 合体している悪魔と流派が合うと威力が上がる", () => {
    // 同じ 陽の手当て を、太陽にした悪魔（ハロ）と悪魔の悪魔（ヌイ）で比べる
    const plain = battle({ random: 0.5, contract: "nui", patch: hurt })
    const matched = battle({ random: 0.5, contract: "haro", patch: hurt })
    expect(
      matched.queries
        .commands(matched.state, alda)
        ?.weaponSkills.find((skill) => skill.id === sunlit.id)?.affinity
    ).toBe(true)
    expect(
      plain.queries
        .commands(plain.state, alda)
        ?.weaponSkills.find((skill) => skill.id === sunlit.id)?.affinity
    ).toBe(false)
    const heal = (game: ReturnType<typeof battle>) =>
      acted(
        eventsOrThrow(
          game.send({ type: "act", command: "skill", skill: sunlit.id })
        )
      ).results[0].heal!
    expect(heal(matched)).toBeGreaterThan(heal(plain))
  })

  it("[feature:W004] 自分を削って放つワザは代償のHPを払い、払えないと選べない", () => {
    const game = battle({})
    const before = game.queries.member(game.state, alda)!.hp
    const view = game.queries
      .commands(game.state, alda)
      ?.weaponSkills.find((skill) => skill.id === offering.id)
    // 代償は最大HPの sacrifice の割合
    expect(view?.cost).toBe(Math.floor(before * offering.sacrifice!))
    const events = eventsOrThrow(
      game.send({ type: "act", command: "skill", skill: offering.id })
    )
    expect(acted(events).paid).toBe(view!.cost)
    expect(game.queries.member(game.state, alda)!.hp).toBe(before - view!.cost)

    const weak = battle({
      patch: (state) => ({
        ...state,
        members: state.members.map((member) =>
          member.id === alda ? { ...member, hp: 5 } : member
        ),
      }),
    })
    expect(
      weak.queries
        .commands(weak.state, alda)
        ?.weaponSkills.find((skill) => skill.id === offering.id)?.usable
    ).toBe(false)
    expect(
      weak.send({ type: "act", command: "skill", skill: offering.id })
    ).toMatchObject({ code: "NO_HP" })
  })

  it("[feature:W004] 再生は手番の終わりにHPを戻す", () => {
    const game = battle({
      order: ["sion", "alda", "hero", "foe-1"],
      patch: (state) => ({
        ...state,
        members: state.members.map((member) => ({ ...member, hp: 20 })),
      }),
    })
    const events = eventsOrThrow(
      game.send({ type: "act", command: "skill", skill: sprout.id })
    )
    expect(acted(events).results.map((result) => result.status)).toEqual(
      game.state.party.map(() => "regen")
    )
    // かけた本人はその手番の終わりにもう一度戻る
    const healed = events.find(
      (event) => event.type === "ticked" && event.status === "regen"
    )
    expect(healed).toMatchObject({
      type: "ticked",
      target: { kind: "member", id: sion },
      status: "regen",
    })
    expect(game.queries.member(game.state, sion)!.hp).toBeGreaterThan(20)
    expect(
      game.queries.member(game.state, alda)!.status.map((entry) => entry.name)
    ).toContain("再生")
  })

  it("[feature:W013] 合体の効果は悪魔のレベルで上がる", () => {
    const fusion = { attack: 0.1, maxHp: 8, resist: { bind: 0.2 } }
    const level = 4
    const content = aContent(schooled)
      .withDemon("lox", { school: "earth", fusion })
      .build()
    const low = battle({ content, contract: "lox", demonLevel: 1 })
    const high = battle({ content, contract: "lox", demonLevel: level })
    const view = (game: ReturnType<typeof battle>) =>
      game.queries.member(game.state, hero)!
    expect(view(high).maxHp - view(low).maxHp).toBe(fusion.maxHp * (level - 1))
    expect(view(high).weapon!.attack).toBeGreaterThan(view(low).weapon!.attack)
    expect(view(high).fusion).toMatchObject({
      attackPercent: fusion.attack * level * 100,
      maxHp: fusion.maxHp * level,
      resist: [{ name: "縛り", percent: fusion.resist.bind * level * 100 }],
    })
    // 流派は合体している悪魔で決まる
    expect(view(high).schoolNames).toEqual(["大地"])
    expect(view(low).affinityName).toBe("大地")
  })

  it("[feature:W013] 合体の効果の耐性で状態異常が入りにくくなる", () => {
    const content = aContent(schooled)
      .withDemon("lox", { school: "earth", fusion: { resist: { bind: 1 } } })
      .build()
    // 縛りを確実にかけるワザ（鍵穴の檻）を敵に持たせ、主人公だけを狙わせる
    const withBind = aContent(content)
      .withFoe("kamokutsu", { skills: [contentId("cage")], skillRate: 1 })
      .build()
    const state = aState(withBind)
      .withDemons([{ id: "lox", lv: 1, exp: 0 }], "lox")
      .withParty(["hero", "alda", "mort"])
      .withMembers((member) => (member.id === hero ? {} : { hp: 0 }))
      .inBattle({ foes: ["kamokutsu"], order: ["foe-1", "hero"] })
      .build()
    const game = createTestGame({ content: withBind, state, random: 0 })
    const events = eventsOrThrow(game.send({ type: "foe-turn" }))
    expect(acted(events).results[0]).toMatchObject({
      target: { id: hero },
      resisted: "bind",
    })
  })

  it("[feature:W013] 合体する悪魔を選ぶと流派と相性が変わる", () => {
    const state = aState(schooled)
      .withDemons(
        [
          { id: "nui", lv: 1, exp: 0 },
          { id: "haro", lv: 1, exp: 0 },
        ],
        "nui"
      )
      .inTown()
      .build()
    const game = createTestGame({ content: schooled, state })
    const before = game.queries
      .demons(game.state)
      .find((demon) => demon.id === contentId("haro"))!
    expect(before.schoolName).toBe("太陽")
    expect(before.affinity).toEqual([memberBySlug("alda").name])
    eventsOrThrow(game.send({ type: "choose-demon", demon: contentId("haro") }))
    expect(game.queries.member(game.state, alda)!.affinityName).toBe("太陽")
    expect(game.queries.member(game.state, hero)!.schoolNames).toEqual(["太陽"])
  })
})
