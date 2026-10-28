import { describe, expect, it } from "vite-plus/test"
import { WizVaultPlayerItemEffectService } from "@/lib/wiz/core/engine/inventory/wiz-vault-item-effect-service"
import { WizVaultPlayer } from "@/lib/wiz/core/vault/states/player/value"

function createPlayer(): WizVaultPlayer {
  return new WizVaultPlayer({
    name: "Test Hero",
    level: 1,
    exp: 0,
    expToNextLevel: 100,
    hp: 50,
    maxHp: 100,
    mp: 4,
    maxMp: 10,
    gold: 100,
    attributes: {
      strength: 10,
      dexterity: 5,
      agility: 8,
      vitality: 10,
      wisdom: 5,
      charisma: 5,
    },
    abilityIds: [],
    hunger: 50,
    ap: 5,
    maxAp: 5,
  })
}

describe("WizVaultPlayerItemEffectService", () => {
  it("applyをbindせず呼べ、実装を差し替えられない", () => {
    const service = new WizVaultPlayerItemEffectService()
    const { apply } = service

    const result = apply(createPlayer(), { type: "restore_mp", value: 1 })

    expect(result.applied).toBe(true)
    expect(Object.isFrozen(service)).toBe(true)
    expect(Object.isFrozen(WizVaultPlayerItemEffectService.prototype)).toBe(true)
    expect(Object.isFrozen(WizVaultPlayerItemEffectService)).toBe(true)

    const verifyReadonly = () => {
      const replacementApply = service.apply
      // @ts-expect-error applyはreadonly function property。
      service.apply = replacementApply
    }
    void verifyReadonly
  })

  it("restore_mp を WizVaultPlayer に適用して意味イベントを返す", () => {
    const player = createPlayer()
    const service = new WizVaultPlayerItemEffectService()

    const result = service.apply(player, { type: "restore_mp", value: 8 })

    expect(result.applied).toBe(true)
    if (!result.applied) return
    expect(player.mp).toBe(4)
    expect(result.target.mp).toBe(10)
    expect(result.events).toEqual([{ type: "mp_restored", amount: 6 }])
  })

  it.each([
    { type: "buff", stat: "attack", value: 5, duration: 3 } as const,
    { type: "cure" } as const,
    { type: "teleport", destination: "village" } as const,
    { type: "torch" } as const,
  ])("standard playerが表現できないeffectを消費成功にしない: %o", (effect) => {
    const player = createPlayer()
    const service = new WizVaultPlayerItemEffectService()

    const result = service.apply(player, effect)

    expect(result).toEqual({
      applied: false,
      target: player,
      rejection: {
        type: "unsupported_effect",
        effectType: effect.type,
        target: "standard_player",
      },
    })
  })
})
