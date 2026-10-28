import { describe, expect, it } from "vite-plus/test"
import {
  deviationOf,
  UNREACHABLE_DEVIATION,
} from "@/builder/lib/tuning/deviation-of"
import { withinTarget } from "@/builder/lib/tuning/within-target"
import { parseTuningSpec } from "@/builder/lib/tuning/spec"
import { snapKnob } from "@/builder/lib/tuning/snap-knob"
import { tune } from "@/builder/lib/tune"
import type {
  Knob,
  TuneMeasure,
  TuneTarget,
  TuningSpec,
} from "@/builder/lib/tuning/types"

/**
 * 作り物の指標で探索そのものを試す（ゲームは動かさないので速い）。
 * 上書きの文字列から値を読み直すので、tune が作る式の形も一緒に確かめている。
 */
function read(overrides: readonly string[], path: string, base: number) {
  let value = base
  for (const expression of overrides) {
    if (expression.startsWith(`${path}=`))
      value = Number(expression.slice(path.length + 1))
    else if (expression.startsWith(`${path}*=`))
      value *= Number(expression.slice(path.length + 2))
  }
  return value
}

type Recorder = {
  measure: TuneMeasure
  calls: { overrides: readonly string[]; seed: number }[]
}

function recorder(
  values: (
    read: (path: string, base: number) => number,
    seed: number
  ) => Record<string, number>
): Recorder {
  const calls: Recorder["calls"] = []
  return {
    calls,
    measure: ({ overrides, seed }) => {
      calls.push({ overrides: [...overrides], seed })
      return values((path, base) => read(overrides, path, base), seed)
    },
  }
}

const target = (partial: Partial<TuneTarget> & { id: string }): TuneTarget => ({
  label: partial.id,
  unit: "count",
  ...partial,
})

const spec = (
  knobs: readonly Knob[],
  targets: readonly string[]
): TuningSpec => ({
  id: "test",
  targets,
  knobs,
})

describe("バランスの自動調整（builder/lib/tune.ts）", () => {
  it("単調なつまみなら範囲へ入る", () => {
    const targets = [target({ id: "win", min: 90, max: 110 })]
    const { measure, calls } = recorder((get) => ({
      win: get("foes.kamokutsu.hp", 200),
    }))
    const result = tune({
      spec: spec(
        [{ path: "foes.kamokutsu.hp", min: 50, max: 300, step: 5 }],
        ["win"]
      ),
      targets,
      baseValue: () => 200,
      measure,
      budget: 60,
    })
    expect(result.passed).toBe(true)
    expect(result.stop).toBe("passed")
    expect(result.changes).toHaveLength(1)
    expect(result.metrics[0].before).toBe(200)
    expect(result.metrics[0].after).toBeGreaterThanOrEqual(90)
    expect(result.metrics[0].after).toBeLessThanOrEqual(110)
    expect(result.overrides[0]).toMatch(/^foes\.kamokutsu\.hp=\d+$/)
    expect(calls.length).toBeGreaterThan(0)
  })

  it("倍率のつまみでも範囲へ入る", () => {
    const targets = [target({ id: "price", min: 40, max: 60 })]
    const { measure } = recorder((get) => ({
      price: get("goods.sword.price", 100),
    }))
    const result = tune({
      spec: spec(
        [
          {
            path: ["goods.sword.price", "goods.axe.price"],
            mode: "scale",
            min: 0.4,
            max: 2,
            step: 0.05,
          },
        ],
        ["price"]
      ),
      targets,
      baseValue: () => 1,
      measure,
      budget: 60,
    })
    expect(result.passed).toBe(true)
    expect(result.overrides).toHaveLength(2)
    expect(result.overrides[0]).toMatch(/^goods\.sword\.price\*=0\./)
  })

  it("min / max / step を守る", () => {
    const targets = [target({ id: "win", min: 1000 })]
    const seen: number[] = []
    const result = tune({
      spec: spec([{ path: "a", min: 0, max: 10, step: 2 }], ["win"]),
      targets,
      baseValue: () => 4,
      budget: 40,
      measure: ({ overrides }) => {
        const value = read(overrides, "a", 4)
        seen.push(value)
        return { win: value }
      },
    })
    expect(result.passed).toBe(false)
    expect(result.stop).toBe("no-progress")
    expect(Math.max(...seen)).toBe(10)
    for (const value of seen) {
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(10)
      expect(value % 2).toBe(0)
    }
  })

  it("整数のつまみは整数のまま動かす", () => {
    const targets = [target({ id: "win", min: 7, max: 9 })]
    const seen: number[] = []
    tune({
      spec: spec([{ path: "balance.expBase", min: 1, max: 40 }], ["win"]),
      targets,
      baseValue: () => 20,
      budget: 40,
      measure: ({ overrides }) => {
        const value = read(overrides, "balance.expBase", 20)
        seen.push(value)
        return { win: value }
      },
    })
    for (const value of seen) expect(Number.isInteger(value)).toBe(true)
  })

  it("一つで足りるなら一つしか動かさない", () => {
    const targets = [target({ id: "win", min: 90, max: 110 })]
    const { measure } = recorder((get) => ({
      win: get("a", 200) + get("b", 0) + get("c", 0),
    }))
    const result = tune({
      spec: spec(
        [
          { path: "a", min: 0, max: 300, step: 5 },
          { path: "b", min: -200, max: 200, step: 5 },
          { path: "c", min: -200, max: 200, step: 5 },
        ],
        ["win"]
      ),
      targets,
      baseValue: (knob) => (knob.path === "a" ? 200 : 0),
      measure,
      budget: 80,
    })
    expect(result.passed).toBe(true)
    expect(result.changes).toHaveLength(1)
  })

  it("動かしたくないつまみ（keep）は後回しになる", () => {
    const targets = [target({ id: "win", min: 90, max: 110 })]
    const { measure } = recorder((get) => ({
      win: get("cheap", 200) + get("keep", 0),
    }))
    const result = tune({
      spec: spec(
        [
          { path: "keep", min: -200, max: 200, step: 5, keep: 50 },
          { path: "cheap", min: 0, max: 300, step: 5 },
        ],
        ["win"]
      ),
      targets,
      baseValue: (knob) => (knob.path === "cheap" ? 200 : 0),
      measure,
      budget: 80,
    })
    expect(result.passed).toBe(true)
    expect(result.changes.map((change) => change.label)).toEqual(["cheap"])
  })

  it("効かないつまみは一度で見切って、もう測らない", () => {
    const targets = [target({ id: "win", min: 90, max: 110 })]
    const { measure, calls } = recorder((get) => ({ win: get("live", 300) }))
    const result = tune({
      spec: spec(
        [
          { path: "dead-a", min: 0, max: 100, step: 5 },
          { path: "dead-b", min: 0, max: 100, step: 5 },
          { path: "live", min: 0, max: 400, step: 5 },
        ],
        ["win"]
      ),
      targets,
      baseValue: (knob) => (knob.path === "live" ? 300 : 50),
      measure,
      seeds: [1],
      budget: 80,
    })
    expect(result.passed).toBe(true)
    const touched = (path: string) =>
      calls.filter((call) =>
        call.overrides.some((expression) => expression.startsWith(`${path}=`))
      ).length
    // 1刻みと大きく動かした分の2回だけで、効かないと決める。
    expect(touched("dead-a")).toBe(2)
    expect(touched("dead-b")).toBe(2)
    expect(result.changes.map((change) => change.label)).toEqual(["live"])
  })

  it("同じ上書きと種は測り直さない", () => {
    const targets = [target({ id: "win", min: 90, max: 110 })]
    const { measure, calls } = recorder((get) => ({ win: get("a", 200) }))
    const result = tune({
      spec: spec([{ path: "a", min: 50, max: 300, step: 5 }], ["win"]),
      targets,
      baseValue: () => 200,
      measure,
      seeds: [1, 7],
      budget: 60,
    })
    expect(calls).toHaveLength(result.measurements)
    expect(result.cacheHits).toBeGreaterThan(0)
    const keys = calls.map((call) =>
      JSON.stringify([call.overrides, call.seed])
    )
    expect(new Set(keys).size).toBe(keys.length)
  })

  it("上限に達したら止まる", () => {
    const targets = [target({ id: "win", min: 90, max: 110 })]
    const { measure, calls } = recorder((get) => ({ win: get("a", 900) }))
    const result = tune({
      spec: spec([{ path: "a", min: 50, max: 2000, step: 1 }], ["win"]),
      targets,
      baseValue: () => 900,
      measure,
      seeds: [1],
      budget: 4,
    })
    expect(result.stop).toBe("budget")
    expect(result.passed).toBe(false)
    expect(calls.length).toBeLessThanOrEqual(4)
    expect(result.measurements).toBe(calls.length)
  })

  it("全ての種で範囲に入るまで続ける", () => {
    const targets = [target({ id: "win", min: 100 })]
    // 種7だけ 30 低い。種1しか見ないと 100 で止まってしまう。
    const { measure } = recorder((get, seed) => ({
      win: get("a", 60) - (seed === 7 ? 30 : 0),
    }))
    const result = tune({
      spec: spec([{ path: "a", min: 0, max: 400, step: 5 }], ["win"]),
      targets,
      baseValue: () => 60,
      measure,
      seeds: [1, 7],
      budget: 80,
    })
    expect(result.passed).toBe(true)
    expect(result.changes[0].to).toBeGreaterThanOrEqual(130)
  })

  it("すでに範囲の中なら何も動かさない", () => {
    const targets = [target({ id: "win", min: 90, max: 110 })]
    const { measure, calls } = recorder((get) => ({ win: get("a", 100) }))
    const result = tune({
      spec: spec([{ path: "a", min: 50, max: 300, step: 5 }], ["win"]),
      targets,
      baseValue: () => 100,
      measure,
      seeds: [1, 7, 23],
      budget: 60,
    })
    expect(result.stop).toBe("already")
    expect(result.passed).toBe(true)
    expect(result.changes).toHaveLength(0)
    expect(calls).toHaveLength(3)
  })

  it("範囲の外から始めても、つまみの範囲へ入れてから探す", () => {
    const targets = [target({ id: "win", min: 90, max: 110 })]
    const { measure } = recorder((get) => ({ win: get("a", 400) }))
    const result = tune({
      spec: spec([{ path: "a", min: 80, max: 300, step: 5 }], ["win"]),
      targets,
      baseValue: () => 400,
      measure,
      seeds: [1],
      budget: 60,
    })
    expect(result.passed).toBe(true)
    expect(result.changes[0].to).toBeLessThanOrEqual(110)
    expect(result.changes[0].to).toBeGreaterThanOrEqual(90)
  })

  it("引っぱり合う目標でも、両方が入る組み合わせを見つける", () => {
    const targets = [
      target({ id: "easy", min: 0.9, unit: "rate" }),
      target({ id: "hard", max: 0.15, unit: "rate" }),
    ]
    // 雑魚を弱くすると easy が上がり、ボスを強くすると hard が下がる。
    const { measure } = recorder((get) => {
      const mob = get("foes.kamokutsu.atk", 120)
      const boss = get("foes.haribote-adult.hp", 800)
      return { easy: 1 - mob / 400, hard: 1 - boss / 2000 }
    })
    const result = tune({
      spec: spec(
        [
          { path: "foes.kamokutsu.atk", min: 20, max: 200, step: 2 },
          { path: "foes.haribote-adult.hp", min: 400, max: 2400, step: 25 },
        ],
        ["easy", "hard"]
      ),
      targets,
      baseValue: (knob) => (knob.path === "foes.kamokutsu.atk" ? 120 : 800),
      measure,
      seeds: [1],
      budget: 120,
    })
    expect(result.passed).toBe(true)
    expect(result.changes).toHaveLength(2)
    expect(result.deviationAfter).toBe(0)
  })
})

describe("判定と丸め", () => {
  it("範囲の外だけ逸脱になる", () => {
    const rate = target({ id: "r", min: 0.9, unit: "rate" })
    expect(withinTarget(rate, 0.95)).toBe(true)
    expect(deviationOf(rate, 0.9)).toBe(0)
    expect(deviationOf(rate, 0.8)).toBeCloseTo(1, 5)
    expect(deviationOf(rate, Number.POSITIVE_INFINITY)).toBe(
      UNREACHABLE_DEVIATION
    )
    expect(withinTarget(rate, Number.NaN)).toBe(false)
  })

  it("刻みは今の値を起点にして、min / max で止まる", () => {
    const knob: Knob = { path: "a", min: 0, max: 10, step: 3 }
    expect(snapKnob(knob, 4, 5)).toBe(4)
    expect(snapKnob(knob, 4, 6)).toBe(7)
    expect(snapKnob(knob, 4, 99)).toBe(10)
    expect(snapKnob(knob, 4, -99)).toBe(0)
  })

  it("指定の書き方が違えば読む前に投げる", () => {
    expect(() => parseTuningSpec({ id: "x", targets: [], knobs: [] })).toThrow()
    expect(() =>
      parseTuningSpec({
        id: "x",
        targets: ["a"],
        knobs: [{ path: "a", min: 5, max: 1 }],
      })
    ).toThrow()
    expect(
      parseTuningSpec({
        id: "x",
        targets: ["a"],
        knobs: [{ path: "a", min: 1, max: 5 }],
      }).knobs
    ).toHaveLength(1)
  })
})
