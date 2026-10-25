import { describe, expect, it } from "vite-plus/test"
import {
  aState,
  aContent,
  createTestGame,
  goodBySlug,
  contentId,
  realContent,
} from "@/lib/wiz/testing"
import {
  createTestPlay,
  eventsOrThrow,
  fightToEnd,
  startedState,
} from "@/lib/wiz/testing"
import {
  GameCommandError,
  GameDefinition,
  WizWorldEnvironment,
  type GameEvent,
  type GameState,
} from "@/lib/wiz"

describe("街", () => {
  it("[feature:W007] 宿は部屋の料金を払い、良い部屋では経験値に応じてレベルが上がる", () => {
    const { definition } = createTestPlay()
    const base = startedState(definition)
    const initial = definition.create(undefined, base)
    const state: GameState = {
      ...base,
      members: base.members.map((member) => ({
        ...member,
        hp: 1,
        exp: initial.queries.member(base, member.id)!.next,
      })),
    }
    const game = definition.create(
      WizWorldEnvironment.create({
        random: () => 0.5,
        now: () => 0,
        nextId: () => "x",
      }),
      state
    )
    const attic = eventsOrThrow(
      game.send({ type: "rest", room: contentId("attic") })
    )
    expect(attic).toEqual([
      { type: "rested", room: contentId("attic"), levelUps: [] },
    ])
    const events = eventsOrThrow(
      game.send({ type: "rest", room: contentId("normal") })
    )
    const rested = events[0] as Extract<GameEvent, { type: "rested" }>
    // 各仲間の次レベルに必要な経験値ちょうどを用意し、全員が一段だけ上がる。
    expect(
      rested.levelUps.map((entry) => [entry.member, entry.from, entry.to])
    ).toEqual(
      base.members
        .filter((member) => member.id !== contentId("hero"))
        .map((member) => [member.id, member.lv, member.lv + 1])
    )
    const normal = realContent().rooms.find(
      (room) => room.id === contentId("normal")
    )!
    expect(game.state.gold).toBe(base.gold - normal.price)
    expect(
      game.state.members.every((member) =>
        member.id === contentId("hero")
          ? member.exp ===
            state.members.find((entry) => entry.id === member.id)!.exp
          : member.exp === 0
      )
    ).toBe(true)
    expect(
      game.queries
        .party(game.state)
        .every((member) => member.hp === member.maxHp)
    ).toBe(true)
  })

  it("[feature:W008] 所持金が足りなければ泊まれず、買えない", () => {
    const { definition } = createTestPlay()
    const game = definition.create(undefined, {
      ...startedState(definition),
      gold: 10,
    })
    expect(
      (
        game.send({
          type: "rest",
          room: contentId("deluxe"),
        }) as GameCommandError
      ).code
    ).toBe("NO_GOLD")
    expect(
      (
        game.send({
          type: "buy",
          shop: contentId("armory"),
          good: contentId("axe"),
        }) as GameCommandError
      ).code
    ).toBe("NO_GOLD")
    expect(game.state.gold).toBe(10)
  })

  it("[feature:W009] 武器は個体として買え、道具は袋に入る。売ると所持金が増える", () => {
    const game = createTestGame({
      state: aState().withGold(1000).withItem("crystal", 1).build(),
    })
    const dagger = goodBySlug("dagger")
    const rope = goodBySlug("rope")
    const crystal = goodBySlug("crystal")
    const beforeGear = game.state.gear.length
    eventsOrThrow(
      game.send({ type: "buy", shop: contentId("armory"), good: dagger.id })
    )
    eventsOrThrow(
      game.send({ type: "buy", shop: contentId("tools"), good: rope.id })
    )
    expect(game.state.gold).toBe(1000 - dagger.price! - rope.price!)
    expect(game.state.gear).toHaveLength(beforeGear + 1)
    expect(game.state.gear.at(-1)).toMatchObject({
      good: dagger.id,
      owner: null,
      plus: 0,
      progress: 0,
      wear: 0,
      weapon: { rarity: "N", extraPower: 0, skills: expect.any(Array) },
    })
    const skills = game.state.gear.at(-1)!.weapon!.skills
    expect(skills).toHaveLength(3)
    expect(new Set(skills).size).toBe(3)
    expect(skills[0]).toBe(dagger.skills![0])
    const pool = realContent().weaponSkills[dagger.weaponType!]
    for (const skill of skills.slice(1)) expect(pool).toContain(skill)
    expect(
      game.queries.items(game.state).find((entry) => entry.id === rope.id)
        ?.count
    ).toBe(1)
    eventsOrThrow(game.send({ type: "sell", good: crystal.id }))
    expect(game.state.gold).toBe(
      1000 - dagger.price! - rope.price! + crystal.sell!
    )
    const before = game.state
    expect(
      (
        game.send({
          type: "buy",
          shop: contentId("tools"),
          good: contentId("axe"),
        }) as GameCommandError
      ).code
    ).toBe("UNKNOWN")
    expect(game.state).toBe(before)
  })

  it("[feature:W009] 防具の売値は減った耐久だけ下がり、直してから売るより損しない", () => {
    const { definition } = createTestPlay()
    const base = startedState(definition)
    const worn = 10
    const game = definition.create(undefined, {
      ...base,
      gold: 2000,
      gear: [
        ...base.gear,
        {
          id: "full",
          good: contentId("mail"),
          owner: null,
          plus: 0,
          progress: 0,
          wear: 0,
          weapon: null,
        },
        {
          id: "worn",
          good: contentId("mail"),
          owner: null,
          plus: 0,
          progress: 0,
          wear: worn,
          weapon: null,
        },
        {
          id: "plus",
          good: contentId("mail"),
          owner: null,
          plus: 2,
          progress: 0,
          wear: 0,
          weapon: null,
        },
      ],
    })
    const priceOf = (id: string) =>
      game.queries.gear(game.state).find((entry) => entry.gear === id)!.price
    const repair = game.queries
      .gear(game.state)
      .find((entry) => entry.gear === "worn")!.armor!.gold
    // 減った耐久のぶんは、直すのにかかる額だけ売値から引かれる
    expect(priceOf("worn")).toBe(priceOf("full") - repair)
    // 直してから売っても手取りは同じ（売る方が損にならない）
    expect(priceOf("worn")).toBeGreaterThanOrEqual(priceOf("full") - repair)
    // 強化した段は売値に乗る（balance.sell.perPlus）
    expect(priceOf("plus")).toBeGreaterThan(priceOf("full"))
    const gold = game.state.gold
    eventsOrThrow(game.send({ type: "sell", gear: "worn" }))
    expect(game.state.gold).toBe(gold + priceOf("full") - repair)
  })

  it("[feature:W012] 召喚石は店で買える（袋には入らない）", () => {
    const { definition } = createTestPlay()
    const base = startedState(definition)
    const game = definition.create(undefined, { ...base, gold: 2000 })
    const before = game.state.stones
    eventsOrThrow(
      game.send({
        type: "buy",
        shop: contentId("tools"),
        good: contentId("stone"),
      })
    )
    // 召喚石は袋に入らず、持っている石が増える
    expect(game.state.stones).toBe(before + 1)
    expect(
      game.state.bag.some((entry) => entry.good === contentId("stone"))
    ).toBe(false)
  })

  it("[feature:W008] 深い層で並ぶ品物は、その層まで届いてから買える", () => {
    const { definition } = createTestPlay()
    const shallow = definition.create(undefined, {
      ...startedState(definition),
      gold: 1000,
    })
    const stock = (game: ReturnType<typeof definition.create>) =>
      game.queries
        .shop(game.state, contentId("armory"))!
        .goods.map((entry) => entry.key)
    expect(stock(shallow)).not.toContain(contentId("bone-sword"))
    expect(
      (
        shallow.send({
          type: "buy",
          shop: contentId("armory"),
          good: contentId("bone-sword"),
        }) as GameCommandError
      ).code
    ).toBe("LOCKED")
    expect(shallow.state.gold).toBe(1000)
    const deep = definition.create(undefined, {
      ...startedState(definition),
      gold: 1000,
      reached: 1,
    })
    expect(stock(deep)).toContain(contentId("bone-sword"))
    eventsOrThrow(
      deep.send({
        type: "buy",
        shop: contentId("armory"),
        good: contentId("bone-sword"),
      })
    )
    expect(deep.state.gold).toBe(1000 - goodBySlug("bone-sword").price!)
  })

  it("[feature:W010] 鑑定はガラクタを一つ使い、店ごとの品に変える", () => {
    const game = createTestGame({
      random: 0,
      state: aState().withItem("junk", 3).build(),
    })
    eventsOrThrow(game.send({ type: "appraise", shop: contentId("armory") }))
    expect(game.queries.junk(game.state).count).toBe(2)
    expect(game.state.gear.at(-1)?.good).toBe(contentId("greatsword"))
    expect(
      (
        game.send({
          type: "appraise",
          shop: contentId("apothecary"),
        }) as GameCommandError
      ).code
    ).toBe("UNAVAILABLE")
  })

  it("[feature:W011] 募集の枠にいる冒険者とだけ契約でき、契約済みは二度雇えない", () => {
    const game = createTestGame({
      state: aState().withGold(1000).withBoard(["r-jig", "n-luca"]).build(),
    })
    expect(game.queries.recruits(game.state).map((entry) => entry.id)).toEqual([
      contentId("r-jig"),
      contentId("n-luca"),
    ])
    expect(
      (
        game.send({
          type: "recruit",
          recruit: contentId("r-tsumugi"),
        }) as GameCommandError
      ).code
    ).toBe("UNAVAILABLE")
    eventsOrThrow(game.send({ type: "recruit", recruit: contentId("n-luca") }))
    expect(game.state.members.map((member) => member.id)).toContain(
      contentId("luca")
    )
    expect(game.state.party).not.toContain(contentId("luca"))
    expect(
      game.queries
        .recruits(game.state)
        .find((entry) => entry.id === contentId("n-luca"))?.hired
    ).toBe(true)
    expect(
      (
        game.send({
          type: "recruit",
          recruit: contentId("n-luca"),
        }) as GameCommandError
      ).code
    ).toBe("ALREADY")
  })

  it("[feature:W022] お金を払うと募集の枠を重みつきで引き直し、枠は次に引き直すまで残る", () => {
    const rolls = [0.99, 0.0]
    const source = realContent()
    const candidates = [contentId("r-jig"), contentId("n-luca")]
    const content = {
      ...source,
      recruiting: {
        ...source.recruiting,
        slots: 2,
        initial: source.recruiting.initial.slice(0, 2),
      },
      recruits: source.recruits.map((recruit) => ({
        ...recruit,
        retired: !candidates.includes(recruit.id),
      })),
    }
    const { game } = createTestPlay(() => rolls.shift() ?? 0.5, content)
    const gold = game.state.gold
    const events = eventsOrThrow(game.send({ type: "reroll" }))
    // 現役候補をジグとルカに限定し、末尾→先頭の2枠を引く。
    expect(events).toEqual([
      { type: "rerolled", board: [contentId("n-luca"), contentId("r-jig")] },
    ])
    expect(game.state.gold).toBe(gold - realContent().recruiting.reroll)
    expect(game.state.board).toEqual([contentId("n-luca"), contentId("r-jig")])
    eventsOrThrow(game.send({ type: "recruit", recruit: contentId("r-jig") }))
    expect(game.state.board).toEqual([contentId("n-luca"), contentId("r-jig")])
    const poorDefinition = new GameDefinition({
      ...realContent(),
      startingGold: 10,
    })
    const poor = poorDefinition.create(undefined, startedState(poorDefinition))
    expect((poor.send({ type: "reroll" }) as GameCommandError).code).toBe(
      "NO_GOLD"
    )
  })

  it("[feature:W012] ガチャ操作は資産を変えずに拒否する", () => {
    const { game } = createTestPlay(0.9)
    const before = game.save()
    expect((game.send({ type: "summon" }) as GameCommandError).code).toBe(
      "INVALID_ACTION"
    )
    expect(game.save()).toEqual(before)
  })

  it("[feature:W012] 契約済みの悪魔を重複の召喚で成長させない", () => {
    const { game } = createTestPlay(0.1)
    const before = game.save()
    for (let index = 0; index < 3; index++)
      expect(game.send({ type: "summon" })).toBeInstanceOf(GameCommandError)
    expect(game.save()).toEqual(before)
  })

  it("[feature:W013] 契約した悪魔からだけ合体する悪魔を選べる", () => {
    const game = createTestGame()
    expect(
      (
        game.send({
          type: "choose-demon",
          demon: contentId("tris"),
        }) as GameCommandError
      ).code
    ).toBe("NOT_OWNED")
    const saved = game.save()
    expect(
      game.restore({
        ...saved,
        snapshot: {
          ...saved.snapshot,
          demons: [
            ...saved.snapshot.demons,
            { id: contentId("tris"), lv: 1, exp: 0 },
          ],
        },
      })
    ).toBeUndefined()
    eventsOrThrow(game.send({ type: "choose-demon", demon: contentId("tris") }))
    expect(game.queries.demon(game.state)?.name).toBe("三つ石の悪魔トリス")
    expect(
      game.queries
        .commands(game.state, contentId("hero"))
        ?.skills.map((skill) => skill.id)
    ).toEqual([
      contentId("pebbles"),
      contentId("stonewall"),
      contentId("blood"),
    ])
  })

  it("[feature:W023] 鍛冶屋で装備を強化すると、段ごとの費用を払い上がる能力が1ずつ増える", () => {
    const game = createTestGame({
      state: aState()
        .withGold(1000)
        .withItem("bone", 1)
        .withEquipped("alda", "greatsword")
        .build(),
    })
    const sword = game.state.gear.find(
      (gear) => gear.good === contentId("greatsword")
    )!
    const before = game.queries.member(game.state, contentId("alda"))!.weapon!
      .attack
    eventsOrThrow(game.send({ type: "upgrade", gear: sword.id }))
    expect(game.state.gear.find((gear) => gear.id === sword.id)?.plus).toBe(1)
    expect(
      game.queries.member(game.state, contentId("alda"))!.weapon!.attack
    ).toBe(before + 1)
    expect(
      game.queries.gear(game.state).find((entry) => entry.gear === sword.id)
        ?.name
    ).toBe("鉄の両手剣+1")
    // +1で骨1つを消費し、+2に必要な骨2つは足りない
    expect(
      (game.send({ type: "upgrade", gear: sword.id }) as GameCommandError).code
    ).toBe("NO_MATERIALS")
  })

  it("[feature:W024] 鍛冶屋で素材から作る。武器は個体、道具は袋へ入る", () => {
    const source = realContent()
    // 道具レシピは作品にはないため、エンジンの袋への生産を検証する専用レシピ。
    const content = {
      ...source,
      smithy: {
        ...source.smithy!,
        recipes: [
          ...source.smithy!.recipes,
          {
            id: "test-craft-potion",
            good: contentId("potion"),
            gold: 20,
            materials: [{ good: contentId("bone"), count: 2 }],
          },
        ],
      },
    }
    const game = createTestGame({
      content,
      random: 0.9,
      state: aState(content).withGold(1000).withItem("bone", 3).build(),
    })
    expect(
      (
        game.send({
          type: "craft",
          recipe: contentId("craft-axe"),
        }) as GameCommandError
      ).code
    ).toBe("NO_MATERIALS")
    eventsOrThrow(
      game.send({
        type: "buy",
        shop: contentId("tools"),
        good: contentId("cinder"),
      })
    )
    const events = eventsOrThrow(
      game.send({ type: "craft", recipe: contentId("craft-axe") })
    )
    expect(events[0]).toMatchObject({ type: "crafted", good: contentId("axe") })
    expect(
      game.state.gear.filter(
        (gear) => gear.good === contentId("axe") && !gear.owner
      )
    ).toHaveLength(1)
    const beforePotion =
      game.queries
        .items(game.state)
        .find((entry) => entry.id === contentId("potion"))?.count ?? 0
    eventsOrThrow(game.send({ type: "craft", recipe: "test-craft-potion" }))
    expect(
      game.queries
        .items(game.state)
        .find((entry) => entry.id === contentId("potion"))?.count
    ).toBe(beforePotion + 1)
    const smithy = game.queries.smithy(game.state)!
    expect(
      smithy.recipes.find((entry) => entry.recipe === "test-craft-potion")
    ).toMatchObject({ ready: false })
  })

  it("[feature:W014] [feature:W015] 依頼は受けた後の撃破を数え、達成してから一度だけ報告できる", () => {
    // 討伐依頼は対象の敵を倒す操作を検証する。探索の抽選と戦闘難度は別のテストで扱い、対象のHPだけ1にする。
    const content = aContent()
      .withFoe("kamokutsu", { hp: 1 })
      .withStation("layer0", "n1", { foes: [contentId("kamokutsu")] })
      .build()
    let prepared = aState(content).withGold(1000)
    for (const member of [
      ...content.party,
      ...content.recruits.map((entry) => entry.member),
    ]) {
      if (prepared.build().party.includes(member.id))
        prepared = prepared.withEquipped(member.id, member.defaultWeapon!)
    }
    const game = createTestGame({ content, state: prepared.build() })
    eventsOrThrow(
      game.send({ type: "accept-quest", quest: contentId("q-mole") })
    )
    expect(
      (
        game.send({
          type: "claim-quest",
          quest: contentId("q-mole"),
        }) as GameCommandError
      ).code
    ).toBe("NOT_READY")
    for (let i = 0; i < 3; i++) {
      eventsOrThrow(game.send({ type: "depart", layer: contentId("layer0") }))
      eventsOrThrow(game.send({ type: "advance", to: "n1" }))
      expect(fightToEnd(game).some((event) => event.type === "victory")).toBe(
        true
      )
      eventsOrThrow(game.send({ type: "acknowledge" }))
      eventsOrThrow(game.send({ type: "retreat" }))
      eventsOrThrow(game.send({ type: "rest", room: contentId("attic") }))
    }
    expect(
      game.queries
        .quests(game.state)
        .find((quest) => quest.id === contentId("q-mole"))?.status
    ).toBe("ready")
    const gold = game.state.gold
    eventsOrThrow(
      game.send({ type: "claim-quest", quest: contentId("q-mole") })
    )
    expect(game.state.gold).toBe(gold + 40)
    expect(
      (
        game.send({
          type: "claim-quest",
          quest: contentId("q-mole"),
        }) as GameCommandError
      ).code
    ).toBe("ALREADY")
  })

  it("[feature:W016] 夜の雑談は仲間ひとりにつき一晩に一度", () => {
    const { game } = createTestPlay()
    expect(
      (
        game.send({
          type: "chat",
          liked: contentId("alda"),
        }) as GameCommandError
      ).code
    ).toBe("NOT_READY")
    const like = (id: string) => game.queries.member(game.state, id)?.like
    eventsOrThrow(game.send({ type: "rest", room: contentId("attic") }))
    // 泊まった分の1に、雑談の1が足される
    const rested = like(contentId("alda"))!
    eventsOrThrow(game.send({ type: "chat", liked: contentId("alda") }))
    expect(like(contentId("alda"))).toBe(rested + 1)
    // 同じ相手とは今夜もう話せない
    expect(
      (
        game.send({
          type: "chat",
          liked: contentId("alda"),
        }) as GameCommandError
      ).code
    ).toBe("ALREADY")
    // ほかの仲間とは今夜も話せる
    const other = game.state.party.find((id) => id !== contentId("alda"))!
    const before = like(other)!
    eventsOrThrow(game.send({ type: "chat", liked: other }))
    expect(like(other)).toBe(before + 1)
    // 泊まると夜が明け、また同じ相手と話せる
    eventsOrThrow(game.send({ type: "rest", room: contentId("attic") }))
    eventsOrThrow(game.send({ type: "chat", liked: contentId("alda") }))
    expect(like(contentId("alda"))).toBe(rested + 3)
  })
})
