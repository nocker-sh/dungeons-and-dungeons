import { describe, expect, it } from "vite-plus/test"
import {
  interactive,
  screenOf,
  transition,
  type TransitionEvent,
  type TransitionState,
} from "./screen-transition"

const town = { name: "town" } as const
const inn = { name: "place", place: "inn" } as const

describe("画面の切り替え（有限オートマトン）", () => {
  it("表示中 → 退場中 → 到着中 → 表示中の順にだけ進む", () => {
    let state: TransitionState<string> = { kind: "showing", screen: town }
    state = transition(state, { type: "go", to: inn, enter: "dolly" })!
    expect(state).toEqual({
      kind: "leaving",
      from: town,
      to: inn,
      enter: "dolly",
    })
    expect(screenOf(state)).toBe(town)
    state = transition(state, { type: "left" })!
    expect(state).toEqual({ kind: "arriving", screen: inn, enter: "dolly" })
    expect(screenOf(state)).toBe(inn)
    state = transition(state, { type: "arrived" })!
    expect(state).toEqual({ kind: "showing", screen: inn })
  })

  it("決めた遷移以外は受け付けず、切り替えの途中で二重に切り替えない", () => {
    const states: TransitionState[] = [
      { kind: "showing", screen: town },
      { kind: "leaving", from: town, to: inn },
      { kind: "arriving", screen: inn },
    ]
    const events: TransitionEvent[] = [
      { type: "go", to: inn },
      { type: "left" },
      { type: "arrived" },
    ]
    const allowed = new Set(["showing/go", "leaving/left", "arriving/arrived"])
    for (const state of states)
      for (const event of events) {
        const next = transition(state, event)
        expect(next !== null, `${state.kind}/${event.type}`).toBe(
          allowed.has(`${state.kind}/${event.type}`)
        )
      }
  })

  it("操作を受け付けるのは表示中だけ", () => {
    expect(interactive({ kind: "showing", screen: town })).toBe(true)
    expect(interactive({ kind: "leaving", from: town, to: inn })).toBe(false)
    expect(interactive({ kind: "arriving", screen: inn })).toBe(false)
  })
})
