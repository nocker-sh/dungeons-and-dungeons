import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, expect, test, vi } from "vite-plus/test"
import { Layer } from "@/client/components/screens/expedition/layer"
import { GameProvider } from "@/client/contexts/game-provider"
import { NavContext } from "@/client/components/game/use-nav"
import { StageContext } from "@/client/components/stage/use-stage"
import type { StageApi } from "@/client/components/stage/use-stage"
import { AnimationBarrier } from "@/client/components/canvas/animation"
import { Camera } from "@/client/components/stage/camera"
import { FxStore } from "@/client/components/stage/fx/store"
import { StageDirector } from "@/client/components/stage/director"
import { GameDefinition } from "@/lib/wiz/definition/game-definition"
import type { Game } from "@/lib/wiz/game/game"
import { aState } from "@/lib/wiz/testing/state-builder"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"
import { realContent } from "@/lib/wiz/testing/real-content"
import { testEnvironment } from "@/lib/wiz/testing/test-environment"
import { connectSave } from "@/client/game/connect-save"
import { MemoryStorage } from "@/client/game/memory-storage"
import { playEventConversation } from "@/client/components/game/play-event-conversation"
import { fullRun } from "@/tests/full-run"

const drawn = vi.hoisted(() => ({ confirm: null as null | (() => void) }))
vi.mock("@/client/components/game/loot-panel", async (original) => {
  const actual =
    await original<typeof import("@/client/components/game/loot-panel")>()
  return {
    ...actual,
    LootPanel: (props: Parameters<typeof actual.LootPanel>[0]) => {
      drawn.confirm = props.onOk
      return createElement(actual.LootPanel, props)
    },
  }
})
afterEach(() => {
  drawn.confirm = null
  vi.unstubAllGlobals()
})
const definition = new GameDefinition(realContent())
// 組み立て器は元の状態を書き換えず、呼ぶたびに新しい組み立て器を返す。遊べる街の状態は一度だけ作って使い回す。
const town = aState(definition.catalog)
const foes = definition.catalog.data.foes
/**
 * 敵の戦利品の形。品の種類数（札の枚数とページ送り、拾い物の会話が始まるか）・
 * 光るガラクタ（当たりの札）・契約石の札・品の種別（素材・道具など）で分ける。
 */
function lootShape(foe: (typeof foes)[number]) {
  const rareJunk = definition.catalog.data.rareJunk
  const goods = new Set(foe.drops.map((drop) => drop.good))
  const kinds = [...goods].map((good) => definition.catalog.good(good)?.kind)
  return JSON.stringify([
    goods.size,
    rareJunk !== undefined && goods.has(rareJunk),
    (foe.stones ?? 0) > 0,
    [...new Set(kinds)].toSorted((a, b) => String(a).localeCompare(String(b))),
  ])
}
const shapes = foes.map(lootShape)
// 既定の `vp test run` は、戦利品の形ごとにデータで最初の敵と、データの末尾の敵だけを回す。
// 退いた確認を止める処理は敵を見ず、結果の種類・同一性・拾い物の会話が始まるかだけで分かれる。
// 全ての敵の戦利品を本物の画面へ通す総当たりは `vp run test:full` で回す。
const representatives = foes.filter(
  (_, index) =>
    index === foes.length - 1 || shapes.indexOf(shapes[index]) === index
)
const selected: typeof foes = fullRun ? foes : representatives
const stage: StageApi = {
  exits: new AnimationBarrier(),
  updates: new AnimationBarrier(),
  camera: new Camera(),
  fxStore: new FxStore(),
  director: new StageDirector(),
  canvas: { current: null },
  set: { current: null },
  artboard: null,
  chrome: null,
  solo: null,
  art: async () => {},
  bars: () => {},
}
function confirmation(game: Game) {
  vi.stubGlobal("innerWidth", 360)
  vi.stubGlobal("innerHeight", 720)
  drawn.confirm = null
  renderToStaticMarkup(
    createElement(GameProvider, {
      game,
      children: createElement(StageContext, {
        value: stage,
        children: createElement(NavContext, {
          value: {
            screen: { name: "expedition" },
            enter: undefined,
            leaving: false,
            phase: { kind: "showing", screen: { name: "expedition" } },
            go: async () => {},
            arrived: () => {},
          },
          children: createElement(Layer, { intro: false, onBattle: () => {} }),
        }),
      }),
    })
  )
  if (!drawn.confirm)
    throw new Error("The native layer did not render a result panel")
  return drawn.confirm as () => void
}
function finish(game: Game) {
  const script = game.queries.activeConversation(game.state)
  if (script)
    eventsOrThrow(
      game.send({
        type: "finish-conversation",
        ...(script.choice ? { choice: 0 } : {}),
      })
    )
}
async function settle() {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}
async function verify(game: Game, waiting: boolean) {
  const storage = new MemoryStorage()
  const session = connectSave(game, storage)
  try {
    // Normalize through the real save decoder, as a resumed screen would do.
    expect(
      game.restore(JSON.parse(JSON.stringify(game.save())))
    ).toBeUndefined()
    const click = confirmation(game)
    const saved = JSON.parse(JSON.stringify(game.save())) as unknown
    if (waiting) click()
    expect(game.restore(saved)).toBeUndefined()
    // 退いた確認は遷移を起こさない。状態が同じ物のままなら保存も同じなので、同一性と保存先の中身で確かめる。
    const restored = game.state
    const bytes = storage.read()
    if (!waiting) click()
    await settle()
    expect(game.state).toBe(restored)
    expect(storage.read()).toBe(bytes)
    expect(game.queries.problems(game.state)).toEqual([])

    const control = definition.create(testEnvironment({ random: 0 }))
    expect(control.restore(saved)).toBeUndefined()
    const pending = control.queries.route(control.state)!.pending!
    if (pending.kind === "loot") {
      const talking = playEventConversation(control, "item")
      finish(control)
      await talking
    }
    eventsOrThrow(control.send({ type: "acknowledge" }))
    confirmation(game)()
    finish(game)
    await settle()
    expect(game.save()).toEqual(control.save())
    expect(JSON.parse(storage.read()!)).toEqual(control.save())
    const completed = storage.read()
    const finished = game.state
    click()
    await settle()
    expect(game.state).toBe(finished)
    expect(storage.read()).toBe(completed)
  } finally {
    session.disconnect()
  }
}

for (const waiting of [false, true])
  test.each(selected)(
    `$id: a retired loot confirmation cannot close a restored result, waiting=${waiting}`,
    async (opponent) => {
      const initial = town
        .inBattle({
          foes: [opponent.id],
          order: ["alda", "foe-1", "mort", "mayu"],
        })
        .build()
      if (initial.phase.type !== "battle") throw new Error("Expected battle")
      const game = definition.create(testEnvironment({ random: 0 }), {
        ...initial,
        phase: {
          ...initial.phase,
          battle: {
            ...initial.phase.battle,
            foes: initial.phase.battle.foes.map((entry) => ({
              ...entry,
              hp: 1,
            })),
          },
        },
      })
      const commands = game.queries.commands(game.state, game.state.party[0])!
      const skill = [...commands.weaponSkills, ...commands.skills].find(
        (entry) => entry.kind === "hit" && entry.usable
      )
      if (!skill) throw new Error("No usable native hit")
      expect(
        eventsOrThrow(
          game.send({
            type: "act",
            command: "skill",
            skill: skill.id,
            target: "foe-1",
          })
        ).filter((event) => event.type === "victory")
      ).toHaveLength(1)
      await verify(game, waiting)
    }
  )
for (const pending of [
  { kind: "treasure", gold: 0, goods: [] },
  { kind: "trap", damage: 1 },
] as const)
  test(`${pending.kind}: a retired confirmation cannot close a restored result`, async () => {
    await verify(
      definition.create(
        testEnvironment({ random: 0 }),
        town.inExpedition({ pending }).build()
      ),
      false
    )
  })
test("the default run keeps one foe per loot shape and the last foe", () => {
  expect(representatives.length).toBeGreaterThan(0)
  expect(new Set(representatives.map(lootShape))).toEqual(new Set(shapes))
  expect(representatives).toContain(foes.at(-1))
  // 拾い物の会話が始まる戦利品（品がある結果）は、既定の実行でも必ず通す。
  expect(representatives.some((foe) => foe.drops.length > 0)).toBe(true)
})
