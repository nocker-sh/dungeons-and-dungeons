import { describe, expect, test, vi } from "vite-plus/test"
import { initialOverlay } from "@/client/components/game/initial-overlay"
import { overlayView } from "@/client/components/game/overlay"
import { reduceOverlay } from "@/client/components/game/reduce-overlay"
import type { OverlayAction } from "@/client/components/game/reduce-overlay"
import type { OverlayState } from "@/client/components/game/overlay"
import type { TargetRequest } from "@/client/components/game/formation/context"

function run(state: OverlayState, ...actions: OverlayAction[]) {
  let current = state
  const effects = []
  for (const action of actions) {
    const result = reduceOverlay(current, action)
    current = result.state
    if (result.effect) effects.push(result.effect)
  }
  return { state: current, effects }
}

function request(eligible: string[] = ["alda", "mayu"]): TargetRequest {
  return {
    eligible,
    label: "回復薬を誰に使う？",
    onPick: vi.fn(),
    onCancel: vi.fn(),
  }
}

const press = (member: string, delegated = false): OverlayAction => ({
  type: "pressCard",
  member,
  delegated,
})

describe("画面に重なるものの有限オートマトン", () => {
  test("何も開いていなければ、札を押すと立ち絵が上がり、もう一度で下がる", () => {
    const opened = run(initialOverlay(), press("alda"))
    expect(opened.state.lifted).toBe("alda")
    expect(run(opened.state, press("alda")).state.lifted).toBeNull()
  })

  test("バッグを開いている間は札を押しても詳細へ移らない", () => {
    const { state, effects } = run(
      initialOverlay(),
      { type: "toggleBag" },
      press("alda"),
      press("alda", true),
      { type: "lift", member: "alda" }
    )
    expect(state.mode).toEqual({ kind: "bag", closing: false })
    expect(state.lifted).toBeNull()
    expect(effects).toEqual([])
  })

  test("バッグを開くと上がっていた立ち絵は下がり、札は引っ込む", () => {
    const { state } = run(initialOverlay({ lifted: "alda" }), {
      type: "toggleBag",
    })
    expect(state.lifted).toBeNull()
    expect(overlayView.cardsHidden(state)).toBe(true)
    expect(overlayView.bagOpen(state)).toBe(true)
  })

  test("バッグのボタンをもう一度押すと閉じる合図を一度だけ送り、閉じ終わるまで他を受けない", () => {
    const { state } = run(
      initialOverlay(),
      { type: "toggleBag" },
      { type: "toggleBag" },
      { type: "toggleBag" },
      { type: "choose", request: request() }
    )
    expect(state.mode).toEqual({ kind: "bag", closing: true })
    expect(state.closeRequests).toBe(1)
    expect(overlayView.cardsHidden(state)).toBe(false)
    expect(run(state, { type: "bagClosed" }).state.mode).toEqual({
      kind: "free",
    })
  })

  test("バッグから仲間を選ぶと札が戻り、選べる仲間だけが決まってバッグへ戻る", () => {
    const asking = request(["mayu"])
    const choosing = run(
      initialOverlay(),
      { type: "toggleBag" },
      { type: "choose", request: asking }
    ).state
    expect(overlayView.cardsHidden(choosing)).toBe(false)
    expect(overlayView.bagMounted(choosing)).toBe(true)
    expect(run(choosing, press("alda")).state).toBe(choosing)
    const picked = run(choosing, press("mayu"))
    expect(picked.effects).toEqual([
      { type: "pick", request: asking, member: "mayu" },
    ])
    expect(picked.state.mode).toEqual({ kind: "bag", closing: false })
  })

  test("取りやめると元の状態へ戻り、依頼の取りやめを呼ぶ", () => {
    const asking = request()
    const { state, effects } = run(
      initialOverlay(),
      { type: "choose", request: asking },
      { type: "cancelChoosing" }
    )
    expect(state.mode).toEqual({ kind: "free" })
    expect(effects).toEqual([{ type: "cancel", request: asking }])
  })

  test("戦闘のように場面が押したときの処理を差し替えていれば、それを呼ぶ", () => {
    const { state, effects } = run(initialOverlay(), press("sion", true))
    expect(state.lifted).toBeNull()
    expect(effects).toEqual([{ type: "delegate", member: "sion" }])
  })

  test("受け付けない操作は同じ状態を返す", () => {
    const free = initialOverlay()
    expect(reduceOverlay(free, { type: "bagClosed" }).state).toBe(free)
    expect(reduceOverlay(free, { type: "cancelChoosing" }).state).toBe(free)
  })
})
