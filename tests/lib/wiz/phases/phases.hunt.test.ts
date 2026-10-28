import { describe, expect, it } from "vite-plus/test"
import { aState } from "@/lib/wiz/testing/state-builder"
import { contentId } from "@/lib/wiz/testing/content-id"
import { createTestGame } from "@/lib/wiz/testing/create-test-game"
import { createTestPlay } from "@/lib/wiz/testing/create-test-play"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"
import { turnActionFor } from "@/lib/wiz/testing/turn-action-for"
import { eventsOf } from "@/lib/wiz/phases/events-of"
import { GameCommandError } from "@/lib/wiz/game/game-command-error"
import { inPhase } from "@/lib/wiz/phases/in-phase"
import { phaseOf } from "@/lib/wiz/phases/phase-of"
import type { Phase } from "@/lib/wiz/phases/phase"

/** フェーズ（型で縛った有限オートマトン）の不変条件をさがす。 */
describe("フェーズの不変条件", () => {
  const operationsOf = (phase: Phase) =>
    Object.getOwnPropertyNames(Object.getPrototypeOf(phase))
      .filter((name) => name !== "constructor")
      .toSorted()

  /** 宝箱の板が出ている探索。 */
  const pendingGame = () =>
    createTestGame({
      state: aState()
        .inExpedition({
          at: "n2",
          visited: ["s", "n1", "n2"],
          pending: { kind: "treasure", gold: 10, goods: [] },
          loot: { gold: 10, goods: [] },
        })
        .build(),
    })

  it("街のフェーズは街の操作だけを公開する", () => {
    const town = phaseOf(createTestGame())
    expect(town.kind).toBe("town")
    expect(operationsOf(town)).toEqual(
      [
        "acceptQuest",
        "appraise",
        "buy",
        "chat",
        "chooseDemon",
        "contractDemon",
        "invokeDemon",
        "moveWorld",
        "travelWorld",
        "visitWorld",
        "chooseHeroLook",
        "claimQuest",
        "craft",
        "depart",
        "dismissWipe",
        "equip",
        "fightQuest",
        "reforge",
        "recruit",
        "registerHero",
        "renameHero",
        "pack",
        "inscribe",
        "repair",
        "reroll",
        "rest",
        "seeEnding",
        "sellGear",
        "sellGood",
        "startConversation",
        "summon",
        "swap",
        "swapRows",
        "talkTo",
        "unequip",
        "upgrade",
        "use",
        "visit",
      ].toSorted()
    )
  })

  it("探索・板・手番のフェーズはその場面の操作だけを公開する", () => {
    const game = createTestGame()
    eventsOrThrow(game.send({ type: "depart", layer: contentId("layer0") }))
    expect(operationsOf(phaseOf(game))).toEqual([
      "advance",
      "retreat",
      "startConversation",
      "survey",
      "use",
    ])
    expect(operationsOf(phaseOf(pendingGame()))).toEqual([
      "acknowledge",
      "discover",
      "retreat",
      "startConversation",
      "use",
    ])
    const battle = createTestGame({
      state: aState()
        .inBattle({ order: ["alda", "foe-1"] })
        .build(),
    })
    // ケイヤクは手番の操作として公開し、契約でない仲間が送ると act が断る（pact.test）
    expect(operationsOf(phaseOf(battle))).toEqual([
      "brawl",
      "guard",
      "item",
      "pact",
      "skill",
    ])
    const foeFirst = createTestGame({
      state: aState()
        .inBattle({ order: ["foe-1", "alda"] })
        .build(),
    })
    expect(operationsOf(phaseOf(foeFirst))).toEqual(["resolve"])
  })

  it("手番のフェーズは行動順の今の者を actor に持つ", () => {
    const game = createTestGame({
      state: aState()
        .inBattle({ order: ["foe-1", "alda"], turn: 1 })
        .build(),
    })
    const phase = phaseOf(game)
    if (phase.kind !== "member-turn") throw new Error("仲間の手番のはず")
    expect(phase.actor).toBe(contentId("alda"))
    const foeTurn = phaseOf(
      createTestGame({
        state: aState()
          .inBattle({ order: ["foe-1", "alda"], turn: 2 })
          .build(),
      })
    )
    // turn は order の長さで割った余りで回る
    expect(foeTurn.kind).toBe("foe-turn")
    if (foeTurn.kind === "foe-turn") expect(foeTurn.actor).toBe("foe-1")
  })

  it("状態が進んだ後の古いフェーズは、どの操作も STALE で断り状態を変えない", () => {
    const game = createTestGame()
    const stale = phaseOf(game)
    if (stale.kind !== "town") throw new Error("街から始まる")
    eventsOrThrow(game.send({ type: "depart", layer: contentId("layer0") }))
    const after = game.state
    for (const result of [
      stale.rest(contentId("attic")),
      stale.buy(contentId("armory"), contentId("leather")),
      stale.depart(contentId("layer0")),
      stale.use(contentId("potion")),
      stale.swapRows(contentId("alda"), contentId("mort")),
    ])
      expect((result as GameCommandError).code).toBe("STALE")
    expect(game.state).toBe(after)
  })

  it("探索・板・戦闘の古いフェーズも STALE で断る", () => {
    const game = createTestGame()
    eventsOrThrow(game.send({ type: "depart", layer: contentId("layer0") }))
    const expedition = phaseOf(game)
    if (expedition.kind !== "expedition") throw new Error("探索のはず")
    eventsOrThrow(game.send({ type: "advance", to: "n1" }))
    expect((expedition.advance("n1") as GameCommandError).code).toBe("STALE")
    expect((expedition.retreat() as GameCommandError).code).toBe("STALE")

    const battle = phaseOf(game)
    if (battle.kind === "member-turn") {
      eventsOrThrow(game.send(turnActionFor(game, battle.actor)))
      expect((battle.guard() as GameCommandError).code).toBe("STALE")
    } else if (battle.kind === "foe-turn") {
      eventsOrThrow(game.send({ type: "foe-turn" }))
      expect((battle.resolve() as GameCommandError).code).toBe("STALE")
    }

    const pending = pendingGame()
    const board = phaseOf(pending)
    if (board.kind !== "pending") throw new Error("板のはず")
    eventsOrThrow(pending.send({ type: "acknowledge" }))
    expect((board.acknowledge() as GameCommandError).code).toBe("STALE")
    expect((board.retreat() as GameCommandError).code).toBe("STALE")
  })

  it("拒否された操作の後も、同じフェーズのまま操作を続けられる", () => {
    const game = createTestGame()
    const town = phaseOf(game)
    if (town.kind !== "town") throw new Error("街から始まる")
    const before = game.state
    expect((town.depart(contentId("layer3")) as GameCommandError).code).toBe(
      "LOCKED"
    )
    expect(game.state).toBe(before)
    expect(town.current).toBe(true)
    const departed = town.depart(contentId("layer0"))
    if (departed instanceof GameCommandError) throw departed
    expect(departed.next.kind).toBe("expedition")
  })

  it("板は閉じると探索へ、撤退すると街へ移る", () => {
    const closed = pendingGame()
    const board = phaseOf(closed)
    if (board.kind !== "pending") throw new Error("板のはず")
    const next = board.acknowledge()
    if (next instanceof GameCommandError) throw next
    expect(next.next.kind).toBe("expedition")

    const left = pendingGame()
    const leaving = phaseOf(left)
    if (leaving.kind !== "pending") throw new Error("板のはず")
    const town = leaving.retreat()
    if (town instanceof GameCommandError) throw town
    expect(town.next.kind).toBe("town")
    expect(left.state.phase.type).toBe("town")
  })

  it("進んだ結果のフェーズは、進んだ後の状態を持つ", () => {
    const { game } = createTestPlay()
    const town = phaseOf(game)
    if (town.kind !== "town") throw new Error("街から始まる")
    const departed = town.depart(contentId("layer0"))
    if (departed instanceof GameCommandError) throw departed
    expect(departed.next.state).toBe(game.state)
    expect(departed.next.current).toBe(true)
    expect(town.current).toBe(false)
  })

  it("inPhase は今の場面だけを返し、eventsOf は出来事か拒否理由にそろえる", () => {
    const game = createTestGame()
    expect(inPhase(game, "town")).not.toBeNull()
    expect(inPhase(game, "expedition")).toBeNull()
    expect(inPhase(game, "member-turn")).toBeNull()
    expect(eventsOf(null)).toBeInstanceOf(GameCommandError)
    expect((eventsOf(undefined) as GameCommandError).code).toBe("WRONG_PHASE")
    const error = new GameCommandError("NO_GOLD")
    expect(eventsOf(error)).toBe(error)
    const town = inPhase(game, "town")!
    const events = eventsOf(town.rest(contentId("attic")))
    expect(Array.isArray(events)).toBe(true)
  })

  it("探索から板・戦闘・探索のどれへ移っても、型に書いた行き先の中に収まる", () => {
    const allowed = ["expedition", "pending", "member-turn", "foe-turn"]
    for (const seed of [1, 2, 3, 4, 5]) {
      const game = createTestGame({ random: () => seed / 10 })
      eventsOrThrow(game.send({ type: "depart", layer: contentId("layer0") }))
      const phase = phaseOf(game)
      if (phase.kind !== "expedition") throw new Error("探索のはず")
      const step = phase.advance("n1")
      if (step instanceof GameCommandError) throw step
      expect(allowed).toContain(step.next.kind)
    }
  })
})
