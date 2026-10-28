import { describe, expect, it } from "vite-plus/test"
import { GameStateBuilder } from "@/lib/wiz/testing/state-builder"
import { contentId } from "@/lib/wiz/testing/content-id"
import { goodBySlug } from "@/lib/wiz/testing/good-by-slug"
import { memberBySlug } from "@/lib/wiz/testing/member-by-slug"
import { createTestPlay } from "@/lib/wiz/testing/create-test-play"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"
import { startedState } from "@/lib/wiz/testing/started-state"
import { GameCommandError } from "@/lib/wiz/game/game-command-error"

const idOf = (slug: string) => memberBySlug(slug).id

describe("装備と隊列", () => {
  const hero = idOf("hero")
  const alda = idOf("alda")
  const mayu = idOf("mayu")
  const mort = idOf("mort")
  const jig = idOf("jig")

  it("[feature:W017] [feature:W018] 防具を着けると耐久ゲージが付き、防具は一人一つで付け替わる", () => {
    const { definition } = createTestPlay()
    const leatherDef = goodBySlug("leather")
    const mailDef = goodBySlug("mail")
    // 最初から着けている防具を外し、店で買った防具だけを見る
    const game = definition.create(
      undefined,
      GameStateBuilder.from(startedState(definition), definition.catalog)
        .withGold(5000)
        .withGear([])
        .build()
    )
    eventsOrThrow(
      game.send({
        type: "buy",
        shop: contentId("armory"),
        good: leatherDef.id,
      })
    )
    eventsOrThrow(
      game.send({ type: "buy", shop: contentId("armory"), good: mailDef.id })
    )
    const [leather, mail] = game.state.gear
    expect(game.queries.member(game.state, alda)!.armor).toBeNull()
    eventsOrThrow(game.send({ type: "equip", gear: leather.id, member: alda }))
    expect(game.queries.member(game.state, alda)!.armor).toMatchObject({
      name: leatherDef.name,
      durability: leatherDef.durability,
      maxDurability: leatherDef.durability,
    })
    // 防具は部位が一つ：別の防具を着けると前の防具が外れる
    const events = eventsOrThrow(
      game.send({ type: "equip", gear: mail.id, member: alda })
    )
    expect(events[0]).toMatchObject({ type: "equipped", replaced: leather.id })
    expect(game.queries.member(game.state, alda)!.armor).toMatchObject({
      name: mailDef.name,
      maxDurability: mailDef.durability,
    })
    expect(
      game.state.gear.find((gear) => gear.id === leather.id)?.owner
    ).toBeNull()
    eventsOrThrow(game.send({ type: "unequip", gear: mail.id }))
    expect(game.queries.member(game.state, alda)!.armor).toBeNull()
  })

  it("[feature:W017] ほかの仲間が着けている防具は付け替わる", () => {
    const { definition } = createTestPlay()
    const armor = goodBySlug("coat")
    const game = definition.create(
      undefined,
      GameStateBuilder.from(startedState(definition), definition.catalog)
        .withGold(5000)
        .withJoined("mayu")
        .build()
    )
    eventsOrThrow(
      game.send({ type: "buy", shop: contentId("armory"), good: armor.id })
    )
    const bought = game.state.gear.find((gear) => !gear.owner)!
    eventsOrThrow(game.send({ type: "equip", gear: bought.id, member: mayu }))
    expect(
      game.queries.member(game.state, mayu)!.gear.map((gear) => gear.good)
    ).toEqual([armor.id])
    eventsOrThrow(game.send({ type: "equip", gear: bought.id, member: alda }))
    expect(game.state.gear.find((gear) => gear.id === bought.id)?.owner).toBe(
      alda
    )
    expect(game.queries.member(game.state, mayu)!.armor).toBeNull()
  })

  it("[feature:W019] 控えと入れ替えると位置と前衛・後衛を引き継ぐ。主人公は外せない", () => {
    const { definition } = createTestPlay()
    const game = definition.create(
      undefined,
      GameStateBuilder.from(startedState(definition), definition.catalog)
        .withGold(5000)
        .withBoard(["r-jig"])
        .build()
    )
    eventsOrThrow(game.send({ type: "recruit", recruit: contentId("r-jig") }))
    expect(
      (game.send({ type: "swap", out: hero, in: jig }) as GameCommandError).code
    ).toBe("HERO")
    eventsOrThrow(game.send({ type: "swap", out: mort, in: jig }))
    expect(game.state.party).toEqual([hero, alda, jig])
    expect(game.queries.member(game.state, jig)?.row).toBe("back")
    expect(game.queries.reserve(game.state).map((member) => member.id)).toEqual(
      [mort]
    )
  })

  it("[feature:W020] 並びの左2人が前衛。前衛と後衛を一人ずつ入れ替えると位置が入れ替わる", () => {
    const { game } = createTestPlay()
    expect(game.queries.member(game.state, hero)?.row).toBe("front")
    expect(game.queries.member(game.state, mort)?.row).toBe("back")
  })

  it("[feature:W020] 前衛と後衛を一人ずつ入れ替える", () => {
    const { game } = createTestPlay()
    expect(
      (
        game.send({
          type: "swap-rows",
          a: hero,
          b: alda,
        }) as GameCommandError
      ).code
    ).toBe("UNAVAILABLE")
    eventsOrThrow(game.send({ type: "swap-rows", a: alda, b: mort }))
    expect(game.queries.member(game.state, alda)?.row).toBe("back")
    expect(game.queries.member(game.state, mort)?.row).toBe("front")
    expect(game.state.party).toEqual([hero, mort, alda])
    // 後衛へ移ると近接のワザに weak の印が付き、前衛へ移ると消える
    const weakOf = (member: string) =>
      game.queries
        .commands(game.state, member)
        ?.weaponSkills.filter((skill) => skill.reach === "melee")
        .map((skill) => skill.weak)
    expect(weakOf(alda)?.every((weak) => weak)).toBe(true)
    expect(weakOf(mort)?.every((weak) => !weak)).toBe(true)
  })

  it("[feature:W009] 誰も着けていない装備は売れ、着けている装備は売れない", () => {
    const { definition } = createTestPlay()
    const game = definition.create(
      undefined,
      GameStateBuilder.from(startedState(definition), definition.catalog)
        .withJoined("mayu")
        .withEquipped("mayu", "axe")
        .build()
    )
    const axe = game.state.gear.find((gear) => gear.good === contentId("axe"))!
    expect(
      (game.send({ type: "sell", gear: axe.id }) as GameCommandError).code
    ).toBe("UNAVAILABLE")
    eventsOrThrow(game.send({ type: "unequip", gear: axe.id }))
    const gold = game.state.gold
    const price = game.queries
      .gear(game.state)
      .find((entry) => entry.gear === axe.id)!.price
    eventsOrThrow(game.send({ type: "sell", gear: axe.id }))
    expect(game.state.gold).toBe(gold + price)
    expect(game.state.gear.some((gear) => gear.id === axe.id)).toBe(false)
  })

  it("[feature:W001] 倒れた仲間や疲れ切った仲間がいると出撃できない", () => {
    const { definition } = createTestPlay()
    const base = startedState(definition)
    const down = definition.create(undefined, {
      ...base,
      members: base.members.map((member) =>
        member.id === alda ? { ...member, hp: 0 } : member
      ),
    })
    expect(
      (
        down.send({
          type: "depart",
          layer: contentId("layer0"),
        }) as GameCommandError
      ).code
    ).toBe("DOWN")
    const tired = definition.create(undefined, {
      ...base,
      members: base.members.map((member) =>
        member.id === alda ? { ...member, fatigue: 100 } : member
      ),
    })
    expect(
      (
        tired.send({
          type: "depart",
          layer: contentId("layer0"),
        }) as GameCommandError
      ).code
    ).toBe("TIRED")
    expect(tired.queries.readiness(tired.state)).toEqual({
      ready: false,
      unregistered: false,
      short: 0,
      slots: 3,
      down: [],
      tired: [memberBySlug("alda").name],
    })
  })
})
