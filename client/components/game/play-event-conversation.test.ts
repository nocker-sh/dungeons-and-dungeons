import { expect, it, vi } from "vite-plus/test"
import { playEventConversation } from "@/client/components/game/play-event-conversation"
import { GameDefinition } from "@/lib/wiz/definition/game-definition"
import { conversationScenario } from "@/development/conversations/scenario"
import { GameCommandError } from "@/lib/wiz/game/game-command-error"
import type { Game } from "@/lib/wiz/game/game"
import { inPhase } from "@/lib/wiz/phases/in-phase"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"
import { realContent } from "@/lib/wiz/testing/real-content"
import { testEnvironment } from "@/lib/wiz/testing/test-environment"

const definition = new GameDefinition(realContent())

it("starts a new available opening and waits for its real chosen reply", async () => {
  const game = definition.create(testEnvironment())
  let completed = false
  const playing = playEventConversation(game, "opening").then(() => {
    completed = true
  })
  expect(game.queries.activeConversation(game.state)?.id).toBe("opening-dawn")
  await Promise.resolve()
  expect(completed).toBe(false)
  eventsOrThrow(game.send({ type: "finish-conversation", choice: 0 }))
  await playing
  expect(completed).toBe(true)
  expect(game.state.conversation?.active).toBeNull()
  expect(game.state.conversation?.seen).toContain("opening-dawn")
})

function visit(game: Game, id: string, choice?: number) {
  const script = definition.catalog.data.conversations!.find(
    (entry) => entry.id === id
  )!
  eventsOrThrow(
    game.send({
      type: "start-conversation",
      trigger: "visit",
      place: script.place,
    })
  )
  expect(game.queries.activeConversation(game.state)?.id).toBe(id)
  eventsOrThrow(game.send({ type: "finish-conversation", choice }))
}

function savedLift() {
  const game = definition.create(testEnvironment())
  eventsOrThrow(game.send({ type: "start-conversation", trigger: "opening" }))
  eventsOrThrow(game.send({ type: "finish-conversation", choice: 0 }))
  eventsOrThrow(game.send({ type: "leave-camp" }))
  visit(game, "first-job-way-home", 0)
  visit(game, "tutorial-first-guild")
  eventsOrThrow(game.send({ type: "register-hero", name: "ノア" }))
  visit(game, "registered-at-guild")
  visit(game, "tutorial-first-outskirts")
  const lift = definition.catalog.data.conversations!.find(
    (entry) => entry.id === "prologue-lift"
  )!
  eventsOrThrow(
    game.send({
      type: "start-conversation",
      trigger: "visit",
      place: lift.place,
    })
  )
  expect(game.queries.activeConversation(game.state)?.id).toBe(lift.id)
  return JSON.parse(JSON.stringify(game.save())) as unknown
}

function resumedLift() {
  const random = vi.fn(() => 0.5)
  const game = definition.create(testEnvironment({ random }))
  expect(game.restore(savedLift())).toBeUndefined()
  random.mockClear()
  const script = game.queries.activeConversation(game.state)!
  const subject = { place: script.place }
  return { game, random, script, subject }
}

it("waits for the saved first-lift conversation before the real first departure", async () => {
  const f = resumedLift()
  expect(f.game.queries.prologue(f.game.state)).toBe("depart")
  expect(f.game.queries.readiness(f.game.state).ready).toBe(true)
  const before = f.game.save()
  const layers = f.game.queries.destinations(f.game.state)
  const layer = layers.find((entry) => entry.open)!
  let completed = false
  const playing = playEventConversation(
    f.game,
    "visit",
    undefined,
    f.subject
  ).then(() => {
    completed = true
  })
  await Promise.resolve()
  expect(completed).toBe(false)
  expect(inPhase(f.game, "town")).toBeNull()
  expect(f.game.send({ type: "depart", layer: layer.id })).toBeInstanceOf(
    GameCommandError
  )
  expect(f.game.save()).toEqual(before)
  expect(f.random).not.toHaveBeenCalled()
  eventsOrThrow(f.game.send({ type: "finish-conversation" }))
  await playing
  expect(completed).toBe(true)
  expect(f.game.state.conversation?.seen).toContain(f.script.id)
  expect(f.game.state.conversation?.flags).toContain("prologue:lift")
  const town = inPhase(f.game, "town")!
  const departed = town.depart(layer.id)
  expect(departed).not.toBeInstanceOf(GameCommandError)
  expect(f.game.state.phase.type).toBe("expedition")
  expect(f.game.state.lastLayer).toBe(layer.id)
  expect(f.game.queries.expedition(f.game.state)?.layer).toBe(layer.id)
  expect(f.game.queries.prologue(f.game.state)).toBeNull()
  expect(
    f.game.restore(JSON.parse(JSON.stringify(f.game.save())))
  ).toBeUndefined()
})

it("shares the pending conversation without starting or completing another script", async () => {
  const f = resumedLift()
  const before = f.game.save()
  let completed = 0
  const playing = [0, 1].map(() =>
    playEventConversation(f.game, "visit", undefined, f.subject).then(() => {
      completed++
    })
  )
  await Promise.resolve()
  expect(completed).toBe(0)
  expect(f.game.save()).toEqual(before)
  expect(f.random).not.toHaveBeenCalled()
  eventsOrThrow(f.game.send({ type: "finish-conversation" }))
  const finished = f.game.save()
  await Promise.all(playing)
  expect(completed).toBe(2)
  expect(f.game.save()).toEqual(finished)
})

it.each(["another-place", "another-trigger"] as const)(
  "does not start or await an unrelated active conversation: %s",
  async (unrelated) => {
    const f = resumedLift()
    const before = f.game.save()
    await playEventConversation(
      f.game,
      unrelated === "another-trigger" ? "inn" : "visit",
      undefined,
      unrelated === "another-place"
        ? {
            place: definition.catalog.data.conversations!.find(
              (entry) => entry.id === "registered-at-guild"
            )!.place,
          }
        : f.subject
    )
    expect(f.game.save()).toEqual(before)
    expect(f.random).not.toHaveBeenCalled()
  }
)

it.each(["before-start", "while-waiting"] as const)(
  "cancels waiting without completing the saved conversation: %s",
  async (when) => {
    const f = resumedLift()
    const before = f.game.save()
    const controller = new AbortController()
    if (when === "before-start") controller.abort()
    const playing = playEventConversation(
      f.game,
      "visit",
      controller.signal,
      f.subject
    )
    if (when === "while-waiting") controller.abort()
    await playing
    expect(f.game.save()).toEqual(before)
    expect(f.random).not.toHaveBeenCalled()
  }
)

it("does not replay the completed first-lift visit or alter its saved result", async () => {
  const f = resumedLift()
  eventsOrThrow(f.game.send({ type: "finish-conversation" }))
  expect(
    f.game.queries.canStartConversation(f.game.state, "visit", f.subject)
  ).toBe(false)
  const before = f.game.save()
  await playEventConversation(f.game, "visit", undefined, f.subject)
  expect(f.game.save()).toEqual(before)
  expect(f.random).not.toHaveBeenCalled()
})

it("keeps an unavailable visit from changing a fresh game or drawing random numbers", async () => {
  const random = vi.fn(() => 0.5)
  const game = definition.create(testEnvironment({ random }))
  const before = game.save()
  random.mockClear()
  await playEventConversation(game, "visit", undefined, {
    place: definition.catalog.data.conversations!.find(
      (entry) => entry.id === "prologue-lift"
    )!.place,
  })
  expect(game.save()).toEqual(before)
  expect(random).not.toHaveBeenCalled()
})

it.each([
  { id: "yoru-talk-09", speaker: 0, waits: true },
  { id: "yoru-talk-09", speaker: 1, waits: false },
  { id: "nui-zaza-friends-1", speaker: 0, waits: true },
  { id: "nui-zaza-friends-1", speaker: 1, waits: true },
])(
  "keeps the talk subject contract for $id / speaker $speaker",
  async (scenario) => {
    // 話しかける相手の局所的な契約を検査する。新規開始からの到達性とは区別する。
    const script = definition.catalog.data.conversations!.find(
      (entry) => entry.id === scenario.id
    )!
    const state = conversationScenario(definition, {
      owned: script.participants.filter(
        (person) => !!definition.catalog.member(person)
      ),
      party: [],
      demons: [
        ...new Set([
          definition.catalog.data.startingDemon!,
          ...script.participants.filter(
            (person) => !!definition.catalog.demon(person)
          ),
        ]),
      ],
      reached: script.minimumReached,
      cleared: false,
      trigger: "talk",
      seen: [],
      flags: [...script.requires],
      nights: script.minimumNights,
    })
    const random = vi.fn(() => 0.5)
    const game = definition.create(testEnvironment({ random }), {
      ...state,
      conversation: { ...state.conversation!, active: script.id },
    })
    const before = game.save()
    random.mockClear()
    let completed = false
    const playing = playEventConversation(game, "talk", undefined, {
      resident: script.participants[scenario.speaker],
    }).then(() => {
      completed = true
    })
    await Promise.resolve()
    expect(completed).toBe(!scenario.waits)
    expect(game.save()).toEqual(before)
    expect(random).not.toHaveBeenCalled()
    eventsOrThrow(game.send({ type: "finish-conversation" }))
    await playing
    expect(completed).toBe(true)
  }
)
