import { expect, test, vi } from "vite-plus/test"
import { connectSave } from "@/client/game/connect-save"
import { MemoryStorage } from "@/client/game/memory-storage"
import { GameDefinition } from "@/lib/wiz/definition/game-definition"
import { Bag } from "@/lib/wiz/rules/bag"
import { aState } from "@/lib/wiz/testing/state-builder"
import { contentId } from "@/lib/wiz/testing/content-id"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"
import { realContent } from "@/lib/wiz/testing/real-content"
import { testEnvironment } from "@/lib/wiz/testing/test-environment"

const definition = new GameDefinition(realContent())

test.each(definition.catalog.data.goods.filter((good) => good.kind === "item"))(
  "$id: native packing, departure, field use and return survive failed saves without using stored reserves",
  async (good) => {
    if (!good.effect) throw new Error(`${good.id}: missing item effect`)
    const allowed = ["heal", "revive", "cure", "refill"].includes(
      good.effect.type
    )
    // Town, possessions and injury/spent uses are local starting conditions.
    const initial = aState(definition.catalog)
      .withBag([{ good: good.id, count: 5 }])
      .withMember("alda", {
        hp: good.effect.type === "revive" ? 0 : 1,
        used:
          good.effect.type === "refill"
            ? [{ skill: contentId("helmsplit"), count: 3 }]
            : [],
        status:
          good.effect.type === "cure"
            ? good.effect.kinds.map((kind) => ({ kind, turns: 3 }))
            : [],
      })
      .build()
    // A fallen companion is revived at home using the real item before departure.
    const game = definition.create(testEnvironment(), initial)
    const bytes = new MemoryStorage()
    let denied = false
    const report = vi.fn<(saved: boolean) => void>()
    const session = connectSave(
      game,
      {
        read: () => bytes.read(),
        clear: () => bytes.clear(),
        write: (value) => {
          if (denied) throw new Error("Storage unavailable")
          bytes.write(value)
        },
      },
      report
    )
    const layer = definition.catalog.data.layers[0].id
    const action = {
      type: "use" as const,
      good: good.id,
      member: contentId("alda"),
    }
    try {
      if (good.effect.type === "revive") {
        const before = game.save()
        expect(game.send({ type: "depart", layer })).toMatchObject({
          code: "DOWN",
        })
        expect(game.save()).toEqual(before)
        eventsOrThrow(game.send(action))
      }
      const stock = Bag.count(game.state.bag, good.id)
      eventsOrThrow(game.send({ type: "pack", good: good.id, count: 1 }))
      const packed = game.state
      eventsOrThrow(game.send({ type: "depart", layer }))
      expect(game.state.phase.type).toBe("expedition")
      expect(game.state.party).toEqual(initial.party)
      expect(Bag.count(game.state.bag, good.id)).toBe(stock)
      expect(game.queries.supplies(game.state).count).toBe(1)
      expect(
        game.queries.items(game.state).find((item) => item.id === good.id)
      ).toMatchObject({ count: 1, field: allowed })
      const departed = game.save()
      const checkpoint = bytes.read()
      expect(JSON.parse(checkpoint!)).toEqual(departed)
      expect(game.send({ type: "depart", layer })).toMatchObject({
        code: "WRONG_PHASE",
      })
      expect(
        game.send({ type: "pack", good: good.id, count: 2 })
      ).toMatchObject({ code: "WRONG_PHASE" })
      expect(game.save()).toEqual(departed)
      if (good.effect.type === "revive") {
        // The living target is deliberately unavailable after the real town revival.
        expect(game.send(action)).toMatchObject({ code: "NO_EFFECT" })
      } else if (!allowed) {
        expect(game.send(action)).toMatchObject({ code: "UNAVAILABLE" })
      } else {
        denied = true
        eventsOrThrow(game.send(action))
        expect(report).toHaveBeenLastCalledWith(false)
        expect(bytes.read()).toBe(checkpoint)
        expect(Bag.count(game.state.bag, good.id)).toBe(stock - 1)
        expect(game.queries.supplies(game.state).count).toBe(0)
        const used = game.save()
        const replay = definition.create(testEnvironment())
        expect(replay.restore(JSON.parse(checkpoint!))).toBeUndefined()
        eventsOrThrow(replay.send(action))
        expect(replay.state).toEqual(game.state)
        expect(game.send(action)).toMatchObject({ code: "NO_ITEM" })
        expect(game.save()).toEqual(used)
        expect(bytes.read()).toBe(checkpoint)
        denied = false
        await session.retrySave!()
        expect(report).toHaveBeenLastCalledWith(true)
        expect(JSON.parse(bytes.read()!)).toEqual(used)
      }
      if (!allowed || good.effect.type === "revive") {
        expect(game.save()).toEqual(departed)
        expect(bytes.read()).toBe(checkpoint)
      }
      const beforeReturn = game.state
      const savedBeforeReturn = bytes.read()
      denied = true
      const returned = eventsOrThrow(game.send({ type: "retreat" }))
      expect(returned).toContainEqual({
        type: "returned",
        gold: 0,
        goods: [],
        bonus: 0,
      })
      expect(report).toHaveBeenLastCalledWith(false)
      expect(bytes.read()).toBe(savedBeforeReturn)
      expect(game.state.phase.type).toBe("town")
      expect(game.state.party).toEqual(initial.party)
      expect(game.state.bag).toEqual(beforeReturn.bag)
      expect(game.state.gold).toBe(beforeReturn.gold)
      const townState = game.state
      const town = game.save()
      const returnReplay = definition.create(testEnvironment())
      expect(
        returnReplay.restore(JSON.parse(savedBeforeReturn!))
      ).toBeUndefined()
      expect(eventsOrThrow(returnReplay.send({ type: "retreat" }))).toEqual(
        returned
      )
      expect(returnReplay.state).toEqual(townState)
      expect(game.send({ type: "retreat" })).toMatchObject({
        code: "WRONG_PHASE",
      })
      expect(game.save()).toEqual(town)
      denied = false
      await session.retrySave!()
      expect(JSON.parse(bytes.read()!)).toEqual(town)
      const resumed = definition.create(testEnvironment())
      const restored = connectSave(resumed, bytes)
      try {
        expect(restored.status).toBe("restored")
        expect(resumed.state).toEqual(game.state)
      } finally {
        restored.disconnect()
      }
      eventsOrThrow(game.send({ type: "pack", good: good.id, count: 1 }))
      eventsOrThrow(game.send({ type: "depart", layer }))
      expect(game.queries.supplies(game.state).count).toBe(1)
      expect(game.state.bag).toEqual(townState.bag)
      expect(game.state.party).toEqual(packed.party)
      expect(JSON.parse(bytes.read()!)).toEqual(game.save())
    } finally {
      session.disconnect()
    }
  }
)
