import {
  type WizItemEffectEvent,
  type WizItemEffectApplicationService,
  type WizItemEffectResult,
  WizItemEffectService,
  type WizItemEffectTargetAdapter,
} from "@/lib/wiz/core/domain/services/item-effect-service"
import type { WizItemEffectDefinition } from "@/lib/wiz/core/types/item-effect"
import { WizVaultPlayer } from "@/lib/wiz/core/vault/states/player/value"

const WIZ_VAULT_PLAYER_ITEM_EFFECT_TARGET_ADAPTER: WizItemEffectTargetAdapter<WizVaultPlayer> =
  Object.freeze({
    inspect: (player) =>
      Object.freeze({
        hp: player.hp,
        maxHp: player.maxHp,
        mp: player.mp,
        maxMp: player.maxMp,
        hunger: player.hunger,
        maxHunger: 100,
        defeated: player.isDead(),
      }),
    applyEvent: (player, event) => applyEvent(player, event),
  })

/**
 * Applies locale-independent item effects to the standard immutable player
 * value. Applications with another character model can configure
 * `WizItemEffectService` with their own target adapter instead.
 */
export class WizVaultPlayerItemEffectService implements WizItemEffectApplicationService<WizVaultPlayer> {
  private readonly service: WizItemEffectService<WizVaultPlayer>

  constructor() {
    this.service = new WizItemEffectService(WIZ_VAULT_PLAYER_ITEM_EFFECT_TARGET_ADAPTER)
    Object.freeze(this)
  }

  readonly apply = (
    target: WizVaultPlayer,
    effect: WizItemEffectDefinition | undefined,
  ): WizItemEffectResult<WizVaultPlayer> => {
    if (effect && !isStandardPlayerEffect(effect)) {
      return Object.freeze({
        applied: false,
        target,
        rejection: Object.freeze({
          type: "unsupported_effect",
          effectType: effect.type,
          target: "standard_player",
        }),
      })
    }
    return this.service.apply(target, effect)
  }
}

Object.freeze(WizVaultPlayerItemEffectService.prototype)
Object.freeze(WizVaultPlayerItemEffectService)

const isStandardPlayerEffect = (
  effect: WizItemEffectDefinition,
): effect is Extract<
  WizItemEffectDefinition,
  { type: "heal" | "restore_mp" | "food" | "revive" }
> =>
  effect.type === "heal" ||
  effect.type === "restore_mp" ||
  effect.type === "food" ||
  effect.type === "revive"

function applyEvent(player: WizVaultPlayer, event: WizItemEffectEvent): WizVaultPlayer {
  switch (event.type) {
    case "hp_restored":
      return player.heal(event.amount)
    case "mp_restored":
      return player.restoreMp(event.amount)
    case "hunger_restored":
      return player.addHunger(event.amount)
    case "revived":
      return player.withHp(event.hp)
    case "temporary_stat_increased":
    case "status_cured":
    case "teleport_requested":
    case "light_activated":
    case "poison_requested":
    case "trap_requested":
    case "fuel_requested":
    case "unlock_requested":
      return player
  }
}
