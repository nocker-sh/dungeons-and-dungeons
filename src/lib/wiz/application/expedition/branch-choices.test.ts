import { describe, expect, it } from "vite-plus/test"
import { GameCommandError } from "@/lib/wiz"
import { Bag } from "@/lib/wiz/rules/bag"
import {
  aContent,
  aState,
  contentId,
  createTestGame,
  eventsOrThrow,
  fightToEnd,
  realContent,
  skillBySlug,
} from "@/lib/wiz/testing"

const book = "49c06f75-74e8-4a31-a9bb-d6b09e96d001"
const blessing = "49c06f75-74e8-4a31-a9bb-d6b09e96d016"
const atShrine = () =>
  aState().inExpedition({
    at: "l12",
    visited: ["s", "l12"],
    pending: { kind: "discovery" },
  })

describe("狙う報酬と代償で選ぶ分岐", () => {
  it("温室の固定敵の毒耐性を示し、未判明の敵は伏せる", () => {
    let randomCalls = 0
    const state = aState()
      .withReached(3)
      .inExpedition({
        layer: contentId("layer3"),
        at: "n4",
        visited: ["s", "n4"],
      })
      .build()
    const game = createTestGame({
      state,
      random: () => {
        randomCalls++
        return 0.5
      },
    })
    const saved = game.save()
    const path = game.queries
      .route(state)!
      .paths.find((entry) => entry.id === "u5")!
    expect(path.details).toContain("耐性（ステンドクラゲ）：毒無効")
    expect(path.details).toContain("耐性（バドアイ）：毒無効")
    const unknownState = aState()
      .withReached(3)
      .inExpedition({
        layer: contentId("layer3"),
        at: "n2",
        visited: ["s", "n2"],
      })
      .build()
    const unknown = game.queries
      .route(unknownState)!
      .paths.find((entry) => entry.id === "m3")!
    expect(unknown.details.join(" ")).not.toContain("耐性")
    expect(game.save()).toEqual(saved)
    expect(randomCalls).toBe(0)
  })

  it("説明に金額がない手当てでも、実際の支払いを結果に残す", () => {
    const game = createTestGame({
      state: aState()
        .withGold(100)
        .withMember("hero", { hp: 1 })
        .inExpedition({
          at: "n3",
          visited: ["s", "n3"],
          pending: { kind: "discovery" },
        })
        .build(),
    })
    eventsOrThrow(game.send({ type: "discover", choice: "heal" }))
    expect(game.state.gold).toBe(65)
    if (game.state.phase.type !== "expedition") throw new Error("探索ではない")
    const pending = game.state.phase.expedition.pending
    if (pending?.kind !== "treasure") throw new Error("結果がない")
    expect(pending.note).toContain("金貨35を支払った。")
  })

  it("休息は各ワザを3回戻し、複数のワザの回復合計を3回に制限しない", () => {
    const game = createTestGame({
      state: aState()
        .withEquipped("alda", "greatsword")
        .withMember("alda", {
          used: [
            { skill: skillBySlug("whirl").id, count: 1 },
            { skill: skillBySlug("charge").id, count: 3 },
          ],
        })
        .inExpedition({
          at: "l5",
          visited: ["s", "l5"],
          pending: { kind: "discovery" },
        })
        .build(),
    })
    const before = game.state
    const alda = before.members.find((member) => member.id === before.party[1])!
    expect(alda.used.reduce((sum, entry) => sum + entry.count, 0)).toBe(4)
    const rest = game.queries
      .route(before)!
      .discovery!.choices.find((choice) => choice.id === "rest")!
    expect(rest.description).toContain("各人の各ワザの残り回数を3回戻す")
    expect(rest.description).not.toContain("各人合計")
    eventsOrThrow(game.send({ type: "discover", choice: "rest" }))
    expect(
      game.state.members.find((member) => member.id === alda.id)!.used
    ).toEqual([])
    if (game.state.phase.type !== "expedition") throw new Error("探索ではない")
    const pending = game.state.phase.expedition.pending
    if (pending?.kind !== "treasure") throw new Error("結果がない")
    expect(pending.note).toContain("ワザの残りを合計4回戻した。")
  })
  it.each([
    { station: "l10", choice: "force", hp: 1 },
    { station: "l10", choice: "force", hp: 0 },
    { station: "l10", choice: "force", hp: 100 },
    { station: "l5", choice: "rest", hp: 1 },
    { station: "l5", choice: "rest", hp: 0 },
    { station: "l5", choice: "rest", hp: 100 },
  ])(
    "$station の $choice はHP$hpの実際の回復・被害を予告する",
    ({ station, choice, hp }) => {
      const game = createTestGame({
        state: aState()
          .withMember("hero", { hp })
          .inExpedition({
            at: station,
            visited: ["s", station],
            pending: { kind: "discovery" },
          })
          .build(),
      })
      const before = game.state
      const saved = game.save()
      const offer = game.queries
        .route(before)!
        .discovery!.choices.find((entry) => entry.id === choice)!
      const hero = before.party[0]
      expect(offer.healthChanges.some((entry) => entry.id === hero)).toBe(
        hp > 0
      )
      expect(offer.payment).toEqual([])
      expect(game.state).toBe(before)
      expect(game.save()).toEqual(saved)
      eventsOrThrow(game.send({ type: "discover", choice }))
      for (const predicted of offer.healthChanges)
        expect(
          game.state.members.find((member) => member.id === predicted.id)!.hp
        ).toBe(predicted.after)
      expect(game.state.members.find((member) => member.id === hero)!.hp).toBe(
        hp === 0
          ? 0
          : choice === "force"
            ? Math.max(
                1,
                hp - Math.floor(game.queries.member(before, hero)!.maxHp * 0.2)
              )
            : Math.min(
                game.queries.member(before, hero)!.maxHp,
                hp + Math.floor(game.queries.member(before, hero)!.maxHp * 0.3)
              )
      )
    }
  )
  it("交渉役がいる分岐の予告金額が、到着後の表示と実際の支払いに一致する", () => {
    let randomCalls = 0
    const game = createTestGame({
      state: aState()
        .withGold(100)
        .withExtraMember("alma")
        .withParty(["hero", "alda", "alma"])
        .inExpedition({ at: "n9", visited: ["s", "n9"] })
        .build(),
      random: () => {
        randomCalls++
        return 0.5
      },
    })
    const before = game.save()
    const callsBefore = randomCalls
    const details = game.queries
      .route(game.state)!
      .paths.find((path) => path.id === "l10")!
      .details.join(" ")
    expect(details).toContain("金貨26でスキルの書")
    expect(details).toContain("支払い：26G")
    expect(details).not.toContain("金貨30")
    expect(game.save()).toEqual(before)
    expect(randomCalls).toBe(callsBefore)
    eventsOrThrow(game.send({ type: "advance", to: "l10" }))
    const choice = game.queries
      .route(game.state)!
      .discovery!.choices.find((entry) => entry.id === "tools")!
    expect(choice.cost).toBe(26)
    expect(choice.label).toContain("金貨26")
    eventsOrThrow(game.send({ type: "discover", choice: "tools" }))
    expect(game.state.gold).toBe(74)
    if (game.state.phase.type !== "expedition") throw new Error("探索ではない")
    const pending = game.state.phase.expedition.pending
    expect(pending?.kind).toBe("treasure")
    if (pending?.kind !== "treasure") throw new Error("結果がない")
    expect(pending.note).toContain("金貨26")
    expect(pending.note?.match(/金貨26/g)).toHaveLength(1)
    expect(pending.note).not.toContain("金貨30")
  })

  it("野営役の追加回復を実際の結果文にも反映する", () => {
    const game = createTestGame({
      state: aState()
        .inExpedition({
          at: "l5",
          visited: ["s", "l5"],
          pending: { kind: "discovery" },
        })
        .build(),
    })
    eventsOrThrow(game.send({ type: "discover", choice: "rest" }))
    if (game.state.phase.type !== "expedition") throw new Error("探索ではない")
    const pending = game.state.phase.expedition.pending
    if (pending?.kind !== "treasure") throw new Error("結果がない")
    expect(pending.note).toContain("各人の各ワザの残り回数を3回戻す")
    expect(pending.note).toContain("ワザの回数は変わらなかった。")
    expect(pending.note).not.toContain("各人の各ワザの残り回数を2回戻す")
  })

  it("倒れた交渉役の割引を分岐に表示しない", () => {
    const game = createTestGame({
      state: aState()
        .withExtraMember("alma", { hp: 0 })
        .withParty(["hero", "alda", "alma"])
        .inExpedition({ at: "n9", visited: ["s", "n9"] })
        .build(),
    })
    const details = game.queries
      .route(game.state)!
      .paths.find((path) => path.id === "l10")!
      .details.join(" ")
    expect(details).toContain("金貨30でスキルの書")
    expect(details).toContain("支払い：30G")
    expect(details).not.toContain("金貨26")
  })

  it("休息の道でも報酬の個数を予告し、実際に選ぶとその個数を受け取る", () => {
    const game = createTestGame({
      state: aState()
        .inExpedition({ at: "n4", visited: ["s", "n4"] })
        .build(),
    })
    const details = game.queries
      .route(game.state)!
      .paths.find((path) => path.id === "l5")!
      .details.join(" ")
    expect(details).toContain("ガラクタを2個")
    expect(details).toContain("HPを30％回復")
    expect(details).toContain("各人の各ワザの残り回数を3回戻す")
    const before = Bag.count(game.state.bag, contentId("junk"))
    eventsOrThrow(game.send({ type: "advance", to: "l5" }))
    eventsOrThrow(game.send({ type: "discover", choice: "salvage" }))
    expect(Bag.count(game.state.bag, contentId("junk"))).toBe(before + 2)
  })

  it("倒れた野営役の回復追加を予告せず、到着後も同じ回数を表示する", () => {
    const game = createTestGame({
      state: aState()
        .withMember("mort", { hp: 0 })
        .inExpedition({ at: "n4", visited: ["s", "n4"] })
        .build(),
    })
    const details = game.queries
      .route(game.state)!
      .paths.find((path) => path.id === "l5")!
      .details.join(" ")
    expect(details).toContain("各人の各ワザの残り回数を2回戻す")
    expect(details).not.toContain("各人の各ワザの残り回数を3回戻す")
    eventsOrThrow(game.send({ type: "advance", to: "l5" }))
    const rest = game.queries
      .route(game.state)!
      .discovery!.choices.find((choice) => choice.id === "rest")!
    expect(rest.description).toContain("各人の各ワザの残り回数を2回戻す")
  })
  it("[feature:W035] 封印箱は金貨を技の書にするか、体力を鑑定回数にするかで結果が違う", () => {
    const state = aState()
      .withGold(100)
      .inExpedition({
        at: "l10",
        visited: ["s", "l10"],
        pending: { kind: "discovery" },
      })
      .build()
    const paid = createTestGame({ state })
    const forced = createTestGame({ state })
    const tools = paid.queries
      .route(paid.state)!
      .discovery!.choices.find((choice) => choice.id === "tools")!
    eventsOrThrow(paid.send({ type: "discover", choice: "tools" }))
    eventsOrThrow(forced.send({ type: "discover", choice: "force" }))
    expect(paid.state.gold).toBe(100 - tools.cost!)
    expect(paid.state.members.map((member) => member.hp)).toEqual(
      state.members.map((member) => member.hp)
    )
    expect(Bag.count(paid.state.bag, book)).toBe(Bag.count(state.bag, book) + 1)
    expect(Bag.count(forced.state.bag, book)).toBe(Bag.count(state.bag, book))
    expect(Bag.count(forced.state.bag, contentId("junk"))).toBe(
      Bag.count(state.bag, contentId("junk")) + 4
    )
    expect(forced.state.gold).toBe(100)
  })
  it("素材を使う道は必要数と所持数を予告し、足りない場合と実際の消費が一致する", () => {
    const bone = "444db350-800c-432d-bcaf-6d4a926597c2"
    const state = aState()
      .withReached(1)
      .withItem(bone, 2)
      .inExpedition({
        layer: contentId("layer1"),
        at: "n3",
        visited: ["s", "n3"],
      })
    const game = createTestGame({ state: state.build() })
    const details = game.queries
      .route(game.state)!
      .paths.find((path) => path.id === "l5")!
      .details.join(" ")
    expect(details).toContain("巨人の骨片×2（所持2）")
    expect(details).toContain("HPを45％回復")
    eventsOrThrow(game.send({ type: "advance", to: "l5" }))
    eventsOrThrow(game.send({ type: "discover", choice: "rest" }))
    expect(Bag.count(game.state.bag, bone)).toBe(0)
    const missing = createTestGame({ state: state.withBag([]).build() })
    const unavailable = missing.queries
      .route(missing.state)!
      .paths.find((path) => path.id === "l5")!
      .details.join(" ")
    expect(unavailable).toContain("巨人の骨片×2（所持0）")
    expect(unavailable).toContain("今は交換する品物が足りない")
    eventsOrThrow(missing.send({ type: "advance", to: "l5" }))
    const before = missing.state
    expect(missing.send({ type: "discover", choice: "rest" })).toBeInstanceOf(
      GameCommandError
    )
    expect(missing.state).toBe(before)
  })
  it("選ぶ前に次の分かれ目までの敵・確定報酬・休息を比較でき、見るだけでは状態を変えない", () => {
    const game = createTestGame({
      state: aState()
        .inExpedition({ at: "n4", visited: ["s", "n4"] })
        .build(),
    })
    const before = game.state
    const paths = game.queries.route(game.state)!.paths
    expect(paths[0].details.join(" ")).toContain("ダックリング")
    expect(paths[0].details.join(" ")).toContain("スタンプダック")
    expect(paths[0].details.join(" ")).toContain("ガラクタ×2")
    expect(paths[0].details.join(" ")).toContain("ガラクタ×1")
    expect(paths[1].details.join(" ")).toContain("休息")
    expect(game.state).toBe(before)
    eventsOrThrow(game.send({ type: "advance", to: "u5" }))
    expect(game.send({ type: "advance", to: "l5" })).toBeInstanceOf(
      GameCommandError
    )
  })

  it("全層で装備掘り・書・限定祝福を分け、限定祝福は無料の祭壇には出さない", () => {
    for (const layer of realContent().layers) {
      const station = (id: string) =>
        layer.stations.find((entry) => entry.id === id)!
      expect(station("u12").rewardGoods).toEqual([{ good: book, count: 2 }])
      // 鉄橋の装備掘りと温室の書は単体編成。他の層は2体の編成。
      const foesByLayer = [
        [2, 2],
        [2, 2],
        [1, 2],
        [2, 1],
        [2, 2],
      ]
      expect(station("u5").foes).toHaveLength(foesByLayer[layer.no][0])
      expect(station("u12").foes).toHaveLength(foesByLayer[layer.no][1])
      expect(station("u5").rewardGoods).toEqual([
        { good: contentId("junk"), count: 2 },
      ])
      const offer = station("l12").discovery!.choices.find(
        (choice) => choice.id === "blessing"
      )!
      expect(offer.healthCostRatio).toBe(0.25)
      expect(offer.blessings).toContain(blessing)
      for (const entry of layer.stations.filter((entry) => entry.id !== "l12"))
        expect(
          entry.discovery?.choices.flatMap(
            (choice) => choice.blessings ?? []
          ) ?? []
        ).not.toContain(blessing)
    }
  })

  it("選ぶ前のHP表示と実際の支払いが一致し、倒れた仲間には請求せず、再取得は拒否する", () => {
    const game = createTestGame({
      state: atShrine().withMember("mort", { hp: 0 }).build(),
    })
    const offer = game.queries
      .route(game.state)!
      .discovery!.choices.find((choice) => choice.id === "blessing")!
    expect(offer.available).toBe(true)
    // 倒れたモートを除く2人が払う
    expect(offer.payment).toHaveLength(2)
    eventsOrThrow(
      game.send({
        type: "discover",
        choice: "blessing",
        skill: blessing,
        member: contentId("alda"),
      })
    )
    for (const payment of offer.payment)
      expect(
        game.state.members.find((member) => member.id === payment.id)!.hp
      ).toBe(payment.after)
    expect(
      game.state.members.find((member) => member.id === contentId("mort"))!.hp
    ).toBe(0)
    expect(
      game.state.members.find((member) => member.id === contentId("alda"))!
        .blessing
    ).toBe(blessing)
    const after = game.state
    expect(
      game.send({
        type: "discover",
        choice: "blessing",
        skill: blessing,
        member: contentId("alda"),
      })
    ).toBeInstanceOf(GameCommandError)
    expect(game.state).toBe(after)
    expect(game.restore(game.save())).toBeUndefined()
    eventsOrThrow(game.send({ type: "retreat" }))
    expect(game.state.members.every((member) => !member.blessing)).toBe(true)
  })

  it("支払うと倒れるなら拒否し、休息を選べる。間違った受け手でもHPは減らない", () => {
    const game = createTestGame({
      state: atShrine().withMember("alda", { hp: 1 }).build(),
    })
    const before = game.state
    const offer = game.queries
      .route(game.state)!
      .discovery!.choices.find((choice) => choice.id === "blessing")!
    expect(offer.available).toBe(false)
    expect(offer.reason).toContain("倒れる")
    expect(
      game.send({
        type: "discover",
        choice: "blessing",
        skill: blessing,
        member: contentId("alda"),
      })
    ).toBeInstanceOf(GameCommandError)
    expect(game.state).toBe(before)
    eventsOrThrow(game.send({ type: "discover", choice: "rest" }))
    expect(
      game.state.members.find((member) => member.id === contentId("alda"))!.hp
    ).toBeGreaterThan(1)
    const healthy = createTestGame({ state: atShrine().build() })
    const healthyBefore = healthy.state
    expect(
      healthy.send({
        type: "discover",
        choice: "blessing",
        skill: blessing,
        member: "unknown",
      })
    ).toBeInstanceOf(GameCommandError)
    expect(healthy.state).toBe(healthyBefore)
  })

  it("書を守る敵に勝つと予告どおり2冊入り、帰還しても保持する", () => {
    const content = aContent()
      .mapFoes((foe) => ({ ...foe, hp: 1, atk: 0 }))
      .build()
    const game = createTestGame({
      content,
      state: aState(content)
        .inExpedition({ at: "n11", visited: ["s", "n11"] })
        .build(),
    })
    const before = Bag.count(game.state.bag, book)
    eventsOrThrow(game.send({ type: "advance", to: "u12" }))
    fightToEnd(game)
    expect(Bag.count(game.state.bag, book)).toBe(before + 2)
    eventsOrThrow(game.send({ type: "acknowledge" }))
    eventsOrThrow(game.send({ type: "retreat" }))
    expect(Bag.count(game.state.bag, book)).toBe(before + 2)
  })
})
