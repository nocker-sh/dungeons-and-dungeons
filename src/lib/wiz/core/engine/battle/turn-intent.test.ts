import { describe, expect, it } from "vite-plus/test"
import {
  materializeWizEngineBattleTurnIntent,
  WizEngineBattleTurnIntent,
} from "@/lib/wiz/core/engine/battle/turn-intent"

describe("WizEngineBattleTurnIntent", () => {
  const verifyNonEmptyTargetTypes = () => {
    // @ts-expect-error skillのtargetIdsは空tupleを受け付けない。
    WizEngineBattleTurnIntent.ability("player", "fire", [])
    // @ts-expect-error itemのtargetIdsは空tupleを受け付けない。
    WizEngineBattleTurnIntent.item("player", "potion", [])
  }

  void verifyNonEmptyTargetTypes

  it("公開factoryだけが真正intentを生成し、literal型をmaterializeまで維持する", () => {
    const intent = WizEngineBattleTurnIntent.ability("player", "fire", [
      "slime-1",
      "slime-2",
    ] as const)

    expect(() => WizEngineBattleTurnIntent.assertAuthentic(intent)).not.toThrow()
    expect(intent).toMatchObject({
      type: "ability",
      actorId: "player",
      abilityId: "fire",
      targetIds: ["slime-1", "slime-2"],
    })
    expect(materializeWizEngineBattleTurnIntent(intent, "action-1").toProperties()).toMatchObject({
      id: "action-1",
      type: "ability",
      actorId: "player",
      abilityId: "fire",
      targetIds: ["slime-1", "slime-2"],
    })
  })

  it("全factoryがmaterialize可能なintentだけを生成する", () => {
    const intents = [
      WizEngineBattleTurnIntent.attack("player", "slime"),
      WizEngineBattleTurnIntent.defend("player"),
      WizEngineBattleTurnIntent.flee("player"),
      WizEngineBattleTurnIntent.ability("player", "fire", ["slime"]),
      WizEngineBattleTurnIntent.item("player", "potion", ["player"]),
    ]

    for (const [index, intent] of intents.entries()) {
      expect(() => materializeWizEngineBattleTurnIntent(intent, `action-${index}`)).not.toThrow()
    }
  })

  it("wide target arrayも生成時にcanonical action制約で検証する", () => {
    const emptyTargets: string[] = []
    const duplicateTargets: string[] = ["slime", "slime"]

    expect(() => WizEngineBattleTurnIntent.ability("player", "fire", emptyTargets)).toThrow()
    expect(() => WizEngineBattleTurnIntent.item("player", "potion", duplicateTargets)).toThrow()
    expect(() => WizEngineBattleTurnIntent.attack(" ", "slime")).toThrow()
    expect(() => WizEngineBattleTurnIntent.defend("")).toThrow()
    expect(() => WizEngineBattleTurnIntent.flee(" player ")).toThrow()
  })

  it("prototype偽装とconstructor直接呼び出しを拒否する", () => {
    const forged = Object.create(WizEngineBattleTurnIntent.prototype)

    expect(() => WizEngineBattleTurnIntent.assertAuthentic(forged)).toThrow(
      "Battle turn intent must be created by WizEngineBattleTurnIntent factories",
    )
    expect(() => materializeWizEngineBattleTurnIntent(forged, "forged-action")).toThrow(
      "Battle turn intent must be created by WizEngineBattleTurnIntent factories",
    )
    expect(() =>
      Reflect.construct(WizEngineBattleTurnIntent, [
        Symbol("forged"),
        {
          type: "attack",
          actorId: "player",
          targetIds: ["slime"],
          abilityId: null,
          itemId: null,
        },
      ]),
    ).toThrow(
      "WizEngineBattleTurnIntent must be created with attack(), defend(), flee(), ability(), or item()",
    )
  })

  it("class・prototype・factory instanceを固定する", () => {
    const intent = WizEngineBattleTurnIntent.attack("player", "slime")

    expect(Object.isFrozen(WizEngineBattleTurnIntent)).toBe(true)
    expect(Object.isFrozen(WizEngineBattleTurnIntent.prototype)).toBe(true)
    expect(Object.isFrozen(intent)).toBe(true)
    expect(Reflect.set(WizEngineBattleTurnIntent.prototype, "type", "forged")).toBe(false)
  })
})
