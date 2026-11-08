import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, expect, test, vi } from "vite-plus/test"
import { GameProvider } from "@/client/contexts/game-provider"
import { EventConversationScene } from "@/client/components/game/event-conversation-scene"
import type { Props as ViewProps } from "@/client/components/game/event-conversation-view"
import { StageContext } from "@/client/components/stage/use-stage"
import type { StageApi } from "@/client/components/stage/use-stage"
import { AnimationBarrier } from "@/client/components/canvas/animation"
import { Camera } from "@/client/components/stage/camera"
import { FxStore } from "@/client/components/stage/fx/store"
import { StageDirector } from "@/client/components/stage/director"
import { connectSave } from "@/client/game/connect-save"
import { MemoryStorage } from "@/client/game/memory-storage"
import { conversationScenario } from "@/development/conversations/scenario"
import type { ConversationDefinition } from "@/lib/wiz/conversations/schema"
import { GameDefinition } from "@/lib/wiz/definition/game-definition"
import { GameCommandError } from "@/lib/wiz/game/game-command-error"
import type { Game } from "@/lib/wiz/game/game"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"
import { realContent } from "@/lib/wiz/testing/real-content"
import { testEnvironment } from "@/lib/wiz/testing/test-environment"

const drawn = vi.hoisted(() => ({ current: null as ViewProps | null }))
// Observe the native scene's completion output while retaining its actual view and hooks.
vi.mock(
  "@/client/components/game/event-conversation-view",
  async (original) => {
    const actual =
      await original<
        typeof import("@/client/components/game/event-conversation-view")
      >()
    return {
      ...actual,
      EventConversationView: (props: ViewProps) => {
        drawn.current = props
        return createElement(actual.EventConversationView, props)
      },
    }
  }
)
afterEach(() => {
  vi.restoreAllMocks()
  drawn.current = null
})

const definition = new GameDefinition(realContent())
const scripts = definition.catalog.data.conversations!
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

function completedByView(game: Game) {
  drawn.current = null
  renderToStaticMarkup(
    createElement(GameProvider, {
      game,
      children: createElement(StageContext, {
        value: stage,
        children: createElement(EventConversationScene),
      }),
    })
  )
  const view = drawn.current as ViewProps | null
  if (!view)
    throw new Error("The native scene did not produce its conversation view")
  expect(view.script.id).toBe(game.state.conversation!.active)
  return view.onDone
}

function localConversation(script: ConversationDefinition) {
  const initial = definition.initialState()
  const members = script.participants.filter((id) =>
    definition.catalog.member(id)
  )
  const demons = script.participants.filter((id) =>
    definition.catalog.demon(id)
  )
  const seen = demons.includes(script.participants[0])
    ? scripts
        .filter(
          (entry) =>
            entry.trigger === "talk" &&
            entry.participants.includes(script.participants[0]) &&
            entry.id !== script.id &&
            entry.id !==
              definition.catalog.demon(script.participants[0])?.contract
                ?.encounter
        )
        .slice(0, script.minimumBond ?? 0)
        .map((entry) => entry.id)
    : []
  const base = conversationScenario(definition, {
    owned: members.filter(
      (id) => !initial.members.some((entry) => entry.id === id)
    ),
    party: [],
    demons,
    reached: Math.max(
      script.minimumReached,
      script.requiresCleared ? definition.catalog.data.layers.length - 1 : 0
    ),
    cleared: script.requiresCleared,
    trigger: script.trigger,
    seen,
    flags: [...script.requires],
    nights: Math.max(1, script.minimumNights),
  })
  return {
    ...base,
    members: base.members.map((member) => ({
      ...member,
      like: Math.max(member.like, script.minimumBond ?? 0),
    })),
    party: [...new Set([initial.party[0], ...members, ...initial.party])].slice(
      0,
      3
    ),
    conversation: { ...base.conversation!, active: script.id },
  }
}

function nativeConversation(script: ConversationDefinition) {
  const prepared = definition.create(
    testEnvironment(),
    localConversation(script)
  )
  expect(prepared.queries.problems(prepared.state)).toEqual([])
  const game = definition.create(testEnvironment())
  expect(
    game.restore(JSON.parse(JSON.stringify(prepared.save())))
  ).toBeUndefined()
  expect(game.queries.problems(game.state)).toEqual([])
  return game
}

const opening = scripts.find(
  (entry) => entry.trigger === "opening" && entry.choice
)!
const alternatives = scripts.filter((entry) => !entry.choice).slice(0, 2)

test.each(scripts)(
  "$id: a retired view completion cannot finish a different loaded conversation",
  (script) => {
    // Required ownership, bonds, flags and the active dialogue are explicit local conditions.
    const source = script.choice
      ? script.id === opening.id
        ? scripts.find((entry) => entry.choice && entry.id !== script.id)!
        : opening
      : alternatives.find((entry) => entry.id !== script.id)!
    const game = nativeConversation(source)
    expect(game.queries.problems(game.state)).toEqual([])
    const oldDone = completedByView(game)
    const other = nativeConversation(script)
    expect(other.queries.problems(other.state)).toEqual([])
    expect(
      game.restore(JSON.parse(JSON.stringify(other.save())))
    ).toBeUndefined()
    const before = game.save()
    const state = game.state
    oldDone(script.choice ? 0 : -1)
    expect(game.state).toBe(state)
    expect(game.save()).toEqual(before)
    expect(game.getSnapshot().error).toBeNull()
    const freshDone = completedByView(game)
    const expected = eventsOrThrow(
      other.send({
        type: "finish-conversation",
        ...(script.choice ? { choice: 0 } : {}),
      })
    )
    expect(expected).toBeDefined()
    freshDone(script.choice ? 0 : -1)
    freshDone(script.choice ? 0 : -1)
    expect(game.save()).toEqual(other.save())
  }
)

for (const script of scripts)
  for (const choice of script.choice
    ? script.choice.options.map((_, index) => index)
    : [-1])
    test(`${script.id}/${choice}: the native view completes and persists exactly one reply after a failed autosave`, async () => {
      const game = nativeConversation(script)
      expect(game.queries.problems(game.state)).toEqual([])
      const storage = new MemoryStorage()
      const session = connectSave(game, storage)
      await session.retrySave?.()
      const previous = storage.read()
      const done = completedByView(game)
      const control = definition.create(testEnvironment())
      expect(control.restore(JSON.parse(previous!))).toBeUndefined()
      eventsOrThrow(
        control.send({
          type: "finish-conversation",
          ...(choice < 0 ? {} : { choice }),
        })
      )
      const write = vi.spyOn(storage, "write").mockImplementationOnce(() => {
        throw new Error("Storage unavailable")
      })
      try {
        done(choice)
        done(choice)
        expect(game.save()).toEqual(control.save())
        expect(write).toHaveBeenCalledTimes(1)
        expect(storage.read()).toBe(previous)
        await session.retrySave?.()
        expect(write).toHaveBeenCalledTimes(2)
        expect(JSON.parse(storage.read()!)).toEqual(control.save())
        const restored = definition.create(testEnvironment())
        const resumed = connectSave(restored, storage)
        try {
          expect(resumed.status).toBe("restored")
          expect(restored.save()).toEqual(control.save())
          expect(restored.queries.problems(restored.state)).toEqual([])
          expect(
            restored.send({
              type: "finish-conversation",
              ...(choice < 0 ? {} : { choice }),
            })
          ).toBeInstanceOf(GameCommandError)
          expect(restored.save()).toEqual(control.save())
        } finally {
          resumed.disconnect()
        }
      } finally {
        session.disconnect()
      }
    })

test.each([0, 1])(
  "an old opening completion cannot answer the next native onboarding conversation: choice %s",
  async (choice) => {
    const game = definition.create(testEnvironment())
    eventsOrThrow(game.send({ type: "start-conversation", trigger: "opening" }))
    expect(game.state.conversation!.active).toBe(opening.id)
    const oldDone = completedByView(game)
    eventsOrThrow(game.send({ type: "finish-conversation", choice: 0 }))
    eventsOrThrow(game.send({ type: "leave-camp" }))
    const next = scripts.find((entry) => entry.id === "first-job-way-home")!
    eventsOrThrow(
      game.send({
        type: "start-conversation",
        trigger: "visit",
        place: next.place,
      })
    )
    expect(game.state.conversation!.active).toBe(next.id)
    const before = game.save()
    const state = game.state
    oldDone(0)
    expect(game.state).toBe(state)
    expect(game.save()).toEqual(before)
    const control = definition.create(testEnvironment())
    expect(control.restore(JSON.parse(JSON.stringify(before)))).toBeUndefined()
    eventsOrThrow(control.send({ type: "finish-conversation", choice }))
    const storage = new MemoryStorage()
    const session = connectSave(game, storage)
    await session.retrySave?.()
    const previous = storage.read()
    const write = vi.spyOn(storage, "write").mockImplementationOnce(() => {
      throw new Error("Storage unavailable")
    })
    let resumed: ReturnType<typeof connectSave> | null = null
    try {
      completedByView(game)(choice)
      expect(game.save()).toEqual(control.save())
      expect(write).toHaveBeenCalledTimes(1)
      expect(storage.read()).toBe(previous)
      session.disconnect()
      const restarted = definition.create(testEnvironment())
      resumed = connectSave(restarted, storage)
      expect(resumed.status).toBe("restored")
      expect(restarted.save()).toEqual(before)
      const fresh = completedByView(restarted)
      fresh(choice)
      fresh(choice)
      oldDone(0)
      expect(write).toHaveBeenCalledTimes(2)
      expect(restarted.save()).toEqual(control.save())
      expect(JSON.parse(storage.read()!)).toEqual(control.save())
    } finally {
      resumed?.disconnect()
      session.disconnect()
    }
  }
)
