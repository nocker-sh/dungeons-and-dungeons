import { describe, expect, it, vi } from "vite-plus/test"
import { playback } from "@/client/components/canvas/playback"
import { BattleDirector } from "./director"
import type { BattleDirectorDeps } from "./director-context"
import type { Acted } from "./types"

vi.mock("@/client/components/canvas/hold", async () => {
  const { playback } = await import("@/client/components/canvas/playback")
  return { hold: () => playback(Promise.resolve(), () => {}) }
})

function setup() {
  const initial = { enemy: 20, other: 30 }
  let shownHp: Record<string, number> = initial
  const signal = new AbortController().signal
  const effect = () => playback(Promise.resolve(), () => {})
  const deps = {
    game: { state: { party: [] } },
    view: { foes: [{ id: "enemy", hp: 20, maxHp: 30 }] },
    signal: () => signal,
    setShownHp: (next: Parameters<BattleDirectorDeps["setShownHp"]>[0]) => {
      shownHp = typeof next === "function" ? next(shownHp) : next
    },
    parts: {
      foe: () => null,
      foeCenter: () => ({ x: 0, y: 0, w: 10, h: 10 }),
    },
    fx: {
      size: () => ({ width: 100, height: 100 }),
      comic: effect,
      numberAt: effect,
      damageAt: effect,
      shake: effect,
      hitStop: effect,
      shards: effect,
    },
  } as unknown as BattleDirectorDeps
  const director = new BattleDirector(deps)
  const knockOut = vi.spyOn(director, "knockOut").mockImplementation(effect)
  const act = (results: Acted["results"]) =>
    director.playResults(
      {
        type: "acted",
        actor: { kind: "member", id: "hero" },
        command: "brawl",
        name: "",
        results,
      },
      false,
      false
    )
  return { director, act, signal, knockOut, initial, hp: () => shownHp }
}

describe("敵の演出用HP", () => {
  it("攻撃の後に続く毒を、更新済みのHPから順番に引く", async () => {
    const test = setup()
    await test.act([{ target: { kind: "foe", id: "enemy" }, damage: 12 }])
    expect(test.hp().enemy).toBe(8)
    await test.director.playAfter(
      [
        {
          type: "ticked",
          target: { kind: "foe", id: "enemy" },
          status: "poison",
          damage: 3,
          down: false,
        },
        {
          type: "ticked",
          target: { kind: "foe", id: "enemy" },
          status: "poison",
          damage: 3,
          down: false,
        },
      ],
      test.signal
    )
    expect(test.hp()).toEqual({ enemy: 2, other: 30 })
    expect(test.initial).toEqual({ enemy: 20, other: 30 })
  })

  it("攻撃後の毒で倒れた敵は、退場する前にHPが0になる", async () => {
    const test = setup()
    await test.act([{ target: { kind: "foe", id: "enemy" }, damage: 12 }])
    test.knockOut.mockImplementation(() => {
      expect(test.hp().enemy).toBe(0)
      return playback(Promise.resolve(), () => {})
    })
    await test.director.playAfter(
      [
        {
          type: "ticked",
          target: { kind: "foe", id: "enemy" },
          status: "poison",
          damage: 8,
          down: true,
        },
      ],
      test.signal
    )
    expect(test.knockOut).toHaveBeenCalledOnce()
    expect(test.hp().enemy).toBe(0)
  })

  it("回復したHPを次の被害に引き継ぐ", async () => {
    const test = setup()
    await test.act([{ target: { kind: "foe", id: "enemy" }, damage: 12 }])
    await test.act([{ target: { kind: "foe", id: "enemy" }, heal: 10 }])
    expect(test.hp().enemy).toBe(18)
    await test.act([{ target: { kind: "foe", id: "enemy" }, damage: 12 }])
    expect(test.hp().enemy).toBe(6)
  })
})
