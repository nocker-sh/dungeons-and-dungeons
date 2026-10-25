export abstract class WizError extends Error {
  abstract readonly type: string

  constructor(message?: string) {
    super(message ?? "")
    this.name = this.constructor.name
  }
}

export class WizInsufficientGoldError extends WizError {
  readonly type = "insufficient_gold" as const
  constructor(
    readonly required: number,
    readonly actual: number,
  ) {
    super(`Insufficient gold: required ${required}, actual ${actual}`)
  }
}

export class WizInsufficientApError extends WizError {
  readonly type = "insufficient_ap" as const
  constructor(
    readonly required: number,
    readonly actual: number,
  ) {
    super(`Insufficient AP: required ${required}, actual ${actual}`)
  }
}

export class WizInsufficientMpError extends WizError {
  readonly type = "insufficient_mp" as const
  constructor(
    readonly actorId: string,
    readonly required: number,
    readonly actual: number,
  ) {
    super(`Insufficient MP for ${actorId}: required ${required}, actual ${actual}`)
  }
}

export class WizInsufficientQuantityError extends WizError {
  readonly type = "insufficient_quantity" as const
  constructor(
    readonly itemId: string,
    readonly required: number,
    readonly actual: number,
  ) {
    super(`Insufficient quantity for ${itemId}: required ${required}, actual ${actual}`)
  }
}

export class WizEntityNotFoundError extends WizError {
  readonly type = "entity_not_found" as const
  constructor(
    readonly entityType: string,
    readonly entityId: string,
  ) {
    super(`${entityType} not found: ${entityId}`)
  }
}

export class WizItemNotFoundError extends WizError {
  readonly type = "item_not_found" as const
  constructor(readonly itemId: string) {
    super(`Item not found: ${itemId}`)
  }
}

export class WizNpcNotFoundError extends WizError {
  readonly type = "npc_not_found" as const
  constructor(readonly npcId: string) {
    super(`NPC not found: ${npcId}`)
  }
}

export class WizQuestNotFoundError extends WizError {
  readonly type = "quest_not_found" as const
  constructor(readonly questId: string) {
    super(`Quest not found: ${questId}`)
  }
}

export class WizAreaNotFoundError extends WizError {
  readonly type = "area_not_found" as const
  constructor(readonly areaId: string) {
    super(`Area not found: ${areaId}`)
  }
}

export class WizProductNotFoundError extends WizError {
  readonly type = "product_not_found" as const
  constructor(readonly productId: string) {
    super(`Product not found: ${productId}`)
  }
}

export class WizPlanNotFoundError extends WizError {
  readonly type = "plan_not_found" as const
  constructor(readonly planId: string) {
    super(`Plan not found: ${planId}`)
  }
}

export class WizTargetNotFoundError extends WizError {
  readonly type = "target_not_found" as const
  constructor(readonly targetId: string) {
    super(`Target not found: ${targetId}`)
  }
}

export class WizCharacterNotFoundError extends WizError {
  readonly type = "character_not_found" as const
  constructor(readonly characterId: string) {
    super(`Character not found: ${characterId}`)
  }
}

export class WizMonsterNotFoundError extends WizError {
  readonly type = "monster_not_found" as const
  constructor(readonly monsterId: string) {
    super(`Monster not found: ${monsterId}`)
  }
}

export class WizMonsterGroupNotFoundError extends WizError {
  readonly type = "monster_group_not_found" as const
  constructor(readonly groupId: string) {
    super(`Monster group not found: ${groupId}`)
  }
}

export class WizActionNotFoundError extends WizError {
  readonly type = "action_not_found" as const
  constructor(readonly actionId: string) {
    super(`Action not found: ${actionId}`)
  }
}

export class WizSlotFullError extends WizError {
  readonly type = "slot_full" as const
  constructor(readonly maxSlots: number) {
    super(`Slot full: max ${maxSlots}`)
  }
}

export class WizOutOfStockError extends WizError {
  readonly type = "out_of_stock" as const
  constructor(readonly productId: string) {
    super(`Out of stock: ${productId}`)
  }
}

export class WizSlotEmptyError extends WizError {
  readonly type = "slot_empty" as const
  constructor(readonly slot: string) {
    super(`Slot empty: ${slot}`)
  }
}

export class WizAlreadyAcceptedError extends WizError {
  readonly type = "already_accepted" as const
  constructor(readonly questId: string) {
    super(`Quest already accepted: ${questId}`)
  }
}

export class WizAlreadyCompletedError extends WizError {
  readonly type = "already_completed" as const
  constructor(readonly questId: string) {
    super(`Quest already completed: ${questId}`)
  }
}

export class WizAlreadyFullError extends WizError {
  readonly type = "already_full" as const
  constructor(readonly resource: "hp" | "mp" | "ap") {
    super(`Resource already full: ${resource}`)
  }
}

export class WizNotInConversationError extends WizError {
  readonly type = "not_in_conversation" as const
  constructor() {
    super("Not in conversation")
  }
}

export class WizNotInBattleError extends WizError {
  readonly type = "not_in_battle" as const
  constructor() {
    super("Not in battle")
  }
}

export class WizBattleEndedError extends WizError {
  readonly type = "battle_ended" as const
  constructor() {
    super("Battle has already ended")
  }
}

export class WizActionAlreadySetError extends WizError {
  readonly type = "action_already_set" as const
  constructor(readonly actorId: string) {
    super(`Action already set for actor: ${actorId}`)
  }
}

export class WizRequirementsNotMetError extends WizError {
  readonly type = "requirements_not_met" as const
  constructor(readonly reason: string) {
    super(reason)
  }
}

export class WizObjectivesIncompleteError extends WizError {
  readonly type = "objectives_incomplete" as const
  constructor(readonly questId: string) {
    super(`Objectives incomplete for quest: ${questId}`)
  }
}

export class WizInvalidChoiceError extends WizError {
  readonly type = "invalid_choice" as const
  constructor(readonly choiceIndex: number) {
    super(`Invalid choice: ${choiceIndex}`)
  }
}

export class WizInvalidEquipmentError extends WizError {
  readonly type = "invalid_equipment" as const
  constructor(readonly reason: string) {
    super(reason)
  }
}

export class WizCannotSellError extends WizError {
  readonly type = "cannot_sell" as const
  constructor(readonly reason: string) {
    super(reason)
  }
}

export class WizNoDialogueError extends WizError {
  readonly type = "no_dialogue" as const
  constructor(readonly npcId: string) {
    super(`No dialogue available for NPC: ${npcId}`)
  }
}

export class WizNoEventActiveError extends WizError {
  readonly type = "no_event_active" as const
  constructor() {
    super("No event active")
  }
}

export class WizNoValidActionError extends WizError {
  readonly type = "no_valid_action" as const
  constructor() {
    super("No valid action available")
  }
}

export class WizActorCannotActError extends WizError {
  readonly type = "actor_cannot_act" as const
  constructor(readonly actorId: string) {
    super(`Actor cannot act: ${actorId}`)
  }
}

export class WizSilencedActorError extends WizError {
  readonly type = "silenced_actor" as const
  constructor(readonly actorId: string) {
    super(`Actor is silenced and cannot use abilities: ${actorId}`)
  }
}

export class WizInvalidTargetError extends WizError {
  readonly type = "invalid_target" as const
  constructor(readonly targetId: string) {
    super(`Invalid target: ${targetId}`)
  }
}

export class WizInvalidSceneTransitionError extends WizError {
  readonly type = "invalid_phase_transition" as const
  constructor(
    readonly currentScene: string,
    readonly attemptedScene: string,
  ) {
    super(`Invalid phase transition from ${currentScene} to ${attemptedScene}`)
  }
}

export class WizNoActionsAvailableError extends WizError {
  readonly type = "no_actions_available" as const
  constructor() {
    super("No actions available to execute")
  }
}

export class WizInvalidValueError extends WizError {
  readonly type = "invalid_value" as const
  constructor(
    readonly fieldName: string,
    readonly value: unknown,
    readonly reason: string,
  ) {
    super(`Invalid value for ${fieldName}: ${String(value)} (${reason})`)
  }
}

export class WizEmptyPartyError extends WizError {
  readonly type = "empty_party" as const
  constructor() {
    super("Party cannot be empty")
  }
}

export class WizEmptyEnemyPartyError extends WizError {
  readonly type = "empty_enemy_party" as const
  constructor() {
    super("Enemy party cannot be empty")
  }
}

export type WizAssetType = "item" | "weapon" | "armor" | "recipe"

export class WizAssetNotFoundError extends WizError {
  readonly type = "asset_not_found" as const
  constructor(
    readonly assetType: WizAssetType,
    readonly assetId: string,
  ) {
    super(`Asset not found: ${assetType} "${assetId}"`)
  }
}
