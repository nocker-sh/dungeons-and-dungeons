import { describe, expect, it } from "vite-plus/test"
import { aContent } from "@/lib/wiz/testing/content-builder"
import { aState } from "@/lib/wiz/testing/state-builder"
import { contentId } from "@/lib/wiz/testing/content-id"
import { foeBySlug } from "@/lib/wiz/testing/foe-by-slug"
import { goodBySlug } from "@/lib/wiz/testing/good-by-slug"
import { memberBySlug } from "@/lib/wiz/testing/member-by-slug"
import { realContent } from "@/lib/wiz/testing/real-content"
import { skillBySlug } from "@/lib/wiz/testing/skill-by-slug"
import { createTestGame } from "@/lib/wiz/testing/create-test-game"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"
import { sequentialIds } from "@/lib/wiz/testing/sequential-ids"
import { GameCatalog } from "@/lib/wiz/content/game-catalog"
import { GameCommandError } from "@/lib/wiz/game/game-command-error"
import { PartyRules } from "@/lib/wiz/rules/party-rules"
import type { GameContent } from "@/lib/wiz/content/content-schema"
import type { GameEvent } from "@/lib/wiz/state/game-event"
import type { GameState } from "@/lib/wiz/state/state-schema"
import type { Member } from "@/lib/wiz/state/state-schema"

const idOf = (slug: string) => memberBySlug(slug).id

describe("ワザと状態", () => {
  const hero = idOf("hero")
  const alda = idOf("alda")
  const sion = idOf("sion")
  const whirl = skillBySlug("whirl")
  const helmsplit = skillBySlug("helmsplit")

  /** 戦闘の途中から始める。 */
  function battleWith(
    options: {
      random?: number | (() => number)
      content?: GameContent
      foes?: string[]
      order?: string[]
      patch?: (state: GameState) => GameState
    } = {}
  ) {
    const content = options.content ?? realContent()
    // 蘇生は最初の仲間にいないシオンのワザなので、モートと入れ替えて出撃させる
    let state = aState(content)
      .withJoined("sion", { replacing: "mort" })
      .withWeaponSkills("alda", ["whirl", "helmsplit"])
      .withWeaponSkills("hero", ["stitch"])
      .withWeaponSkills("sion", ["revival-light"])
      .inBattle({
        foes: options.foes ?? ["kamokutsu"],
        order: options.order ?? ["hero", "sion", "foe-1", "alda"],
      })
      .build()
    if (options.patch) state = options.patch(state)
    return createTestGame({
      content,
      state,
      random: options.random ?? 0.5,
      ids: sequentialIds("id"),
    })
  }

  it("[feature:W004] 敵全員を狙うワザは生きている敵すべてに当たる", () => {
    const game = battleWith({
      foes: ["kamokutsu", "kamokutsu"],
      order: ["alda", "hero", "sion", "foe-1", "foe-2"],
    })
    const acted = eventsOrThrow(
      game.send({ type: "act", command: "skill", skill: whirl.id })
    )[0] as Extract<GameEvent, { type: "acted" }>
    expect(acted.results.map((result) => result.target.id)).toEqual([
      "foe-1",
      "foe-2",
    ])
  })

  it("[feature:W004] 狙う敵を選べる", () => {
    const game = battleWith({
      foes: ["kamokutsu", "kamokutsu"],
      order: ["alda", "hero", "sion", "foe-1", "foe-2"],
    })
    const acted = eventsOrThrow(
      game.send({
        type: "act",
        command: "skill",
        skill: helmsplit.id,
        target: "foe-2",
      })
    )[0] as Extract<GameEvent, { type: "acted" }>
    expect(acted.results[0].target.id).toBe("foe-2")
  })

  it("[feature:W004] 溜めると次の一撃が倍になり、使うと消える", () => {
    const order = ["alda", "hero", "sion", "foe-1"]
    const plain = battleWith({ random: 0, order })
    const normal = (
      eventsOrThrow(
        plain.send({ type: "act", command: "skill", skill: helmsplit.id })
      )[0] as Extract<GameEvent, { type: "acted" }>
    ).results[0].damage!
    const charged = battleWith({
      random: 0,
      order,
      patch: (state) => ({
        ...state,
        members: state.members.map((member) =>
          member.id === alda
            ? { ...member, status: [{ kind: "charge", turns: 1 }] }
            : member
        ),
      }),
    })
    const doubled = (
      eventsOrThrow(
        charged.send({ type: "act", command: "skill", skill: helmsplit.id })
      )[0] as Extract<GameEvent, { type: "acted" }>
    ).results[0].damage!
    expect(doubled).toBeGreaterThan(normal * 1.5)
    expect(charged.queries.member(charged.state, alda)?.status).toEqual([])
  })

  it("[feature:W004] 縛られた敵は手番を飛ばされる", () => {
    const stitch = skillBySlug("stitch")
    const game = battleWith({
      random: 0,
      order: ["hero", "foe-1", "sion", "alda"],
    })
    const events = eventsOrThrow(
      game.send({ type: "act", command: "skill", skill: stitch.id })
    )
    expect(events[0]).toMatchObject({
      type: "acted",
      results: [{ status: "bind" }],
    })
    expect(events).toContainEqual({
      type: "skipped",
      actor: { kind: "foe", id: "foe-1" },
      status: "bind",
    })
    expect(game.queries.battle(game.state)?.current).toEqual({
      kind: "member",
      id: sion,
    })
  })

  it("[feature:W005] 毒は手番の終わりに削り、守りの加護は一度だけ被害を防ぐ", () => {
    const kamokutsu = foeBySlug("kamokutsu")
    const { protect, poisonDivisor } = realContent().balance
    const order = ["foe-1", "hero", "sion", "alda"]
    // 乱数0では敵は並びの一人目を狙う
    const plain = battleWith({ random: 0, order })
    const bare = (
      eventsOrThrow(plain.send({ type: "foe-turn" }))[0] as Extract<
        GameEvent,
        { type: "acted" }
      >
    ).results[0].damage!
    const game = battleWith({
      random: 0,
      order,
      patch: (state) => ({
        ...state,
        members: state.members.map((member) =>
          member.id === hero
            ? { ...member, status: [{ kind: "protect", turns: 1 }] }
            : member
        ),
        phase:
          state.phase.type === "battle"
            ? {
                ...state.phase,
                battle: {
                  ...state.phase.battle,
                  foes: state.phase.battle.foes.map((foe) => ({
                    ...foe,
                    status: [{ kind: "poison" as const, turns: 2 }],
                  })),
                },
              }
            : state.phase,
      }),
    })
    const events = eventsOrThrow(game.send({ type: "foe-turn" }))
    const acted = events[0] as Extract<GameEvent, { type: "acted" }>
    expect(acted.results[0]).toMatchObject({
      target: { id: hero },
      blocked: true,
    })
    // 加護のぶんだけ被害が減る（端数の丸めは1まで）
    expect(acted.results[0].damage).toBeLessThan(bare)
    expect(
      Math.abs(acted.results[0].damage! - bare * protect)
    ).toBeLessThanOrEqual(1)
    expect(events[1]).toEqual({
      type: "ticked",
      target: { kind: "foe", id: "foe-1" },
      status: "poison",
      damage: Math.max(1, Math.floor(kamokutsu.hp / poisonDivisor)),
      down: false,
    })
    expect(game.queries.member(game.state, hero)?.status).toEqual([])
  })

  it("[feature:W005] 敵はワザで毒を与えることがある", () => {
    const spit = skillBySlug("poison-spit")
    // 毒は倒れなかった相手にだけ残るので、一撃では倒れない攻撃力の毒の敵で確かめる
    const game = battleWith({
      random: 0,
      content: aContent().withFoe("kuragesa", { atk: 40 }).build(),
      foes: ["kuragesa"],
      order: ["foe-1", "hero", "sion", "alda"],
    })
    const events = eventsOrThrow(game.send({ type: "foe-turn" }))
    expect(events[0]).toMatchObject({
      type: "acted",
      name: spit.name,
      results: [{ target: { id: hero }, status: "poison" }],
    })
  })

  it("[feature:W004] 倒れた仲間は蘇生でき、道具で毒を治せる", () => {
    const revival = skillBySlug("revival-light")
    // 作品データの毒消しにはまだ効果がないので、治す規則を測るためだけに効果を足す
    const content = aContent()
      .withGood("antidote", { effect: { type: "cure", kinds: ["poison"] } })
      .build()
    const game = battleWith({
      content,
      order: ["sion", "hero", "foe-1", "alda"],
      patch: (state) => ({
        ...state,
        bag: [...state.bag, { good: contentId("antidote"), count: 1 }],
        members: state.members.map((member) =>
          member.id === alda
            ? { ...member, hp: 0 }
            : member.id === hero
              ? { ...member, status: [{ kind: "poison", turns: 3 }] }
              : member
        ),
      }),
    })
    expect(
      game.queries
        .commands(game.state, sion)
        ?.weaponSkills.find((skill) => skill.id === revival.id)?.usable
    ).toBe(true)
    const raised = eventsOrThrow(
      game.send({ type: "act", command: "skill", skill: revival.id })
    )[0] as Extract<GameEvent, { type: "acted" }>
    expect(raised.results[0]).toMatchObject({
      target: { id: alda },
      revived: true,
    })
    expect(game.queries.member(game.state, alda)!.hp).toBeGreaterThan(0)
    const cured = eventsOrThrow(
      game.send({
        type: "act",
        command: "item",
        good: contentId("antidote"),
        target: hero,
      })
    )[0] as Extract<GameEvent, { type: "acted" }>
    expect(cured.results[0]).toMatchObject({
      target: { id: hero },
      cured: ["poison"],
    })
  })
})

describe("モートとジグの回復のワザ", () => {
  const alda = idOf("alda")
  const hero = idOf("hero")
  const mort = idOf("mort")
  const jig = idOf("jig")
  const content = realContent()
  const { base, swing } = content.balance.heal
  const party = new PartyRules(new GameCatalog(content))

  /**
   * 回復役の手番から始まる戦闘。ジグは最初の仲間にいないので、モートと入れ替えて出撃させる。
   * 倒れないよう、敵のHPは十分に多くする。
   */
  function healerBattle(
    healer: "mort" | "jig",
    patch: (member: Member) => Partial<Member> = () => ({}),
    random = 0.5
  ) {
    const fixture = aContent().withFoe("kamokutsu", { hp: 4000 }).build()
    const lineup =
      healer === "mort"
        ? aState(fixture)
        : aState(fixture).withJoined("jig", { replacing: "mort" })
    const state = lineup
      .withMembers(patch)
      .inBattle({
        foes: ["kamokutsu", "kamokutsu"],
        order: [healer, "foe-1", "foe-2", "hero", "alda"],
      })
      .build()
    return {
      state,
      game: createTestGame({ content: fixture, state, random }),
    }
  }

  /** (base+攻撃力)×威力 の振れ幅。 */
  function healRange(state: GameState, healer: string, power: number) {
    const member = state.members.find((entry) => entry.id === healer)!
    const attack = party.attack(member, state)
    return [
      Math.round((base + attack) * power * swing[0]),
      Math.round((base + attack) * power * swing[1]),
    ] as const
  }

  const actedOf = (events: readonly GameEvent[]) =>
    events.find((event) => event.type === "acted") as Extract<
      GameEvent,
      { type: "acted" }
    >

  it("モートとジグは回復役で、手当て・蘇生・解毒のワザを自分のワザとして持つ", () => {
    const mortDef = memberBySlug("mort")
    const jigDef = memberBySlug("jig")
    expect(mortDef.role).toBe("healer")
    expect(jigDef.role).toBe("healer")
    expect(mortDef.skills).toEqual(
      expect.arrayContaining(
        [
          "grave-care",
          "grave-hymn",
          "grave-rite",
          "grave-raise",
          "clod-throw",
        ].map((slug) => skillBySlug(slug).id)
      )
    )
    expect(jigDef.skills).toEqual(
      expect.arrayContaining(
        ["hunter-aid", "waking-leaf", "poison-finish"].map(
          (slug) => skillBySlug(slug).id
        )
      )
    )
    // 画面に出る役割も回復役
    const mortView = healerBattle("mort").game
    expect(mortView.queries.member(mortView.state, mort)!.roles).toEqual([
      "healer",
    ])
    const jigView = healerBattle("jig").game
    expect(jigView.queries.member(jigView.state, jig)!.roles).toEqual([
      "healer",
    ])
  })

  it("弔いの手当ては味方ひとりを (base+攻撃力)×威力 の振れ幅で癒やし、最大HPを超えない", () => {
    // 威力の数値は作品データから読む（調整で変わるため書き写さない）
    const care = skillBySlug("grave-care")
    for (const random of [0, 0.5, 0.99]) {
      const { state, game } = healerBattle(
        "mort",
        (member) => (member.id === alda ? { hp: 1 } : {}),
        random
      )
      const [low, high] = healRange(state, mort, care.power!)
      const acted = actedOf(
        eventsOrThrow(
          game.send({
            type: "act",
            command: "skill",
            skill: care.id,
            target: alda,
          })
        )
      )
      expect(acted.results).toHaveLength(1)
      expect(acted.results[0].target.id).toBe(alda)
      expect(acted.results[0].heal).toBeGreaterThanOrEqual(low)
      expect(acted.results[0].heal).toBeLessThanOrEqual(high)
      expect(game.queries.member(game.state, alda)!.hp).toBe(
        1 + acted.results[0].heal!
      )
    }
    // 満タン近くなら足りない分だけ戻す
    const { game } = healerBattle("mort", (member) =>
      member.id === alda ? { hp: 1 } : {}
    )
    const maxHp = game.queries.member(game.state, alda)!.maxHp
    const nearlyFull = healerBattle("mort", (member) =>
      member.id === alda ? { hp: maxHp - 1 } : {}
    ).game
    const topped = actedOf(
      eventsOrThrow(
        nearlyFull.send({
          type: "act",
          command: "skill",
          skill: care.id,
          target: alda,
        })
      )
    )
    expect(topped.results[0].heal).toBe(1)
    expect(nearlyFull.queries.member(nearlyFull.state, alda)!.hp).toBe(maxHp)
  })

  it("墓起こしは倒れた味方を (base+攻撃力)×1.6 のHPで起こし、倒れた仲間がいなければ断られる", () => {
    const raise = skillBySlug("grave-raise")
    expect(raise.revive).toBe(true)
    const { state, game } = healerBattle("mort", (member) =>
      member.id === alda ? { hp: 0 } : {}
    )
    const view = game.queries
      .commands(game.state, mort)!
      .skills.find((entry) => entry.id === raise.id)!
    expect(view.usable).toBe(true)
    const [low, high] = healRange(state, mort, raise.power!)
    const acted = actedOf(
      eventsOrThrow(
        game.send({ type: "act", command: "skill", skill: raise.id })
      )
    )
    expect(acted.results[0]).toMatchObject({
      target: { kind: "member", id: alda },
      revived: true,
    })
    const hp = game.queries.member(game.state, alda)!.hp
    expect(hp).toBe(acted.results[0].heal)
    expect(hp).toBeGreaterThanOrEqual(low)
    expect(hp).toBeLessThanOrEqual(high)
    // 倒れた仲間がいなければ選べず、送っても断られて状態は変わらない
    const alive = healerBattle("mort").game
    expect(
      alive.queries
        .commands(alive.state, mort)!
        .skills.find((entry) => entry.id === raise.id)!.usable
    ).toBe(false)
    const before = alive.state
    expect(
      alive.send({ type: "act", command: "skill", skill: raise.id })
    ).toBeInstanceOf(GameCommandError)
    expect(alive.state).toBe(before)
  })

  it("土くれの手当ては味方ひとりの防具の耐久を戻す", () => {
    const rite = skillBySlug("grave-rite")
    const { game, state: worn } = healerBattle("mort")
    const armor = game.queries.member(game.state, alda)!.armor!
    const gear = worn.gear.find(
      (entry) => entry.owner === alda && entry.good === armor.good
    )!
    // 繕う量より多く減らせるよう、アルダには鎖かたびらを着せる
    const mail = goodBySlug("mail")
    const wear = rite.repair! + 7
    expect(mail.durability!).toBeGreaterThanOrEqual(wear)
    const state = {
      ...worn,
      gear: worn.gear.map((entry) =>
        entry.id === gear.id ? { ...entry, good: mail.id, wear } : entry
      ),
    }
    const play = createTestGame({
      content: aContent().withFoe("kamokutsu", { hp: 4000 }).build(),
      state,
      random: 0.5,
    })
    const acted = actedOf(
      eventsOrThrow(
        play.send({
          type: "act",
          command: "skill",
          skill: rite.id,
          target: alda,
        })
      )
    )
    expect(acted.results[0]).toMatchObject({
      target: { kind: "member", id: alda },
      repaired: rite.repair,
    })
    expect(play.queries.member(play.state, alda)!.armor!.wear).toBe(
      wear - rite.repair!
    )
  })

  it("弔いの歌は生きている味方全員を癒やす", () => {
    const hymn = skillBySlug("grave-hymn")
    expect(hymn.target).toBe("allies")
    const { state, game } = healerBattle("mort", (member) =>
      member.id === alda || member.id === hero ? { hp: 1 } : {}
    )
    const acted = actedOf(
      eventsOrThrow(
        game.send({ type: "act", command: "skill", skill: hymn.id })
      )
    )
    const healed = acted.results.filter((result) => (result.heal ?? 0) > 0)
    expect(healed.map((result) => result.target.id)).toEqual(
      expect.arrayContaining([alda, hero])
    )
    for (const result of acted.results) {
      const before = state.members.find(
        (member) => member.id === result.target.id
      )!
      const after = game.state.members.find(
        (member) => member.id === result.target.id
      )!
      expect(after.hp).toBe(before.hp + (result.heal ?? 0))
    }
  })

  it("土くれ投げは遠距離なので、後衛から投げても威力が下がらない", () => {
    const clod = skillBySlug("clod-throw")
    expect(clod.kind).toBe("hit")
    expect(clod.reach).toBe("ranged")
    const { game } = healerBattle("mort")
    const view = game.queries
      .commands(game.state, mort)
      ?.skills.find((skill) => skill.id === clod.id)
    expect(view?.weak).toBe(false)
    const acted = actedOf(
      eventsOrThrow(
        game.send({ type: "act", command: "skill", skill: clod.id })
      )
    )
    expect(acted.results).toHaveLength(1)
    expect(acted.results[0].damage).toBeGreaterThan(0)
  })

  it("狩人の手当ては味方ひとりを癒やし、毒と縛りだけを解く", () => {
    const aid = skillBySlug("hunter-aid")
    const { state, game } = healerBattle("jig", (member) =>
      member.id === alda
        ? {
            hp: 1,
            status: [
              { kind: "poison", turns: 3 },
              { kind: "bind", turns: 2 },
              { kind: "protect", turns: 2 },
            ],
          }
        : member.id === hero
          ? { status: [{ kind: "poison", turns: 3 }] }
          : {}
    )
    const [low, high] = healRange(state, jig, aid.power!)
    const acted = actedOf(
      eventsOrThrow(
        game.send({
          type: "act",
          command: "skill",
          skill: aid.id,
          target: alda,
        })
      )
    )
    expect(acted.results).toHaveLength(1)
    expect(acted.results[0].target.id).toBe(alda)
    expect(acted.results[0].heal).toBeGreaterThanOrEqual(low)
    expect(acted.results[0].heal).toBeLessThanOrEqual(high)
    expect([...acted.results[0].cured!].sort()).toEqual(["bind", "poison"])
    expect(
      game.state.members
        .find((member) => member.id === alda)!
        .status.map((entry) => entry.kind)
    ).toEqual(["protect"])
    // ひとり分なので、ほかの仲間の毒は残る
    expect(
      game.state.members
        .find((member) => member.id === hero)!
        .status.map((entry) => entry.kind)
    ).toEqual(["poison"])
  })

  it("気付けの葉は生きている味方全員の毒と縛りを解き、傷を少し塞ぐ", () => {
    const leaf = skillBySlug("waking-leaf")
    const { state, game } = healerBattle("jig", (member) =>
      member.id === alda
        ? { hp: 0 }
        : member.id === hero
          ? { hp: 10, status: [{ kind: "bind", turns: 2 }] }
          : member.id === jig
            ? { hp: 10, status: [{ kind: "poison", turns: 3 }] }
            : {}
    )
    const [low, high] = healRange(state, jig, leaf.power!)
    const acted = actedOf(
      eventsOrThrow(
        game.send({ type: "act", command: "skill", skill: leaf.id })
      )
    )
    // 倒れた仲間には当たらない
    expect(acted.results.map((result) => result.target.id)).toEqual(
      state.party.filter((id) => id !== alda)
    )
    for (const id of [hero, jig]) {
      const result = acted.results.find((entry) => entry.target.id === id)!
      expect(result.heal).toBeGreaterThanOrEqual(low)
      expect(result.heal).toBeLessThanOrEqual(high)
      expect(game.queries.member(game.state, id)!.status).toEqual([])
    }
    expect(
      acted.results.find((entry) => entry.target.id === hero)!.cured
    ).toEqual(["bind"])
    expect(
      acted.results.find((entry) => entry.target.id === jig)!.cured
    ).toEqual(["poison"])
    expect(game.queries.member(game.state, alda)!.hp).toBe(0)
  })
})
