import type { WizBattleEnemyParty } from "@/lib/wiz/core/engine/battle/actors/enemy-party"
import type { WizBattleParty } from "@/lib/wiz/core/engine/battle/actors/party"
import { createBattleEffect } from "@/lib/wiz/core/engine/battle/effects"
import { WizEngineBattleExecutionResult } from "@/lib/wiz/core/engine/battle/execution/execution-result"
import {
  getBattleItemBuff,
  getBattleItemReviveRatio,
  type WizBattleItem,
} from "@/lib/wiz/core/engine/battle/item"
import { WizIdGenerator, type WizIdSource } from "@/lib/wiz/core/services/wiz-id-generator"
import { WizBattleLog, type WizLogMessage } from "@/lib/wiz/core/types/wiz-log-message"

type Properties = {
  readonly idGenerator?: WizIdSource
}

export class WizEngineBattleItemExecutor<TStatus = unknown, TCustom = unknown> {
  private readonly idGenerator: WizIdSource

  constructor(properties: Properties = {}) {
    this.idGenerator = properties.idGenerator ?? new WizIdGenerator()
    Object.freeze(this)
  }

  execute(
    item: WizBattleItem,
    actorId: string,
    targetIds: readonly string[],
    party: WizBattleParty<TStatus>,
    enemies: WizBattleEnemyParty<TStatus, TCustom>,
  ): WizEngineBattleExecutionResult<TStatus, TCustom> {
    const firstTargetId = targetIds[0]
    const firstTarget =
      firstTargetId === undefined
        ? undefined
        : (party.getMemberById(firstTargetId) ?? enemies.getMonsterById(firstTargetId))
    if (!party.getMemberById(actorId) || !firstTargetId || !firstTarget) {
      return WizEngineBattleExecutionResult.reject({
        party,
        enemies,
        reason: "BATTLE_ACTION_REJECTED",
      })
    }

    const result = this.executeEffect(item, targetIds, party, enemies)
    if (!result.accepted) return result
    return WizEngineBattleExecutionResult.accept({
      party: result.party,
      enemies: result.enemies,
      logs: [WizBattleLog.item(actorId, item.id, firstTargetId), ...result.logs],
      success: true,
    })
  }

  private executeEffect(
    item: WizBattleItem,
    targetIds: readonly string[],
    party: WizBattleParty<TStatus>,
    enemies: WizBattleEnemyParty<TStatus, TCustom>,
  ): WizEngineBattleExecutionResult<TStatus, TCustom> {
    switch (item.effect.type) {
      case "heal":
        return this.executeHeal(item.effect.value, targetIds, party, enemies)
      case "restore_mp":
        return this.executeRestoreMana(item.effect.value, targetIds, party, enemies)
      case "cure":
        return this.executeCure(item, targetIds, party, enemies, item.effect.effectId)
      case "buff":
        return this.executeBuff(item, targetIds, party, enemies)
      case "damage":
        return this.executeDamage(item.effect.value, targetIds, party, enemies)
      case "revive":
        return this.executeRevive(item, targetIds, party, enemies)
    }
  }

  private executeHeal(
    amount: number,
    targetIds: readonly string[],
    party: WizBattleParty<TStatus>,
    enemies: WizBattleEnemyParty<TStatus, TCustom>,
  ): WizEngineBattleExecutionResult<TStatus, TCustom> {
    const logs: WizLogMessage[] = []
    let currentParty = party
    for (const targetId of targetIds) {
      if (currentParty.getMemberById(targetId)) {
        currentParty = currentParty.withHealToMember(targetId, amount)
        logs.push(WizBattleLog.heal(targetId, amount))
      }
    }
    return WizEngineBattleExecutionResult.accept({
      party: currentParty,
      enemies,
      logs,
      success: true,
    })
  }

  private executeRestoreMana(
    amount: number,
    targetIds: readonly string[],
    party: WizBattleParty<TStatus>,
    enemies: WizBattleEnemyParty<TStatus, TCustom>,
  ): WizEngineBattleExecutionResult<TStatus, TCustom> {
    const logs: WizLogMessage[] = []
    let currentParty = party
    for (const targetId of targetIds) {
      const member = currentParty.getMemberById(targetId)
      if (member) {
        currentParty = currentParty.withMember(member.withMpRestore(amount))
        logs.push(WizBattleLog.heal(targetId, amount))
      }
    }
    return WizEngineBattleExecutionResult.accept({
      party: currentParty,
      enemies,
      logs,
      success: true,
    })
  }

  private executeCure(
    item: WizBattleItem,
    targetIds: readonly string[],
    party: WizBattleParty<TStatus>,
    enemies: WizBattleEnemyParty<TStatus, TCustom>,
    effectId: string | undefined,
  ): WizEngineBattleExecutionResult<TStatus, TCustom> {
    const logs: WizLogMessage[] = []
    let currentParty = party
    for (const targetId of targetIds) {
      const member = currentParty.getMemberById(targetId)
      if (!member) continue
      if (effectId === undefined) {
        currentParty = currentParty.withMember(member.clearEffects())
        logs.push(WizBattleLog.effectsRemoved(targetId, WizBattleLog.removeAllEffects()))
        continue
      }
      const matchingEffects = member.effects.effects.filter(
        (effect) => effect.effectId === effectId,
      )
      if (matchingEffects.length === 0) continue
      const curedMember = matchingEffects.reduce(
        (current, effect) => current.withoutEffect(effect.instanceId),
        member,
      )
      currentParty = currentParty.withMember(curedMember)
      logs.push(
        WizBattleLog.effectsRemoved(
          targetId,
          WizBattleLog.removeEffect(WizBattleLog.itemEffect(item.id, effectId)),
        ),
      )
    }
    return WizEngineBattleExecutionResult.accept({
      party: currentParty,
      enemies,
      logs,
      success: true,
    })
  }

  private executeBuff(
    item: WizBattleItem,
    targetIds: readonly string[],
    party: WizBattleParty<TStatus>,
    enemies: WizBattleEnemyParty<TStatus, TCustom>,
  ): WizEngineBattleExecutionResult<TStatus, TCustom> {
    const buff = getBattleItemBuff(item)
    if (buff === undefined) {
      return WizEngineBattleExecutionResult.reject({
        party,
        enemies,
        reason: "BATTLE_ACTION_REJECTED",
      })
    }

    const logs: WizLogMessage[] = []
    let currentParty = party
    for (const targetId of targetIds) {
      if (!currentParty.getMemberById(targetId)) continue
      const effect = createBattleEffect({
        instanceId: `${item.id}-buff-${targetId}-${this.idGenerator.next()}`,
        effectId: buff.effectId,
        source: { kind: "item", id: item.id },
        name: item.name,
        lifetime: { type: "turns", remaining: buff.duration },
        power: buff.power,
        modifier: buff.modifier,
        custom: item.custom,
      })
      currentParty = currentParty.withEffectToMember(targetId, effect)
      logs.push(
        WizBattleLog.effectApplied(targetId, WizBattleLog.itemEffect(item.id, buff.effectId)),
      )
    }
    return WizEngineBattleExecutionResult.accept({
      party: currentParty,
      enemies,
      logs,
      success: true,
    })
  }

  private executeDamage(
    amount: number,
    targetIds: readonly string[],
    party: WizBattleParty<TStatus>,
    enemies: WizBattleEnemyParty<TStatus, TCustom>,
  ): WizEngineBattleExecutionResult<TStatus, TCustom> {
    const logs: WizLogMessage[] = []
    let currentEnemies = enemies
    for (const targetId of targetIds) {
      if (!currentEnemies.getMonsterById(targetId)) continue
      currentEnemies = currentEnemies.withDamageToMonster(targetId, amount)
      logs.push(WizBattleLog.damage(targetId, amount))
      if (currentEnemies.getMonsterById(targetId)?.isDead()) {
        logs.push(WizBattleLog.death(targetId))
      }
    }
    return WizEngineBattleExecutionResult.accept({
      party,
      enemies: currentEnemies,
      logs,
      success: true,
    })
  }

  private executeRevive(
    item: WizBattleItem,
    targetIds: readonly string[],
    party: WizBattleParty<TStatus>,
    enemies: WizBattleEnemyParty<TStatus, TCustom>,
  ): WizEngineBattleExecutionResult<TStatus, TCustom> {
    const ratio = getBattleItemReviveRatio(item)
    if (ratio === undefined) {
      return WizEngineBattleExecutionResult.reject({
        party,
        enemies,
        reason: "BATTLE_ACTION_REJECTED",
      })
    }
    const logs: WizLogMessage[] = []
    let currentParty = party
    for (const targetId of targetIds) {
      const member = currentParty.getMemberById(targetId)
      if (!member?.isDead()) continue
      currentParty = currentParty.withReviveMember(targetId, ratio)
      logs.push(
        WizBattleLog.heal(
          targetId,
          Math.max(1, Math.floor(member.status.resources.maximum("health") * ratio)),
        ),
      )
    }
    return WizEngineBattleExecutionResult.accept({
      party: currentParty,
      enemies,
      logs,
      success: true,
    })
  }
}
