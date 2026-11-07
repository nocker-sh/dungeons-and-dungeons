// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test"
import { AnimationBarrier } from "@/client/components/canvas/animation"
import { playback } from "@/client/components/canvas/playback"
import { FormationCards } from "@/client/components/game/formation-cards"
import { FormationContext } from "@/client/components/game/formation/context"
import type { FormationControl } from "@/client/components/game/formation/context"
import { BagView } from "@/client/components/screens/bag-view"
import { Camera } from "@/client/components/stage/camera"
import { StageDirector } from "@/client/components/stage/director"
import { FxStore } from "@/client/components/stage/fx/store"
import { StageContext } from "@/client/components/stage/use-stage"
import type { StageApi } from "@/client/components/stage/use-stage"
import { GameProvider } from "@/client/contexts/game-provider"
import { connectSave } from "@/client/game/connect-save"
import { MemoryStorage } from "@/client/game/memory-storage"
import { GameDefinition } from "@/lib/wiz/definition/game-definition"
import { aState } from "@/lib/wiz/testing/state-builder"
import { contentId } from "@/lib/wiz/testing/content-id"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"
import { realContent } from "@/lib/wiz/testing/real-content"
import { testEnvironment } from "@/lib/wiz/testing/test-environment"
import type { Expedition } from "@/lib/wiz/state/state-schema"

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    }
  )
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const definition = new GameDefinition(realContent())
const scenes: ReadonlyArray<{ name: string; pending?: Expedition["pending"] }> =
  [
    { name: "town" },
    { name: "expedition", pending: null },
    { name: "discovery", pending: { kind: "discovery" } },
    { name: "treasure", pending: { kind: "treasure", gold: 7, goods: [] } },
    { name: "trap", pending: { kind: "trap", damage: 7 } },
    {
      name: "loot",
      pending: { kind: "loot", gold: 7, goods: [], boss: false, stones: 0 },
    },
  ]

for (const scene of scenes)
  test.each(
    definition.catalog.data.goods.filter((entry) => entry.kind === "item")
  )(
    `${scene.name}: actual bag controls and autosave agree with native use for $id`,
    async (good) => {
      if (!good.effect) throw new Error(`${good.id}: missing item effect`)
      // Possessions, injury, spent uses and the pending result are local starting conditions.
      const builder = aState(definition.catalog)
        .withBag([{ good: good.id, count: 2 }])
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
      const discoveryLayer = definition.catalog.data.layers.find((layer) =>
        layer.stations.some((station) => station.discovery)
      )!
      expect(discoveryLayer).toBeDefined()
      const discovery = discoveryLayer.stations.find(
        (station) => station.discovery
      )!
      const initial = (
        scene.name === "town"
          ? builder
          : builder.inExpedition({
              pending: scene.pending,
              ...(scene.name === "discovery"
                ? {
                    layer: discoveryLayer.id,
                    at: discovery.id,
                    visited: [discoveryLayer.start, discovery.id],
                  }
                : {}),
            })
      ).build()
      const game = definition.create(testEnvironment(), initial)
      const control = definition.create(testEnvironment(), initial)
      const storage = new MemoryStorage()
      const session = connectSave(game, storage)
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
      // Effects and the target request are display outputs; no item rule or query is replaced.
      vi.spyOn(stage.fxStore, "add").mockImplementation(() =>
        playback(Promise.resolve(), () => {})
      )
      const target = vi.fn<FormationControl["requestTarget"]>()
      const formation: FormationControl = {
        cards: new FormationCards(),
        lifted: null,
        lift() {},
        press() {},
        openBag() {},
        bagOpen: true,
        cardsHidden: true,
        target: null,
        requestTarget: target,
        setPress() {},
        frozen: false,
        freeze() {},
      }
      try {
        render(
          <GameProvider game={game}>
            <StageContext value={stage}>
              <FormationContext value={formation}>
                <BagView onClose={() => {}} closeSignal={0} />
              </FormationContext>
            </StageContext>
          </GameProvider>
        )
        const item = game.queries
          .items(game.state)
          .find((entry) => entry.id === good.id)!
        fireEvent.click(screen.getByRole("button", { name: item.name }))
        const before = game.save()
        if (!item.field) {
          expect(screen.queryByRole("button", { name: "使う" })).toBeNull()
          expect(game.save()).toEqual(before)
          expect(storage.read()).toBeNull()
          return
        }
        expect(item.usable).toBe(true)
        fireEvent.click(screen.getByRole("button", { name: "使う" }))
        if (item.target === "ally") {
          const request = target.mock.calls.at(-1)![0]!
          expect(request.eligible).toEqual(item.targets)
          request.onCancel()
          expect(game.save()).toEqual(before)
          expect(storage.read()).toBeNull()
          fireEvent.click(screen.getByRole("button", { name: "使う" }))
          const chosen = target.mock.calls.at(-1)![0]!
          await act(async () => chosen.onPick(item.targets[0]))
        }
        eventsOrThrow(
          control.send({
            type: "use",
            good: good.id,
            ...(item.target === "ally" ? { member: item.targets[0] } : {}),
          })
        )
        expect(game.save()).toEqual(control.save())
        expect(game.save()).not.toEqual(before)
        expect(JSON.parse(storage.read()!)).toEqual(game.save())
        const restored = definition.create(testEnvironment())
        const resumed = connectSave(restored, storage)
        try {
          expect(resumed.status).toBe("restored")
          expect(restored.state).toEqual(game.state)
        } finally {
          resumed.disconnect()
        }
      } finally {
        session.disconnect()
      }
    }
  )
