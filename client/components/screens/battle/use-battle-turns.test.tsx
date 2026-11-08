// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react"
import { afterEach, expect, test, vi } from "vite-plus/test"
import {
  AnimationBarrier,
  animationClock,
} from "@/client/components/canvas/animation"
import { playback } from "@/client/components/canvas/playback"
import { FormationCards } from "@/client/components/game/formation-cards"
import type { FormationControl } from "@/client/components/game/formation/context"
import { BattleDirector } from "@/client/components/screens/battle/director"
import { BattleParts } from "@/client/components/screens/battle/parts"
import { useBattleTurns } from "@/client/components/screens/battle/use-battle-turns"
import type { ActInput } from "@/client/components/screens/battle/use-battle-turns"
import { Camera } from "@/client/components/stage/camera"
import { StageDirector } from "@/client/components/stage/director"
import { FxStore } from "@/client/components/stage/fx/store"
import { useFx } from "@/client/components/stage/use-fx"
import { StageContext } from "@/client/components/stage/use-stage"
import type { StageApi } from "@/client/components/stage/use-stage"
import { connectSave } from "@/client/game/connect-save"
import { MemoryStorage } from "@/client/game/memory-storage"
import { GameDefinition } from "@/lib/wiz/definition/game-definition"
import { GameCommandError } from "@/lib/wiz/game/game-command-error"
import { realContent } from "@/lib/wiz/testing/real-content"
import { aState } from "@/lib/wiz/testing/state-builder"
import { contentId } from "@/lib/wiz/testing/content-id"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"
import { testEnvironment } from "@/lib/wiz/testing/test-environment"
import type { GameState, Status } from "@/lib/wiz/state/state-schema"

// Only image decoding and effect output are replaced; battle rules and save IO are real.
vi.mock("@/client/components/screens/battle/artwork", () => ({
  loadBattleArtwork: async () => false,
}))

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  animationClock.scale = 1
})

const definition = new GameDefinition(realContent())
const potion = definition.catalog.data.goods.find(
  (good) => good.kind === "item" && good.effect?.type === "heal"
)!
const foe = definition.catalog.data.foes.reduce((strongest, entry) =>
  entry.hp > strongest.hp ? entry : strongest
)

function fixture(
  foeFirst = false,
  opponent = foe,
  status: readonly Status[] = [],
  options: {
    good?: (typeof definition.catalog.data.goods)[number]
    secondFoe?: boolean
    state?: GameState
  } = {}
) {
  const itemGood = options.good ?? potion
  let initial = aState(definition.catalog)
    .withBag([{ good: itemGood.id, count: 2 }])
    .withMember("alda", {
      hp: itemGood.effect?.type === "revive" ? 0 : 1,
      used:
        itemGood.effect?.type === "refill"
          ? [{ skill: contentId("helmsplit"), count: 3 }]
          : [],
      status:
        itemGood.effect?.type === "cure"
          ? itemGood.effect.kinds.map((kind) => ({ kind, turns: 3 }))
          : [],
    })
    .inBattle({
      foes: options.secondFoe ? [opponent.id, opponent.id] : [opponent.id],
      order: [
        ...(foeFirst
          ? ["foe-1", "hero", "alda", "mort"]
          : ["hero", "foe-1", "alda", "mort"]),
        ...(options.secondFoe ? ["foe-2"] : []),
      ],
    })
    .build()
  if (status.length && initial.phase.type === "battle")
    initial = {
      ...initial,
      phase: {
        ...initial.phase,
        battle: {
          ...initial.phase.battle,
          foes: initial.phase.battle.foes.map((entry) => ({
            ...entry,
            hp: foeFirst ? 1 : Math.max(1, entry.maxHp - 1),
            status,
          })),
        },
      },
    }
  const game = definition.create(
    testEnvironment({ random: 0 }),
    options.state ?? initial
  )
  const storage = new MemoryStorage()
  const session = connectSave(game, storage)
  const controller = new AbortController()
  const view = game.queries.battle(game.state)!
  const stage: StageApi = {
    exits: new AnimationBarrier(),
    updates: new AnimationBarrier(),
    camera: new Camera(),
    fxStore: new FxStore(),
    set: { current: null },
    artboard: null,
    chrome: null,
    solo: null,
    art: async () => {},
    bars: () => {},
    canvas: { current: null },
    director: new StageDirector(),
  }
  vi.spyOn(stage.fxStore, "add").mockImplementation(() =>
    playback(Promise.resolve(), () => {})
  )
  const formation: FormationControl = {
    cards: new FormationCards(),
    lifted: null,
    lift: vi.fn(),
    press: vi.fn(),
    openBag: vi.fn(),
    bagOpen: false,
    cardsHidden: false,
    target: null,
    requestTarget: vi.fn(),
    setPress: vi.fn(),
    frozen: false,
    freeze: vi.fn(),
  }
  const setMenu = vi.fn()
  const setAttacking = vi.fn()
  const setSettled = vi.fn()
  let shownHp = Object.fromEntries(
    view.foes.map((entry) => [entry.id, entry.hp])
  )
  let gone: string[] = []
  const onEnd = vi.fn()
  const hook = renderHook(
    () => {
      const fx = useFx()
      const parts = new BattleParts(fx, formation.cards)
      const director = new BattleDirector({
        game,
        fx,
        stage,
        formation,
        parts,
        view,
        scene: null,
        gone: [],
        signal: () => controller.signal,
        nav: {
          screen: { name: "town" },
          enter: undefined,
          leaving: false,
          phase: { kind: "showing", screen: { name: "town" } },
          go: async () => {},
          arrived: () => {},
        },
        onEnd,
        setPhase: vi.fn(),
        setMenu,
        setPeek: vi.fn(),
        setShownHp: (next) => {
          shownHp = typeof next === "function" ? next(shownHp) : next
        },
        setGone: (next) => {
          gone = typeof next === "function" ? next(gone) : next
        },
      })
      return useBattleTurns({
        game,
        fx,
        formation,
        parts,
        director,
        wide: false,
        signal: () => controller.signal,
        actorId: view.current.kind === "member" ? view.current.id : null,
        current: view.current,
        aim: view.foes.at(-1)!.id,
        setMenu,
        setAttacking,
        setSettled,
      })
    },
    {
      wrapper: (props) => (
        <StageContext value={stage}>{props.children}</StageContext>
      ),
    }
  )
  const item = game.queries
    .commands(game.state, game.state.party[0])!
    .items.find((entry) => entry.id === itemGood.id)!
  expect(item.usable).toBe(true)
  const input: ActInput = {
    command: "item",
    good: itemGood.id,
    target: item.target === "ally" ? item.targets[0] : undefined,
  }
  return {
    game,
    storage,
    session,
    controller,
    formation,
    setMenu,
    setAttacking,
    setSettled,
    hook,
    input,
    shownHp: () => shownHp,
    gone: () => gone,
    onEnd,
  }
}

for (const command of ["guard", "item"] as const)
  for (const interruption of ["before-call", "menu-output", "freeze-output"])
    test(`${command}: ending the screen ${interruption} cannot spend a turn, an item or publish a save`, async () => {
      const f = fixture()
      try {
        const before = f.game.save()
        const action = f.hook.result.current.act
        if (interruption === "before-call") {
          f.controller.abort()
          f.hook.unmount()
        }
        if (interruption === "menu-output")
          f.setMenu.mockImplementation(() => f.controller.abort())
        if (interruption === "freeze-output")
          vi.mocked(f.formation.freeze).mockImplementation(() =>
            f.controller.abort()
          )
        await act(async () => {
          await action(command === "item" ? f.input : { command })
        })
        expect(f.game.save()).toEqual(before)
        expect(f.storage.read()).toBeNull()
        expect(f.setAttacking).not.toHaveBeenCalled()
        expect(f.setSettled).not.toHaveBeenCalled()
      } finally {
        f.session.disconnect()
      }
    })

for (const interruption of ["before-call", "lift-output", "freeze-output"])
  test(`a foe turn ending ${interruption} cannot damage the party or publish a save`, async () => {
    const f = fixture(true)
    try {
      const before = f.game.save()
      if (interruption === "before-call") f.controller.abort()
      if (interruption === "lift-output")
        vi.mocked(f.formation.lift).mockImplementation(() =>
          f.controller.abort()
        )
      if (interruption === "freeze-output")
        vi.mocked(f.formation.freeze).mockImplementation(() =>
          f.controller.abort()
        )
      await act(async () => {
        await f.hook.result.current.foeTurn()
      })
      expect(f.game.save()).toEqual(before)
      expect(f.storage.read()).toBeNull()
      expect(f.setAttacking).not.toHaveBeenCalled()
      expect(f.setSettled).not.toHaveBeenCalled()
    } finally {
      f.session.disconnect()
    }
  })

for (const foeFirst of [false, true])
  test.each(definition.catalog.data.foes)(
    `$slug: native status results, shown HP and saved resumption agree, foeFirst=${foeFirst}`,
    async (opponent) => {
      // The battle, injury and statuses are local starting conditions. No event or result is fabricated.
      animationClock.scale = 0
      const status: Status[] = foeFirst
        ? [{ kind: "poison", turns: 2 }]
        : [
            { kind: "regen", turns: 2 },
            { kind: "poison", turns: 2 },
            { kind: "bind", turns: 1 },
          ]
      const f = fixture(foeFirst, opponent, status)
      const sent = vi.spyOn(f.game, "send")
      try {
        await act(async () => {
          if (foeFirst) await f.hook.result.current.foeTurn()
          else await f.hook.result.current.act({ command: "guard" })
        })
        expect(sent).toHaveBeenCalledTimes(1)
        const events: ReturnType<typeof f.game.send> =
          sent.mock.results[0].value
        if (events instanceof GameCommandError) throw events
        expect(
          events.some(
            (event) =>
              event.type === "ticked" &&
              event.target.id === "foe-1" &&
              event.status === "poison"
          )
        ).toBe(true)
        if (!foeFirst) {
          expect(
            events.some(
              (event) => event.type === "skipped" && event.actor.id === "foe-1"
            )
          ).toBe(true)
          expect(
            events.some(
              (event) =>
                event.type === "ticked" &&
                event.target.id === "foe-1" &&
                event.status === "regen" &&
                (event.heal ?? 0) > 0
            )
          ).toBe(true)
        }
        expect(f.game.getSnapshot().error).toBeNull()
        const live = f.game.queries.battle(f.game.state)
        const hp = live?.foes.find((entry) => entry.id === "foe-1")?.hp ?? 0
        expect(f.shownHp()).toEqual({ "foe-1": hp })
        if (hp === 0) {
          expect(f.onEnd).toHaveBeenCalledExactlyOnceWith("victory")
          expect(f.gone()).toEqual(["foe-1"])
        } else {
          expect(f.onEnd).not.toHaveBeenCalled()
          expect(f.gone()).toEqual([])
        }
        expect(f.hook.result.current.busy.current).toBe(false)
        expect(f.setSettled).toHaveBeenCalledTimes(1)
        expect(JSON.parse(f.storage.read()!)).toEqual(f.game.save())
        const restored = definition.create(testEnvironment({ random: 0 }))
        const resumed = connectSave(restored, f.storage)
        try {
          expect(resumed.status).toBe("restored")
          expect(restored.state).toEqual(f.game.state)
        } finally {
          resumed.disconnect()
        }
      } finally {
        f.session.disconnect()
      }
    }
  )

for (const command of ["guard", "item"] as const)
  test(`ending after the actual ${command} is committed keeps its one result and autosave`, async () => {
    const f = fixture()
    try {
      const before = f.game.save()
      const stop = f.game.subscribe(() => f.controller.abort())
      await act(async () => {
        await f.hook.result.current.act(
          command === "item" ? f.input : { command }
        )
      })
      stop()
      expect(f.game.save()).not.toEqual(before)
      expect(JSON.parse(f.storage.read()!)).toEqual(f.game.save())
      expect(f.setSettled).not.toHaveBeenCalled()
      const restored = definition.create(testEnvironment({ random: 0 }))
      const resumed = connectSave(restored, f.storage)
      expect(resumed.status).toBe("restored")
      expect(restored.state).toEqual(f.game.state)
      resumed.disconnect()
    } finally {
      f.session.disconnect()
    }
  })

test.each(definition.catalog.data.goods.filter((good) => good.kind === "item"))(
  "$name ($id): native battle input preserves ally groups, selected enemies and the saved item outcome",
  async (good) => {
    animationClock.scale = 0
    const f = fixture(false, foe, [], { good, secondFoe: true })
    const control = definition.create(testEnvironment({ random: 0 }))
    expect(
      control.restore(JSON.parse(JSON.stringify(f.game.save())))
    ).toBeUndefined()
    const item = f.game.queries
      .commands(f.game.state, f.game.state.party[0])!
      .items.find((entry) => entry.id === good.id)!
    expect(item.usable).toBe(true)
    // Battle.pick sends no individual target for groups and hostile items; only a
    // single ally is chosen on a party card. The enemy cursor here points at foe-2.
    const target =
      item.target === "foe"
        ? "foe-2"
        : f.input.command === "item"
          ? f.input.target
          : undefined
    const expected = eventsOrThrow(
      control.send({ type: "act", command: "item", good: good.id, target })
    )
    try {
      await act(async () => {
        await f.hook.result.current.act(f.input)
      })
      expect(f.game.save()).toEqual(control.save())
      expect(f.game.getSnapshot().error).toBeNull()
      expect(JSON.parse(f.storage.read()!)).toEqual(control.save())
      const acted = expected.find((event) => event.type === "acted")
      expect(acted?.command).toBe("item")
      if (item.target === "foe")
        expect(acted?.results.map((entry) => entry.target.id)).toEqual([
          "foe-2",
        ])
      expect(f.hook.result.current.busy.current).toBe(false)
      expect(f.setSettled).toHaveBeenCalledTimes(1)
      const restored = definition.create(testEnvironment({ random: 0 }))
      const resumed = connectSave(restored, f.storage)
      try {
        expect(resumed.status).toBe("restored")
        expect(restored.save()).toEqual(control.save())
      } finally {
        resumed.disconnect()
      }
    } finally {
      f.session.disconnect()
    }
  }
)

const nativeMembers = [
  ...definition.catalog.data.party,
  ...definition.catalog.data.recruits.map((entry) => entry.member),
]
for (const critical of [false, true])
  for (const member of nativeMembers)
    for (const contract of member.hero
      ? [null, ...definition.catalog.data.demons.map((entry) => entry.id)]
      : [aState(definition.catalog).build().contract]) {
      let builder = aState(definition.catalog)
      if (!builder.build().members.some((entry) => entry.id === member.id))
        builder = builder.withJoined(member.id)
      builder =
        contract === null
          ? builder.withoutDemon()
          : builder.withDemons([{ id: contract, lv: 1, exp: 0 }], contract)
      const companions = builder
        .build()
        .members.filter((entry) => entry.id !== member.id)
        .slice(0, 2)
      expect(companions).toHaveLength(2)
      // Recruitment, contract, wounds, supplies and battle entry are local starting conditions.
      const initial = builder
        .withParty([member.id, ...companions.map((entry) => entry.id)])
        .withMembers({ hp: 1, used: [], status: [] })
        .withMember(member.id, {
          hp: critical
            ? 1
            : definition.rules.party.stats(
                builder
                  .build()
                  .members.find((entry) => entry.id === member.id)!,
                builder.build()
              ).maxHp,
        })
        .withMember(companions[0].id, { hp: 0 })
        .withBag([{ good: potion.id, count: 2 }])
        .inBattle({
          foes: [foe.id, foe.id],
          order: [member.id, "foe-1", "foe-2", companions[1].id],
        })
        .build()
      const probe = definition.create(testEnvironment({ random: 0 }), initial)
      expect(probe.queries.problems(probe.state)).toEqual([])
      const commands = probe.queries.commands(probe.state, member.id)!
      const skills = [
        ...commands.weaponSkills,
        ...commands.skills,
        ...(commands.blessing ? [commands.blessing] : []),
      ]
      expect(skills.length).toBeGreaterThan(0)
      test.each(skills)(
        `${member.id}, contract=${contract}, critical=${critical}: native UI skill $name ($id) matches direct execution and saved recovery`,
        async (skill) => {
          animationClock.scale = 0
          const f = fixture(false, foe, [], { state: initial })
          const control = definition.create(testEnvironment({ random: 0 }))
          expect(
            control.restore(JSON.parse(JSON.stringify(f.game.save())))
          ).toBeUndefined()
          await f.session.retrySave?.()
          const bytes = f.storage.read()
          const before = structuredClone(f.game.save())
          const target =
            skill.target === "ally"
              ? skill.targets[0]
              : skill.target === "foe"
                ? "foe-2"
                : undefined
          const expected = control.send({
            type: "act",
            command: "skill",
            skill: skill.id,
            target,
          })
          expect(!(expected instanceof GameCommandError)).toBe(skill.usable)
          const input: ActInput = {
            command: "skill",
            skill: skill.id,
            target: skill.target === "ally" ? target : undefined,
          }
          const failedWrite = critical
            ? vi.spyOn(f.storage, "write").mockImplementationOnce(() => {
                throw new Error("Storage unavailable")
              })
            : null
          try {
            await act(async () => {
              const pending = f.hook.result.current.act(input)
              if (!(expected instanceof GameCommandError))
                await f.hook.result.current.act(input)
              await pending
            })
            expect(f.game.save()).toEqual(control.save())
            expect(f.hook.result.current.busy.current).toBe(false)
            expect(f.setSettled).toHaveBeenCalledTimes(1)
            if (critical) {
              expect(failedWrite).toHaveBeenCalledTimes(1)
              expect(f.storage.read()).toBe(bytes)
              await f.session.retrySave?.()
              expect(failedWrite).toHaveBeenCalledTimes(2)
            }
            if (expected instanceof GameCommandError) {
              expect(f.game.save()).toEqual(before)
              expect(f.setMenu).toHaveBeenLastCalledWith("command")
              expect(f.storage.read()).toBe(bytes)
            } else {
              expect(f.game.getSnapshot().error).toBeNull()
              expect(JSON.parse(f.storage.read()!)).toEqual(control.save())
              const acted = expected.find((event) => event.type === "acted")
              expect(acted?.command).toBe("skill")
              if (skill.target === "foe")
                expect(
                  acted?.results
                    .filter((entry) => entry.target.kind === "foe")
                    .map((entry) => entry.target.id)
                ).toEqual(["foe-2"])
            }
            const restored = definition.create(testEnvironment({ random: 0 }))
            const resumed = connectSave(restored, f.storage)
            try {
              expect(resumed.status).toBe("restored")
              expect(restored.save()).toEqual(control.save())
              expect(restored.queries.problems(restored.state)).toEqual([])
              expect(restored.queries.battle(restored.state)).toEqual(
                control.queries.battle(control.state)
              )
              for (const id of restored.state.party)
                expect(restored.queries.commands(restored.state, id)).toEqual(
                  control.queries.commands(control.state, id)
                )
            } finally {
              resumed.disconnect()
            }
          } finally {
            f.session.disconnect()
          }
        }
      )
    }
