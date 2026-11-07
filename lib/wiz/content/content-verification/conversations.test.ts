import { HERO_REGISTERED_FLAG } from "@/lib/wiz/content/constants"
import { aState } from "@/lib/wiz/testing/state-builder"
import { testEnvironment } from "@/lib/wiz/testing/test-environment"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"
import { Bag } from "@/lib/wiz/rules/bag"
import { expect, it } from "vite-plus/test"
import { GameDefinition } from "@/lib/wiz/definition/game-definition"
import { realContent } from "@/lib/wiz/testing/real-content"

it("本番台本の要求と除外に同じフラグを置いたら起動時に拒否する", () => {
  const content = realContent()
  const definition = new GameDefinition(content)
  const target = definition.catalog.data.conversations!.find(
    (entry) => entry.excludes.length > 0
  )!
  const flag = target.excludes[0]
  const changed = {
    ...content,
    conversations: content.conversations!.map((entry) =>
      entry.id === target.id
        ? { ...entry, requires: [...(entry.requires ?? []), flag] }
        : entry
    ),
  }
  expect(() => new GameDefinition(changed)).toThrow(
    `会話 ${target.id} のフラグ ${flag} は要求と除外を同時に指定できない`
  )
  expect(() => new GameDefinition(content)).not.toThrow()
})

it("入口のない自己待ちと相互待ちの台本を起動時に拒否する", () => {
  const content = realContent()
  const template = new GameDefinition(content).catalog.data.conversations!.find(
    (entry) => entry.trigger === "talk"
  )!
  for (const scripts of [
    [
      {
        ...template,
        id: "test-self-wait",
        requires: ["test:self"],
        excludes: [],
        sets: ["test:self"],
        choice: undefined,
      },
    ],
    [
      {
        ...template,
        id: "test-wait-a",
        requires: ["test:b"],
        excludes: [],
        sets: ["test:a"],
        choice: undefined,
      },
      {
        ...template,
        id: "test-wait-b",
        requires: ["test:a"],
        excludes: [],
        sets: ["test:b"],
        choice: undefined,
      },
    ],
  ])
    expect(
      () =>
        new GameDefinition({
          ...content,
          conversations: [...content.conversations!, ...scripts],
        })
    ).toThrow("要求フラグへ到達できない")
})

it("別の入口がある循環と、選択肢から立つフラグの後続は拒否しない", () => {
  const content = realContent()
  const template = new GameDefinition(content).catalog.data.conversations!.find(
    (entry) => entry.trigger === "talk"
  )!
  const scripts = [
    {
      ...template,
      id: "test-entry",
      requires: [],
      excludes: [],
      sets: ["test:a"],
      choice: undefined,
    },
    {
      ...template,
      id: "test-after-a",
      requires: ["test:a"],
      excludes: [],
      sets: ["test:b"],
      choice: undefined,
    },
    {
      ...template,
      id: "test-after-b",
      requires: ["test:b"],
      excludes: [],
      sets: ["test:a"],
      choice: undefined,
    },
    {
      ...template,
      id: "test-choice-entry",
      requires: [],
      excludes: [],
      sets: [],
      choice: {
        ask: "どちら",
        options: [
          { label: "はい", lines: template.lines, sets: ["test:choice"] },
          { label: "いいえ", lines: template.lines, sets: [] },
        ],
      },
    },
    {
      ...template,
      id: "test-after-choice",
      requires: ["test:choice"],
      excludes: [],
      sets: [],
      choice: undefined,
    },
  ]
  for (const ordered of [scripts, [...scripts].reverse()])
    expect(
      () =>
        new GameDefinition({
          ...content,
          conversations: [...content.conversations!, ...ordered],
        })
    ).not.toThrow()
})

it("エンジンの登録と実在する契約書による呼び出しの印を入口として認める", () => {
  const content = realContent()
  const definition = new GameDefinition(content)
  const template = definition.catalog.data.conversations!.find(
    (entry) => entry.trigger === "talk"
  )!
  const demon = content.demons.find((entry) => entry.contract?.paper)!
  const script = {
    ...template,
    id: "test-after-invocation",
    requires: [HERO_REGISTERED_FLAG, `demon-called:${demon.id}`],
    excludes: [],
    sets: [],
    choice: undefined,
  }
  expect(
    () =>
      new GameDefinition({
        ...content,
        conversations: [...content.conversations!, script],
      })
  ).not.toThrow()
})

it("存在しない悪魔の呼び出しをフラグの入口にしない", () => {
  const content = realContent()
  const template = new GameDefinition(content).catalog.data.conversations!.find(
    (entry) => entry.trigger === "talk"
  )!
  const script = {
    ...template,
    id: "test-unknown-invocation",
    requires: ["demon-called:missing-demon"],
    excludes: [],
    sets: [],
    choice: undefined,
  }
  expect(
    () =>
      new GameDefinition({
        ...content,
        conversations: [...content.conversations!, script],
      })
  ).toThrow("を立てる会話がない")
})

it("呼び出し条件の印は実際の契約書の消費で立ち、保存再開と再会話で二重に消費しない", () => {
  const content = realContent()
  const base = new GameDefinition(content)
  const stock = new Map<string, number>()
  for (const demon of content.demons)
    if (demon.contract?.paper)
      stock.set(
        demon.contract.paper,
        (stock.get(demon.contract.paper) ?? 0) + 2
      )
  // Reached layer and supplies are local initial conditions; invocation flags are not injected.
  const initial = {
    ...aState(base.catalog)
      .withBag([...stock].map(([good, count]) => ({ good, count })))
      .build(),
    reached: content.layers.length - 1,
  }
  const candidate = base
    .create(testEnvironment(), initial)
    .queries.demonContracts(initial)
    .find((entry) => entry.canInvoke)!
  expect(candidate).toBeDefined()
  const demon = base.catalog.demon(candidate.id)!
  const marker = `demon-called:${demon.id}`
  const definition = new GameDefinition({
    ...content,
    conversations: content.conversations!.map((entry) =>
      entry.id === demon.contract!.encounter
        ? { ...entry, requires: [...(entry.requires ?? []), marker] }
        : entry
    ),
  })
  const game = definition.create(testEnvironment(), initial)
  eventsOrThrow(game.send({ type: "invoke-demon", demon: demon.id }))
  expect(game.state.conversation?.active).toBe(demon.contract!.encounter)
  expect(game.state.conversation?.flags).toContain(marker)
  expect(Bag.count(game.state.bag, demon.contract!.paper!)).toBe(
    Bag.count(initial.bag, demon.contract!.paper!) - 1
  )
  const snapshot = game.save()
  const resumed = definition.create(testEnvironment(), initial)
  expect(resumed.restore(JSON.parse(JSON.stringify(snapshot)))).toBeUndefined()
  expect(resumed.state).toEqual(game.state)
  const active = resumed.queries.activeConversation(resumed.state)!
  eventsOrThrow(
    resumed.send({
      type: "finish-conversation",
      ...(active.choice ? { choice: 0 } : {}),
    })
  )
  const before = resumed.state
  eventsOrThrow(resumed.send({ type: "invoke-demon", demon: demon.id }))
  expect(resumed.state.bag).toEqual(before.bag)
  expect(resumed.state.gold).toBe(before.gold)
  expect(resumed.state.stones).toBe(before.stones)
  expect(
    resumed.state.conversation?.flags?.filter((flag) => flag === marker)
  ).toEqual([marker])
})
