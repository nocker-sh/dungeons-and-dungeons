import { describe, expect, it } from "vite-plus/test"
import { GameCommandError } from "@/lib/wiz/game/game-command-error"
import type { Game } from "@/lib/wiz/game/game"
import type { GameState } from "@/lib/wiz/state/state-schema"
import { aState } from "@/lib/wiz/testing/state-builder"
import { contentId } from "@/lib/wiz/testing/content-id"
import { goodBySlug } from "@/lib/wiz/testing/good-by-slug"
import { memberBySlug } from "@/lib/wiz/testing/member-by-slug"
import { realContent } from "@/lib/wiz/testing/real-content"
import { recruitBySlug } from "@/lib/wiz/testing/recruit-by-slug"
import { createTestGame } from "@/lib/wiz/testing/create-test-game"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"
import { sequentialIds } from "@/lib/wiz/testing/sequential-ids"
import { sequenceRandom } from "@/lib/wiz/testing/sequence-random"

const idOf = (slug: string) => memberBySlug(slug).id

function gameOf(state: GameState) {
  return createTestGame({ state, ids: sequentialIds("probe") })
}

/** 革の鎧を着られる戦士と僧侶に着せ、耐久を減らした状態。 */
function wornArmor(gold: number, wear = 7) {
  const leather = goodBySlug("leather")
  const game = createTestGame({
    state: aState()
      .withGold(gold + leather.price! * 2)
      .build(),
  })
  for (const _ of [1, 2])
    eventsOrThrow(
      game.send({
        type: "buy",
        shop: contentId("armory"),
        good: contentId("leather"),
      })
    )
  const [first, second] = game.state.gear.filter(
    (gear) => gear.good === leather.id && !gear.owner
  )
  eventsOrThrow(
    game.send({ type: "equip", gear: first.id, member: contentId("alda") })
  )
  eventsOrThrow(
    game.send({ type: "equip", gear: second.id, member: contentId("mort") })
  )
  const worn = new Map([
    [first.id, wear],
    [second.id, Math.max(0, wear - 3)],
  ])
  return {
    ...game.state,
    gear: game.state.gear.map((gear) =>
      worn.has(gear.id) ? { ...gear, wear: worn.get(gear.id)! } : gear
    ),
  } as GameState
}

/** ハスキー（SR・ユニーク）を雇ったプレイ。固有の武器と防具を持って控えに入る。 */
function withUnique(gold = 500) {
  const game = createTestGame({
    state: aState()
      .withGold(gold + recruitBySlug("sr-husky").price)
      .withBoard(["sr-husky"])
      .withItem("junk", 3)
      .build(),
  })
  eventsOrThrow(game.send({ type: "recruit", recruit: contentId("sr-husky") }))
  return game
}

function accepted(result: ReturnType<Game["send"]>) {
  return !(result instanceof GameCommandError)
}

describe("表示した値段と実際に払う額（hunt）", () => {
  // 品物ごと・所持金ごとにプレイを作るので重い。待つ時間を長めに取る
  it(
    "店の affordable は、そのお金で本当に買えるかと一致する",
    { timeout: 30000 },
    () => {
      const base = aState().build()
      const queries = gameOf(base).queries
      for (const shopId of ["armory", "tools", "apothecary"].map(contentId)) {
        for (const entry of queries.shop(base, shopId)!.goods) {
          for (const gold of [
            0,
            entry.price - 1,
            entry.price,
            entry.price + 1,
          ]) {
            if (gold < 0) continue
            const state = aState().withGold(gold).build()
            const game = gameOf(state)
            const view = game.queries
              .shop(state, shopId)!
              .goods.find((item) => item.id === entry.id)!
            const result = game.send({
              type: "buy",
              shop: shopId,
              good: entry.id,
            })
            expect(accepted(result), `${shopId}/${entry.id}/${gold}`).toBe(
              view.affordable
            )
            if (view.affordable) expect(game.state.gold).toBe(gold - view.price)
            else expect(game.state.gold).toBe(gold)
          }
        }
      }
    }
  )

  it("買うと店に出した値段だけ減り、持っている数が1増える", () => {
    for (const goodId of ["dagger", "leather", "potion"].map(contentId)) {
      const state = aState().withGold(500).build()
      const game = gameOf(state)
      const before = game.queries
        .shop(state, contentId("armory"))
        ?.goods.find((entry) => entry.id === goodId)
      const view =
        before ??
        game.queries
          .shop(state, contentId("apothecary"))!
          .goods.find((entry) => entry.id === goodId)!
      const shop = contentId(before ? "armory" : "apothecary")
      eventsOrThrow(game.send({ type: "buy", shop, good: goodId }))
      const after = game.queries
        .shop(game.state, shop)!
        .goods.find((entry) => entry.id === goodId)!
      expect(game.state.gold).toBe(500 - view.price)
      expect(after.own).toBe(view.own + 1)
    }
  })

  it("売れる物に出した値段ぴったりのお金が入る", () => {
    const state = aState().withGold(0).build()
    for (const entry of gameOf(state).queries.sellables(state)) {
      const game = gameOf(state)
      const result = game.send(
        entry.sell.gear
          ? { type: "sell", gear: entry.sell.gear }
          : { type: "sell", good: entry.sell.good! }
      )
      expect(accepted(result), entry.key).toBe(true)
      expect(game.state.gold, entry.key).toBe(entry.price)
    }
  })

  it("鑑定で出た珍しい武器は、売れる値段もレア度の分だけ高い", () => {
    // 品物は候補先頭の武器、次の乱数で重みの末尾（SR）を引く
    const game = createTestGame({
      random: sequenceRandom([0, 0.99], 0.99),
      state: aState().withGold(0).withItem("junk", 1).build(),
    })
    eventsOrThrow(game.send({ type: "appraise", shop: contentId("armory") }))
    const gearId = game.state.gear.at(-1)!.id
    const entry = game.queries
      .sellables(game.state)
      .find((item) => item.sell.gear === gearId)!
    const individual = game.queries
      .gear(game.state)
      .find((item) => item.gear === gearId)!
    expect(individual.rarity).toBe("SR")
    // 鑑定限定品にも明示の売値がある。N の基準価格より高い
    const good = realContent().goods.find((good) => good.id === individual.id)!
    const normalPrice = good.sell ?? Math.floor((good.price ?? 0) / 2)
    expect(normalPrice).toBeGreaterThan(0)
    expect(entry.price).toBeGreaterThan(normalPrice)
    eventsOrThrow(game.send({ type: "sell", gear: gearId }))
    expect(game.state.gold).toBe(entry.price)
  })

  it("誰かが着けている装備は売れる物に出ず、送っても断られる", () => {
    const state = aState().build()
    const game = gameOf(state)
    const owned = state.gear.filter((gear) => gear.owner)
    expect(owned.length).toBeGreaterThan(0)
    const keys = game.queries.sellables(state).map((entry) => entry.sell.gear)
    for (const gear of owned) {
      expect(keys).not.toContain(gear.id)
      const result = gameOf(state).send({ type: "sell", gear: gear.id })
      expect(result).toBeInstanceOf(GameCommandError)
      expect((result as GameCommandError).code).toBe("UNAVAILABLE")
    }
  })

  it("宿の affordable は、そのお金で泊まれるかと一致する", () => {
    const base = aState().build()
    for (const room of gameOf(base).queries.rooms(base)) {
      for (const gold of [0, room.price, Math.max(0, room.price - 1)]) {
        const state = aState().withGold(gold).build()
        const game = gameOf(state)
        const view = game.queries
          .rooms(state)
          .find((entry) => entry.id === room.id)!
        const result = game.send({ type: "rest", room: room.id })
        expect(accepted(result), `${room.id}/${gold}`).toBe(view.affordable)
        expect(game.state.gold).toBe(view.affordable ? gold - room.price : gold)
      }
    }
  })

  it("鍛冶屋の強化は ready のときだけ通り、出した費用ぴったり払う", () => {
    const state = aState().build()
    for (const entry of gameOf(state).queries.smithy(state)!.upgrades) {
      if (entry.max) continue
      for (const gold of [entry.gold! - 1, entry.gold!]) {
        for (const bone of [0, 5]) {
          const probe = bone
            ? aState().withGold(gold).withItem("bone", bone).build()
            : aState()
                .withGold(gold)
                .withBag(
                  aState()
                    .build()
                    .bag.filter((item) => item.good !== contentId("bone"))
                )
                .build()
          const game = gameOf(probe)
          const view = game.queries
            .smithy(probe)!
            .upgrades.find((item) => item.gear === entry.gear)!
          const result = game.send({ type: "upgrade", gear: entry.gear })
          expect(accepted(result), `${entry.gear}/${gold}/${bone}`).toBe(
            view.ready
          )
          expect(game.state.gold).toBe(view.ready ? gold - entry.gold! : gold)
        }
      }
    }
  })

  it("強化のあとの表示は、強化前に出した next とそろう", () => {
    const state = aState().withGold(500).withItem("bone", 9).build()
    const game = gameOf(state)
    const target = game.queries
      .smithy(state)!
      .upgrades.find((entry) => !entry.max)!
    eventsOrThrow(game.send({ type: "upgrade", gear: target.gear }))
    const after = game.queries
      .gear(game.state)
      .find((entry) => entry.gear === target.gear)!
    expect(after.name).toBe(target.next!.name)
    expect(after.stat).toBe(target.next!.stat)
    expect(after.plus).toBe(target.plus + 1)
  })

  it("作る物の ready は、お金と素材の両方がそろったときだけ", () => {
    const base = aState().build()
    for (const recipe of gameOf(base).queries.smithy(base)!.recipes) {
      const golds = recipe.gold > 0 ? [recipe.gold - 1, recipe.gold] : [0]
      for (const cinder of [0, 3]) {
        for (const gold of golds) {
          let builder = aState().withGold(gold).withItem("bone", 3)
          if (cinder) builder = builder.withItem("cinder", cinder)
          const probe = builder.build()
          const game = gameOf(probe)
          const view = game.queries
            .smithy(probe)!
            .recipes.find((entry) => entry.recipe === recipe.recipe)!
          const result = game.send({ type: "craft", recipe: recipe.recipe })
          expect(accepted(result), `${recipe.recipe}/${gold}/${cinder}`).toBe(
            view.ready
          )
          expect(game.state.gold).toBe(view.ready ? gold - recipe.gold : gold)
        }
      }
    }
  })

  it("修理の費用は一人分でも全部でも、出した額ぴったり払う", () => {
    const worn = wornArmor(1000)
    const game = gameOf(worn)
    const view = game.queries.repairs(worn)
    expect(view.rows.filter((row) => row.wear > 0).length).toBe(2)
    const perPoint = realContent().balance.armor.repairPerPoint
    for (const row of view.rows)
      expect(row.gold, row.member).toBe(Math.ceil(row.wear * perPoint))
    const one = view.rows.find((row) => row.wear > 0)!
    const single = gameOf(worn)
    eventsOrThrow(single.send({ type: "repair", member: one.member }))
    expect(single.state.gold).toBe(1000 - one.gold)
    expect(
      single.queries
        .repairs(single.state)
        .rows.find((row) => row.member === one.member)!.wear
    ).toBe(0)
    eventsOrThrow(game.send({ type: "repair" }))
    expect(game.state.gold).toBe(1000 - view.all.gold)
    expect(game.queries.repairs(game.state).all.wear).toBe(0)
  })

  it("お金が1足りなければ、修理も耐久も所持金も変わらない", () => {
    const priced = gameOf(wornArmor(1000)).queries.repairs(wornArmor(1000)).all
    const poor = wornArmor(priced.gold - 1)
    const game = gameOf(poor)
    const before = game.state
    expect(game.queries.repairs(poor).all.ready).toBe(false)
    const result = game.send({ type: "repair" })
    expect(result).toBeInstanceOf(GameCommandError)
    expect((result as GameCommandError).code).toBe("NO_GOLD")
    expect(game.state).toBe(before)
  })

  it("満タンの防具は直せない（ALREADY）", () => {
    const state = wornArmor(100, 0)
    const game = gameOf(state)
    expect(game.queries.repairs(state).all.ready).toBe(false)
    expect(game.queries.repairs(state).rows.every((row) => row.full)).toBe(true)
    expect((game.send({ type: "repair" }) as GameCommandError).code).toBe(
      "ALREADY"
    )
  })

  it("募集の affordable・hired は recruit の受理と一致する", () => {
    for (const slug of ["r-jig", "n-luca", "r-alma", "sr-husky"]) {
      const recruitId = contentId(slug)
      const state = aState().withBoard([recruitId]).build()
      const price = gameOf(state).queries.recruits(state)[0].price
      for (const gold of [price - 1, price]) {
        const probe = aState().withGold(gold).withBoard([recruitId]).build()
        const game = gameOf(probe)
        const view = game.queries.recruits(probe)[0]
        const result = game.send({ type: "recruit", recruit: recruitId })
        expect(accepted(result), `${recruitId}/${gold}`).toBe(view.affordable)
        expect(game.state.gold).toBe(view.affordable ? gold - price : gold)
      }
      // 雇ったあとは hired が立ち、もう雇えない
      const twice = createTestGame({
        state: aState().withGold(price).withBoard([recruitId]).build(),
      })
      eventsOrThrow(twice.send({ type: "recruit", recruit: recruitId }))
      expect(twice.queries.recruits(twice.state)[0].hired).toBe(true)
      expect(
        (
          twice.send({
            type: "recruit",
            recruit: recruitId,
          }) as GameCommandError
        ).code
      ).toBe("ALREADY")
    }
  })

  it("引き直しの値段ぴったりで枠が変わる", () => {
    const view = gameOf(aState().build()).queries.reroll(aState().build())
    const poor = aState()
      .withGold(view.price - 1)
      .build()
    expect(gameOf(poor).queries.reroll(poor).affordable).toBe(false)
    expect(
      (gameOf(poor).send({ type: "reroll" }) as GameCommandError).code
    ).toBe("NO_GOLD")
    const rich = aState().withGold(view.price).build()
    const game = gameOf(rich)
    expect(game.queries.reroll(rich).affordable).toBe(true)
    eventsOrThrow(game.send({ type: "reroll" }))
    expect(game.state.gold).toBe(0)
    expect(game.state.board.length).toBeLessThanOrEqual(
      realContent().recruiting.slots
    )
  })

  it("鍛え直しの ready と、素材ごとに出した手応えが実際と合う", () => {
    for (const rarity of ["N", "R", "SR"] as const) {
      // レア度の重み（N 92・R 7・SR 1、仮）の帯の中ほどを引く乱数
      const random = { N: 0.1, R: 0.95, SR: 0.995 }[rarity]
      const game = withUnique(200)
      // 鑑定でレア度つきの武器を手に入れ、それを素材にする
      const rolled = createTestGame({
        random: sequenceRandom([0, random], random),
        state: game.state,
        ids: sequentialIds("rolled"),
      })
      eventsOrThrow(
        rolled.send({ type: "appraise", shop: contentId("armory") })
      )
      const materialId = rolled.state.gear.at(-1)!.id
      const reforge = rolled.queries.reforges(rolled.state)[0]
      const material = reforge.materials.find(
        (entry) => entry.gear === materialId
      )!
      expect(material.rarity).toBe(rarity)
      expect(reforge.ready).toBe(true)
      eventsOrThrow(
        rolled.send({
          type: "reforge",
          gear: reforge.gear,
          material: materialId,
        })
      )
      const after = rolled.queries.reforges(rolled.state)[0]
      const total = reforge.progress + material.progress
      expect(after.plus).toBe(reforge.plus + Math.floor(total / reforge.need))
      expect(after.progress).toBe(total % reforge.need)
      expect(rolled.state.gold).toBe(200 - reforge.gold)
      // 素材にした武器は消える
      expect(rolled.state.gear.some((gear) => gear.id === materialId)).toBe(
        false
      )
    }
  })

  it("素材がなければ鍛え直しは ready にならない", () => {
    const game = withUnique(200)
    const view = game.queries.reforges(game.state)[0]
    expect(view.materials).toEqual([])
    expect(view.ready).toBe(false)
    expect(
      (
        game.send({
          type: "reforge",
          gear: view.gear,
          material: "nothing",
        }) as GameCommandError
      ).code
    ).toBe("UNKNOWN")
  })

  it("ユニークの固有の武器は強化の一覧に出ず、強化を送ると断られる", () => {
    const game = withUnique()
    const upgrades = game.queries.smithy(game.state)!.upgrades
    const fixed = game.state.gear.find(
      (gear) =>
        gear.owner === idOf("husky") && gear.good === contentId("iron-gloves")
    )!
    expect(upgrades.some((entry) => entry.gear === fixed.id)).toBe(false)
    expect(
      (game.send({ type: "upgrade", gear: fixed.id }) as GameCommandError).code
    ).toBe("FIXED_GEAR")
  })
})
