// @vitest-environment jsdom
import { isInaccessible } from "@testing-library/dom"
import { act, cleanup, fireEvent, render } from "@testing-library/react"
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
import { fullRun } from "@/tests/full-run"

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
// 組み立て器は呼ぶたびに新しい組み立て器を返し、元の状態を書き換えない。街の開始状態は一度だけ作って使い回す。
const started = aState(definition.catalog)
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

/** 読み上げる名前の元になる文字。aria-label を優先し、aria-hidden・hidden の子孫は読み上げないので含めない。 */
function spokenText(node: Node): string {
  if (node instanceof Text) return node.data
  if (!(node instanceof Element)) return ""
  if (
    node.getAttribute("aria-hidden") === "true" ||
    node.hasAttribute("hidden")
  )
    return ""
  return (
    node.getAttribute("aria-label")?.trim() ||
    [...node.childNodes].map(spokenText).join("")
  )
}
/**
 * 名前の合うボタン。getByRole("button", { name }) と同じく、前後の空白を除いて続く空白を一つにまとめた名前で比べ、
 * 読み上げから外れたボタン（isInaccessible）は数えない。getByRole は全ボタンの名前を計算済みスタイルから求めて重いので、
 * 名前は属性と文字で比べ、スタイルは名前の合ったボタンだけで調べる。
 */
function buttonsNamed(name: string) {
  return [
    ...document.querySelectorAll("button:not([role]), [role=button]"),
  ].filter(
    (element) =>
      spokenText(element).trim().replace(/\s\s+/g, " ") === name &&
      !isInaccessible(element)
  )
}
/** ちょうど一つあるボタン（getByRole と同じ）。 */
function button(name: string) {
  const found = buttonsNamed(name)
  expect(found, name).toHaveLength(1)
  return found[0]
}
/** そのボタンが一つもない（queryByRole が null になるのと同じ）。 */
function noButton(name: string) {
  expect(buttonsNamed(name), name).toEqual([])
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
type Scene = (typeof scenes)[number]

const items = definition.catalog.data.goods.filter(
  (entry) => entry.kind === "item"
)
type Item = (typeof items)[number]
type ItemCase = { scene: Scene; good: Item }
const itemCases: readonly ItemCase[] = scenes.flatMap((scene) =>
  items.map((good) => ({ scene, good }))
)
const allyItems = definition.catalog.data.goods.filter(
  (good) =>
    good.kind === "item" &&
    good.effect &&
    usableInField(good.effect) &&
    effectSpec(good.effect).target === "ally"
)
const staleCases: readonly ItemCase[] = scenes.flatMap((scene) =>
  allyItems.map((good) => ({ scene, good }))
)
const gearGoods = definition.catalog.data.goods.filter(
  (good) => good.kind === "weapon" || good.kind === "armor"
)
type GearGood = (typeof gearGoods)[number]
const scenarios = ["town", "expedition", "restored-town"] as const
type GearCase = { scenario: (typeof scenarios)[number]; good: GearGood }
const gearCases: readonly GearCase[] = scenarios.flatMap((scenario) =>
  gearGoods.map((good) => ({ scenario, good }))
)

/*
 * ふだんの `vp test run` で回す代表。全件（場面・状況 × 品物）は `vp run test:full` で回す。
 * - 道具：街と探索中は全品を回す。発見・宝箱・罠・戦利品の板が出ている場面は、どの板でも同じ使い方
 *   （PendingPhase.use → Use）を通り、画面も BagSurface に置き換わるので、袋の分岐（袋から使えない・
 *   仲間を一人選ぶ・選ばずに使う）ごとに品を板へ順に割り振る。どの板も全分岐を通り、どの品もどれかの板で確かめる。
 * - 復元前の選択：選んだときの状態で古い選択を断る同じ仕組みなので、仲間を選ぶ品を場面へ順に割り振る。
 *   どの品もどの場面も一度は回る。
 * - 装備：復元後の街では全装備を回す（着けられる仲間がいれば品ごとの比較の文も作って着せ替える）。
 *   街の手順をすべて通したうえで読み直しと古い選択の拒否を足した手順なので、読み直しのない街の手順も含む。
 *   読み直しのない街と探索中（変更できない）は、装備できる仲間が分かれる分類ごとに、作品データの並びで
 *   最初の一品を確かめる。
 * 分岐と分類は作品データから作るので、新しい対象・部位・職業の組み合わせが増えれば代表にも入る。
 */

/** 場所と品を順に組にする。少ない側を繰り返し、どの場所もどの品も一度は組になる。 */
function pairs<Place, Thing>(
  places: readonly Place[],
  things: readonly Thing[]
): { place: Place; thing: Thing }[] {
  if (!places.length || !things.length) return []
  return Array.from(
    { length: Math.max(places.length, things.length) },
    (_, index) => ({
      place: places[index % places.length],
      thing: things[index % things.length],
    })
  )
}
const caseKey = (scene: Scene, good: Item) => `${scene.name}/${good.id}`
/** 袋の操作が分かれる先。袋から使えない・仲間を一人選ぶ（ally）・選ばずに使う（allies など対象の種類）。 */
function bagBranch(good: Item) {
  return good.effect && usableInField(good.effect)
    ? effectSpec(good.effect).target
    : "bag-only"
}
/** 装備できる仲間と入れ替わる装備が分かれる分類。種類・部位・装備できる職業（武器種は装備できる仲間を変えない）。 */
function gearClass(good: GearGood) {
  return JSON.stringify([
    good.kind,
    good.slot ?? null,
    good.allowedJobs?.toSorted() ?? null,
  ])
}
function representativeItems(all: readonly ItemCase[]) {
  const boards = [...new Set(all.map((entry) => entry.scene))].filter(
    (scene) => scene.pending
  )
  const goods = [...new Set(all.map((entry) => entry.good))]
  const picks = new Set(
    [...new Set(goods.map(bagBranch))].flatMap((branch) =>
      pairs(
        boards,
        goods.filter((good) => bagBranch(good) === branch)
      ).map((pair) => caseKey(pair.place, pair.thing))
    )
  )
  return all.filter(
    (entry) =>
      !entry.scene.pending || picks.has(caseKey(entry.scene, entry.good))
  )
}
function representativeStale(all: readonly ItemCase[]) {
  const picks = new Set(
    pairs(
      [...new Set(all.map((entry) => entry.scene))],
      [...new Set(all.map((entry) => entry.good))]
    ).map((pair) => caseKey(pair.place, pair.thing))
  )
  return all.filter((entry) => picks.has(caseKey(entry.scene, entry.good)))
}
function representativeGear(all: readonly GearCase[]) {
  const firsts = new Map<string, GearGood>()
  for (const entry of all)
    if (!firsts.has(gearClass(entry.good)))
      firsts.set(gearClass(entry.good), entry.good)
  const picked = new Set(firsts.values())
  return all.filter(
    (entry) => entry.scenario === "restored-town" || picked.has(entry.good)
  )
}
const selectedItems = fullRun ? itemCases : representativeItems(itemCases)
const selectedStale = fullRun ? staleCases : representativeStale(staleCases)
const selectedGear = fullRun ? gearCases : representativeGear(gearCases)

test("ふだん回す代表は、袋の分岐・場面・装備の分類をすべて含む", () => {
  // 道具：袋から使えない品・仲間を一人選ぶ品・選ばずに使う品がそろい、街と探索中は全品、どの板も全分岐を通る
  const branches = new Set(items.map(bagBranch))
  expect([...branches]).toEqual(expect.arrayContaining(["bag-only", "ally"]))
  expect(branches.size).toBeGreaterThan(2)
  const itemSlice = representativeItems(itemCases)
  for (const scene of scenes) {
    const goods = itemSlice
      .filter((entry) => entry.scene === scene)
      .map((entry) => entry.good)
    if (scene.pending)
      expect(new Set(goods.map(bagBranch)), scene.name).toEqual(branches)
    else expect(goods, scene.name).toEqual(items)
  }
  expect(
    new Set(
      itemSlice
        .filter((entry) => entry.scene.pending)
        .map((entry) => entry.good)
    )
  ).toEqual(new Set(items))
  // 復元前の選択：仲間を選ぶ品も場面も、どれも一度は回る
  const staleSlice = representativeStale(staleCases)
  expect(allyItems.length).toBeGreaterThan(0)
  expect(new Set(staleSlice.map((entry) => entry.good))).toEqual(
    new Set(allyItems)
  )
  expect(new Set(staleSlice.map((entry) => entry.scene))).toEqual(
    new Set(scenes)
  )
  // 装備：武器も防具もあり、復元後の街は全品、読み直しのない街と探索中は分類ごとにちょうど一品
  expect(new Set(gearGoods.map((good) => good.kind))).toEqual(
    new Set(["weapon", "armor"])
  )
  const gearSlice = representativeGear(gearCases)
  const classes = [...new Set(gearGoods.map(gearClass))]
  for (const scenario of scenarios) {
    const goods = gearSlice
      .filter((entry) => entry.scenario === scenario)
      .map((entry) => entry.good)
    if (scenario === "restored-town") expect(goods, scenario).toEqual(gearGoods)
    else expect(goods.map(gearClass), scenario).toEqual(classes)
  }
})

for (const scene of scenes)
  test.each(
    selectedItems
      .filter((entry) => entry.scene === scene)
      .map((entry) => entry.good)
  )(
    `${scene.name}: actual bag controls and autosave agree with native use for $id`,
    async (good) => {
      if (!good.effect) throw new Error(`${good.id}: missing item effect`)
      // Possessions, injury, spent uses and the pending result are local starting conditions.
      const builder = started
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
        fireEvent.click(button(item.name))
        const before = game.save()
        if (!item.field) {
          noButton("使う")
          expect(game.save()).toEqual(before)
          expect(storage.read()).toBeNull()
          return
        }
        // 比べる相手のゲームは、袋から使える品と分かってから同じ初期状態で作る
        const control = definition.create(testEnvironment(), initial)
        expect(item.usable).toBe(true)
        fireEvent.click(button("使う"))
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
              button("やめる")
            }
          }
          fireEvent.click(button("やめる"))
          noButton("やめる")
          expect(game.save()).toEqual(before)
          expect(storage.read()).toBeNull()
          fireEvent.click(button("使う"))
          const chosen = document.querySelectorAll<HTMLButtonElement>(
            ".formation .card .hit"
          )[game.state.party.indexOf(item.targets[0])]
          await act(async () => fireEvent.click(chosen))
          noButton("やめる")
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
    selectedStale
      .filter((entry) => entry.scene === scene)
      .map((entry) => entry.good)
  )(
    `${scene.name}: a target selected before restoring cannot consume $id in the restored game`,
    async (good) => {
      if (!good.effect) throw new Error(`${good.id}: missing effect`)
      const builder = started
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
        fireEvent.click(button(item.name))
        fireEvent.click(button("使う"))
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
        noButton("やめる")
        fireEvent.click(button("使う"))
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

for (const scenario of scenarios)
  test.each(
    selectedGear
      .filter((entry) => entry.scenario === scenario)
      .map((entry) => entry.good)
  )(
    `${scenario}: real bag equipment selection and autosave agree with native equip for $id`,
    async (good) => {
      const phase = scenario === "expedition" ? "expedition" : "town"
      // One unowned item and its wear/upgrade are local possessions, not an acquisition playthrough.
      const builder = started.withGear([]).withEquipped("alda", good.id, {
        owner: null,
        plus: 2,
        wear: good.kind === "armor" ? 7 : 0,
      })
      const initial = (
        phase === "town" ? builder : builder.inExpedition()
      ).build()
      const game = definition.create(testEnvironment(), initial)
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
        fireEvent.click(button("装備"))
        fireEvent.click(button(gear.name))
        const before = game.save()
        if (!eligible.length) {
          noButton("仲間に装備")
          expect(game.save()).toEqual(before)
          expect(storage.read()).toBeNull()
          return
        }
        // 比べる相手のゲームは、着けられる仲間がいると分かってから同じ初期状態で作る
        const control = definition.create(testEnvironment(), initial)
        fireEvent.click(button("仲間に装備"))
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
            button("やめる")
          }
        }
        fireEvent.click(button("やめる"))
        noButton("やめる")
        expect(game.save()).toEqual(before)
        expect(storage.read()).toBeNull()
        fireEvent.click(button("仲間に装備"))
        if (scenario === "restored-town") {
          const saved = game.save()
          await act(async () => {
            expect(game.restore(saved)).toBeUndefined()
          })
          expect(control.restore(saved)).toBeUndefined()
          const restored = game.save()
          const bytes = storage.read()
          const oldChoice = document.querySelectorAll<HTMLButtonElement>(
            ".formation .card .hit"
          )[game.state.party.indexOf(eligible[0])]
          await act(async () => fireEvent.click(oldChoice))
          expect(game.save()).toEqual(restored)
          expect(storage.read()).toBe(bytes)
          noButton("やめる")
          fireEvent.click(button("仲間に装備"))
        }
        const chosen = document.querySelectorAll<HTMLButtonElement>(
          ".formation .card .hit"
        )[game.state.party.indexOf(eligible[0])]
        await act(async () => fireEvent.click(chosen))
        noButton("やめる")
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
          fireEvent.click(button("仲間に装備"))
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
          noButton("仲間に装備")
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
