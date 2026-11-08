// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test"
import { playback } from "@/client/components/canvas/playback"
import { useFormation } from "@/client/components/game/formation/context"
import { Shell } from "@/client/components/game/shell"
import { TargetDim } from "@/client/components/game/target-dim"
import { BagView } from "@/client/components/screens/bag-view"
import { FxStore } from "@/client/components/stage/fx/store"
import { GameProvider } from "@/client/contexts/game-provider"
import { connectSave } from "@/client/game/connect-save"
import { MemoryStorage } from "@/client/game/memory-storage"
import { usableInField } from "@/lib/wiz/rules/field-usable"
import { effectSpec } from "@/lib/wiz/rules/item-effect-spec"
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
// Substitute only the background scene. Shell owns the real overlay machine and member cards.
function BagSurface() {
  const formation = useFormation()
  return (
    <>
      <BagView onClose={() => {}} closeSignal={0} />
      {formation.target ? <TargetDim request={formation.target} /> : null}
    </>
  )
}
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
      // Only effect output is replaced; item rules, target requests and overlay transitions are real.
      vi.spyOn(FxStore.prototype, "add").mockImplementation(() =>
        playback(Promise.resolve(), () => {})
      )
      try {
        render(
          <GameProvider game={game}>
            <Shell
              game={game}
              unreadable={null}
              onDiscard={async () => {}}
              saveFailed={false}
              preview={{
                screen: { name: "town", intro: false },
                overlay: { kind: "bag" },
                render: <BagSurface />,
              }}
            />
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
          const cards = [
            ...document.querySelectorAll<HTMLButtonElement>(
              ".formation .card .hit"
            ),
          ]
          expect(cards).toHaveLength(game.state.party.length)
          for (const [index, member] of game.state.party.entries()) {
            expect(cards[index].disabled).toBe(!item.targets.includes(member))
            if (!item.targets.includes(member)) {
              fireEvent.click(cards[index])
              expect(game.save()).toEqual(before)
              expect(storage.read()).toBeNull()
              expect(
                screen.getByRole("button", { name: "やめる" })
              ).toBeDefined()
            }
          }
          fireEvent.click(screen.getByRole("button", { name: "やめる" }))
          expect(screen.queryByRole("button", { name: "やめる" })).toBeNull()
          expect(game.save()).toEqual(before)
          expect(storage.read()).toBeNull()
          fireEvent.click(screen.getByRole("button", { name: "使う" }))
          const chosen = document.querySelectorAll<HTMLButtonElement>(
            ".formation .card .hit"
          )[game.state.party.indexOf(item.targets[0])]
          await act(async () => fireEvent.click(chosen))
          expect(screen.queryByRole("button", { name: "やめる" })).toBeNull()
          const used = game.save()
          await act(async () => fireEvent.click(chosen))
          expect(game.save()).toEqual(used)
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

for (const scene of scenes)
  test.each(
    definition.catalog.data.goods.filter(
      (good) =>
        good.kind === "item" &&
        good.effect &&
        usableInField(good.effect) &&
        effectSpec(good.effect).target === "ally"
    )
  )(
    `${scene.name}: a target selected before restoring cannot consume $id in the restored game`,
    async (good) => {
      if (!good.effect) throw new Error(`${good.id}: missing effect`)
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
      vi.spyOn(FxStore.prototype, "add").mockImplementation(() =>
        playback(Promise.resolve(), () => {})
      )
      try {
        render(
          <GameProvider game={game}>
            <Shell
              game={game}
              unreadable={null}
              onDiscard={async () => {}}
              saveFailed={false}
              preview={{
                screen: { name: "town", intro: false },
                overlay: { kind: "bag" },
                render: <BagSurface />,
              }}
            />
          </GameProvider>
        )
        const item = game.queries
          .items(game.state)
          .find((entry) => entry.id === good.id)!
        expect(item.field && item.usable).toBe(true)
        expect(item.target).toBe("ally")
        fireEvent.click(screen.getByRole("button", { name: item.name }))
        fireEvent.click(screen.getByRole("button", { name: "使う" }))
        const saved = game.save()
        await act(async () => {
          expect(game.restore(saved)).toBeUndefined()
        })
        expect(control.restore(saved)).toBeUndefined()
        const before = game.save()
        const bytes = storage.read()
        const choose = () =>
          document.querySelectorAll<HTMLButtonElement>(".formation .card .hit")[
            game.state.party.indexOf(item.targets[0])
          ]
        await act(async () => fireEvent.click(choose()))
        expect(game.save()).toEqual(before)
        expect(storage.read()).toBe(bytes)
        expect(screen.queryByRole("button", { name: "やめる" })).toBeNull()
        fireEvent.click(screen.getByRole("button", { name: "使う" }))
        await act(async () => fireEvent.click(choose()))
        eventsOrThrow(
          control.send({ type: "use", good: good.id, member: item.targets[0] })
        )
        expect(game.save()).toEqual(control.save())
        expect(game.save()).not.toEqual(before)
        expect(JSON.parse(storage.read()!)).toEqual(game.save())
      } finally {
        session.disconnect()
      }
    }
  )

for (const phase of ["town", "expedition"])
  test.each(
    definition.catalog.data.goods.filter(
      (good) => good.kind === "weapon" || good.kind === "armor"
    )
  )(
    `${phase}: real bag equipment selection and autosave agree with native equip for $id`,
    async (good) => {
      // One unowned item and its wear/upgrade are local possessions, not an acquisition playthrough.
      const builder = aState(definition.catalog)
        .withGear([])
        .withEquipped("alda", good.id, {
          owner: null,
          plus: 2,
          wear: good.kind === "armor" ? 7 : 0,
        })
      const initial = (
        phase === "town" ? builder : builder.inExpedition()
      ).build()
      const game = definition.create(testEnvironment(), initial)
      const control = definition.create(testEnvironment(), initial)
      const storage = new MemoryStorage()
      const session = connectSave(game, storage)
      vi.spyOn(FxStore.prototype, "add").mockImplementation(() =>
        playback(Promise.resolve(), () => {})
      )
      try {
        render(
          <GameProvider game={game}>
            <Shell
              game={game}
              unreadable={null}
              onDiscard={async () => {}}
              saveFailed={false}
              preview={{
                screen: { name: "town", intro: false },
                overlay: { kind: "bag" },
                render: <BagSurface />,
              }}
            />
          </GameProvider>
        )
        const gear = game.queries
          .gear(game.state)
          .find((entry) => entry.id === good.id)!
        expect(gear).toBeDefined()
        const eligible =
          phase === "town"
            ? game.state.party.filter((member) =>
                game.queries
                  .equipOptions(game.state, member)
                  .some((entry) => entry.gear === gear.gear)
              )
            : []
        fireEvent.click(screen.getByRole("button", { name: "装備" }))
        fireEvent.click(screen.getByRole("button", { name: gear.name }))
        const before = game.save()
        if (!eligible.length) {
          expect(
            screen.queryByRole("button", { name: "仲間に装備" })
          ).toBeNull()
          expect(game.save()).toEqual(before)
          expect(storage.read()).toBeNull()
          return
        }
        fireEvent.click(screen.getByRole("button", { name: "仲間に装備" }))
        const cards = [
          ...document.querySelectorAll<HTMLButtonElement>(
            ".formation .card .hit"
          ),
        ]
        expect(cards).toHaveLength(game.state.party.length)
        expect(
          game.state.party.filter((_member, index) => !cards[index].disabled)
        ).toEqual(eligible)
        for (const [index, member] of game.state.party.entries()) {
          if (!eligible.includes(member)) {
            fireEvent.click(cards[index])
            expect(game.save()).toEqual(before)
            expect(storage.read()).toBeNull()
            expect(screen.getByRole("button", { name: "やめる" })).toBeDefined()
          }
        }
        fireEvent.click(screen.getByRole("button", { name: "やめる" }))
        expect(screen.queryByRole("button", { name: "やめる" })).toBeNull()
        expect(game.save()).toEqual(before)
        expect(storage.read()).toBeNull()
        fireEvent.click(screen.getByRole("button", { name: "仲間に装備" }))
        const chosen = document.querySelectorAll<HTMLButtonElement>(
          ".formation .card .hit"
        )[game.state.party.indexOf(eligible[0])]
        await act(async () => fireEvent.click(chosen))
        expect(screen.queryByRole("button", { name: "やめる" })).toBeNull()
        eventsOrThrow(
          control.send({
            type: "equip",
            gear: gear.gear,
            member: eligible[0],
          })
        )
        expect(game.save()).toEqual(control.save())
        expect(game.save()).not.toEqual(before)
        const equipped = game.save()
        await act(async () => fireEvent.click(chosen))
        expect(game.save()).toEqual(equipped)
        expect(JSON.parse(storage.read()!)).toEqual(equipped)
        const remaining = game.state.party.filter((member) =>
          game.queries
            .equipOptions(game.state, member)
            .some((entry) => entry.gear === gear.gear)
        )
        expect(remaining).not.toContain(eligible[0])
        if (remaining.length) {
          fireEvent.click(screen.getByRole("button", { name: "仲間に装備" }))
          const nextCards = [
            ...document.querySelectorAll<HTMLButtonElement>(
              ".formation .card .hit"
            ),
          ]
          expect(
            game.state.party.filter(
              (_member, index) => !nextCards[index].disabled
            )
          ).toEqual(remaining)
          const recipient = remaining[0]
          await act(async () =>
            fireEvent.click(nextCards[game.state.party.indexOf(recipient)])
          )
          eventsOrThrow(
            control.send({ type: "equip", gear: gear.gear, member: recipient })
          )
          expect(game.save()).toEqual(control.save())
          expect(
            game.state.gear.find((entry) => entry.id === gear.gear)!.owner
          ).toBe(recipient)
          expect(JSON.parse(storage.read()!)).toEqual(game.save())
          const transferred = game.save()
          await act(async () =>
            fireEvent.click(nextCards[game.state.party.indexOf(recipient)])
          )
          expect(game.save()).toEqual(transferred)
          expect(JSON.parse(storage.read()!)).toEqual(transferred)
        } else {
          expect(
            screen.queryByRole("button", { name: "仲間に装備" })
          ).toBeNull()
        }
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
