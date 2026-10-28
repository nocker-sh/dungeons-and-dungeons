import { expect, test } from "vite-plus/test"
import { WizVaultMissingDefinitionError } from "@/lib/wiz/core/vault/factory/missing-definition-error"
import { WizVaultEventStateFactory } from "@/lib/wiz/core/vault/factory/event-state-factory"

const mockEvents = [
  {
    id: "event1",
    description: "A mysterious sound",
    choices: [
      {
        label: "Investigate",
        successText: "You found something!",
        failText: "Nothing happened.",
      },
    ],
  },
  {
    id: "event2",
    description: "A hidden path",
    choices: [],
  },
  {
    id: "event3",
    description: "Cave entrance",
    choices: [],
  },
]

test("get はイベントを ID で取得できる", () => {
  const factory = new WizVaultEventStateFactory({ defs: mockEvents })

  const event = factory.get("event1")

  expect(event).toBeDefined()
  expect(event?.description).toBe("A mysterious sound")
})

test("get は存在しない ID で undefined を返す", () => {
  const factory = new WizVaultEventStateFactory({ defs: mockEvents })

  const result = factory.get("nonexistent")

  expect(result).toBeUndefined()
})

test("getAll は全イベントの Record を返す", () => {
  const factory = new WizVaultEventStateFactory({ defs: mockEvents })

  const all = factory.getAll()

  expect(Object.keys(all)).toHaveLength(3)
})

test("getMany は指定した ID のイベント配列を返す", () => {
  const factory = new WizVaultEventStateFactory({ defs: mockEvents })

  const result = factory.getMany(["event1", "event3"])

  expect(result).toHaveLength(2)
})

test("getMany は存在しない ID を黙ってスキップせず全件報告する", () => {
  const factory = new WizVaultEventStateFactory({ defs: mockEvents })

  expect(() => factory.getMany(["event1", "missing-a", "missing-b"])).toThrow(
    WizVaultMissingDefinitionError,
  )

  try {
    factory.getMany(["missing-a", "missing-b"])
  } catch (error) {
    expect(error).toBeInstanceOf(WizVaultMissingDefinitionError)
    expect((error as WizVaultMissingDefinitionError).definitionKind).toBe("event")
    expect((error as WizVaultMissingDefinitionError).missingIds).toEqual(["missing-a", "missing-b"])
  }
})

test("廃止済み所属fieldを受理せず、所属areaを別authorityに持たせない", () => {
  const retiredEvent = {
    id: "retired",
    description: "Retired event",
    choices: [],
  }
  Object.defineProperty(retiredEvent, ["area", "Ids"].join(""), {
    enumerable: true,
    value: ["forest"],
  })

  expect(
    () =>
      new WizVaultEventStateFactory({
        defs: [retiredEvent],
      }),
  ).toThrow()
})

test("source と getter から変更できない owned graph と own-key record を返す", () => {
  const defs = [
    {
      id: "event1",
      description: "A mysterious sound",
      choices: [
        {
          label: "Investigate",
          successText: "You found something!",
          failText: "Nothing happened.",
          successReward: {
            items: [{ itemId: "herb", quantity: 1 }],
          },
        },
      ],
    },
  ]
  const factory = new WizVaultEventStateFactory({ defs })

  defs[0].description = "Changed"
  defs[0].choices[0].label = "Changed"
  defs[0].choices[0].successReward.items[0].quantity = 9

  const all = factory.getAll()
  const event = factory.get("event1")
  if (!event) {
    throw new Error("Expected event1")
  }
  const rewardItem = event.choices[0].successReward?.items?.[0]
  if (!rewardItem) {
    throw new Error("Expected reward item")
  }

  expect(Object.getPrototypeOf(all)).toBeNull()
  expect(Object.isFrozen(all)).toBe(true)
  expect(Object.isFrozen(event)).toBe(true)
  expect(Object.isFrozen(event.choices)).toBe(true)
  expect(Object.isFrozen(rewardItem)).toBe(true)
  expect(factory.get("toString")).toBeUndefined()
  expect(event.description).toBe("A mysterious sound")
  expect(event.choices[0].label).toBe("Investigate")
  expect(rewardItem.quantity).toBe(1)

  expect(Reflect.set(event, "description", "Changed through getter")).toBe(false)
  expect(Reflect.set(event.choices[0], "label", "Changed through getter")).toBe(false)
  expect(Reflect.set(rewardItem, "quantity", 9)).toBe(false)
  expect(Object.isFrozen(factory.getMany(["event1"]))).toBe(true)

  expect(factory.get("event1")?.description).toBe("A mysterious sound")
  expect(factory.get("event1")?.choices[0].label).toBe("Investigate")
  expect(factory.get("event1")?.choices[0].successReward?.items?.[0].quantity).toBe(1)
})
