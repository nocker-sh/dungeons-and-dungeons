import {
  WIZ_IMMUTABLE_VALUE,
  WizImmutableValue,
} from "@/lib/wiz/core/immutable-value"
import type { WizDeepReadonly } from "@/lib/wiz/core/immutable-value"
import {
  WizEquipmentLoadout,
  WizInventory,
  WizInventoryEntry,
} from "@/lib/wiz/core/domain/values/inventory"
import { WizObjectService } from "@/lib/wiz/core/services/wiz-object-service"
import type { WizLogMessage } from "@/lib/wiz/core/types/wiz-log-message"
import { parseWizVaultObject } from "@/lib/wiz/core/vault/schema"
import type { WizVaultAreaState } from "@/lib/wiz/core/vault/states/area/schema"
import type { WizVaultNpc } from "@/lib/wiz/core/vault/states/npc/type"
import type {
  WizVaultPartyMemberState,
  WizVaultPlayerState,
} from "@/lib/wiz/core/vault/states/player/schema"
import { WizVaultPlayer } from "@/lib/wiz/core/vault/states/player/value"
import type { WizVaultQuestState } from "@/lib/wiz/core/vault/states/quest/schema"
import type { WizVaultTimeState } from "@/lib/wiz/core/vault/states/time/schema"
import { WizStandardInventoryStateSchema } from "@/lib/wiz/core/vault/standard-inventory"
import type {
  WizStandardInventoryContentType,
  WizVaultObject,
} from "@/lib/wiz/core/vault/types"

const objectService = new WizObjectService()
const vaultValueConstructionToken = Symbol("WizVaultValue.constructor")
const authenticVaultValues = new WeakSet<object>()

type WizStandardInventoryEntry = WizInventoryEntry<
  string,
  WizStandardInventoryContentType,
  string,
  unknown
>

/** Immutable world state snapshot. Supports JSON serialization via toPlain/fromPlain. */
export class WizVaultValue {
  declare readonly [WIZ_IMMUTABLE_VALUE]: true
  readonly #properties: WizVaultObject

  private constructor(
    token: typeof vaultValueConstructionToken,
    properties: WizVaultObject
  ) {
    if (token !== vaultValueConstructionToken) {
      throw new TypeError(
        "WizVaultValue must be created with WizVaultValue.fromPlain()"
      )
    }
    this.#properties = objectService.ownImmutable(properties)
    authenticVaultValues.add(this)
    WizImmutableValue.freeze(this)
  }

  static fromPlain(plain: unknown): WizVaultValue {
    return new WizVaultValue(
      vaultValueConstructionToken,
      parseWizVaultObject(plain)
    )
  }

  /** @internal runtime ownership boundaries only. */
  static assertAuthentic(value: unknown): asserts value is WizVaultValue {
    if (
      typeof value !== "object" ||
      value === null ||
      !authenticVaultValues.has(value)
    ) {
      throw new TypeError("Vault must be an authentic WizVaultValue")
    }
  }

  private with(properties: WizVaultObject): WizVaultValue {
    WizVaultValue.assertAuthentic(this)
    return WizVaultValue.fromPlain(properties)
  }

  get player() {
    return new WizVaultPlayer(this.#properties.player)
  }

  get inventory(): WizInventory<WizStandardInventoryEntry> {
    return WizInventory.fromUnknown<
      string,
      WizStandardInventoryContentType,
      string,
      unknown
    >(this.#properties.inventory, WizStandardInventoryStateSchema)
  }

  get equipment(): WizEquipmentLoadout<string, string> {
    return WizEquipmentLoadout.fromUnknown(
      this.inventory,
      Object.keys(this.#properties.equipment),
      this.#properties.equipment
    )
  }

  get time() {
    return this.#properties.time
  }

  get areas() {
    return this.#properties.areas
  }

  get npcs() {
    return this.#properties.npcs
  }

  get quests() {
    return this.#properties.quests
  }

  get flags() {
    return this.#properties.flags
  }

  get log(): readonly WizLogMessage[] {
    return this.#properties.log
  }

  get unlockedFacilities() {
    return this.#properties.unlockedFacilities
  }

  get isEnded() {
    return this.#properties.isEnded
  }

  get partyMembers() {
    return this.#properties.partyMembers
  }

  withPlayer(player: WizVaultPlayer | WizVaultPlayerState) {
    const plainPlayer =
      player instanceof WizVaultPlayer ? player.toPlain() : player
    return this.with({
      ...this.#properties,
      player: plainPlayer,
    })
  }

  withInventory(inventory: WizInventory<WizStandardInventoryEntry>) {
    WizInventory.assertAuthentic(inventory)
    return this.with({
      ...this.#properties,
      inventory: inventory.toPlain(),
    })
  }

  withEquipment(equipment: WizEquipmentLoadout<string, string>) {
    WizEquipmentLoadout.assertAuthentic(equipment)
    return this.with({
      ...this.#properties,
      equipment: equipment.toPlain(),
    })
  }

  equippedAt(slotId: string) {
    return this.#properties.equipment[slotId] ?? null
  }

  withTime(time: WizVaultTimeState) {
    return this.with({
      ...this.#properties,
      time,
    })
  }

  withAreas(areas: readonly WizDeepReadonly<WizVaultAreaState>[]) {
    return this.with({
      ...this.#properties,
      areas,
    })
  }

  withNpcs(npcs: readonly WizDeepReadonly<WizVaultNpc>[]) {
    return this.with({
      ...this.#properties,
      npcs,
    })
  }

  withQuests(quests: readonly WizDeepReadonly<WizVaultQuestState>[]) {
    return this.with({
      ...this.#properties,
      quests,
    })
  }

  withFlags(flags: readonly string[]) {
    return this.with({
      ...this.#properties,
      flags,
    })
  }

  withUnlockedFacilities(facilities: readonly string[]) {
    return this.with({
      ...this.#properties,
      unlockedFacilities: facilities,
    })
  }

  unlockFacility(facilityId: string) {
    if (this.#properties.unlockedFacilities.includes(facilityId)) {
      return this
    }
    return this.with({
      ...this.#properties,
      unlockedFacilities: [...this.#properties.unlockedFacilities, facilityId],
    })
  }

  hasFacility(facilityId: string) {
    return this.#properties.unlockedFacilities.includes(facilityId)
  }

  withLog(log: readonly WizLogMessage[]) {
    return this.with({
      ...this.#properties,
      log,
    })
  }

  withEnded(isEnded: boolean) {
    return this.with({
      ...this.#properties,
      isEnded,
    })
  }

  withPartyMembers(
    partyMembers: readonly WizDeepReadonly<WizVaultPartyMemberState>[]
  ) {
    return this.with({
      ...this.#properties,
      partyMembers,
    })
  }

  updatePlayer(fn: (p: WizVaultPlayer) => WizVaultPlayer) {
    return this.with({
      ...this.#properties,
      player: fn(new WizVaultPlayer(this.#properties.player)).toPlain(),
    })
  }

  updateInventory(
    update: (
      inventory: WizInventory<WizStandardInventoryEntry>
    ) => WizInventory<WizStandardInventoryEntry>
  ) {
    const inventory = update(this.inventory)
    WizInventory.assertAuthentic(inventory)
    return this.with({
      ...this.#properties,
      inventory: inventory.toPlain(),
    })
  }

  updateEquipment(
    update: (
      equipment: WizEquipmentLoadout<string, string>
    ) => WizEquipmentLoadout<string, string>
  ) {
    const equipment = update(this.equipment)
    WizEquipmentLoadout.assertAuthentic(equipment)
    return this.with({
      ...this.#properties,
      equipment: equipment.toPlain(),
    })
  }

  updateNpc(
    npcId: string,
    fn: (npc: WizDeepReadonly<WizVaultNpc>) => WizDeepReadonly<WizVaultNpc>
  ) {
    return this.with({
      ...this.#properties,
      npcs: this.#properties.npcs.map((n) => (n.id === npcId ? fn(n) : n)),
    })
  }

  updateQuest(
    questId: string,
    fn: (
      quest: WizDeepReadonly<WizVaultQuestState>
    ) => WizDeepReadonly<WizVaultQuestState>
  ) {
    return this.with({
      ...this.#properties,
      quests: this.#properties.quests.map((q) =>
        q.id === questId ? fn(q) : q
      ),
    })
  }

  updateArea(
    areaId: string,
    fn: (
      area: WizDeepReadonly<WizVaultAreaState>
    ) => WizDeepReadonly<WizVaultAreaState>
  ) {
    return this.with({
      ...this.#properties,
      areas: this.#properties.areas.map((a) => (a.id === areaId ? fn(a) : a)),
    })
  }

  incrementAreaProgress(areaId: string, delta: number) {
    if (!Number.isFinite(delta) || delta < 0) {
      throw new RangeError(
        "incrementAreaProgress delta must be a non-negative finite number"
      )
    }
    return this.with({
      ...this.#properties,
      areas: this.#properties.areas.map((a) =>
        a.id === areaId
          ? { ...a, progress: Math.min(100, a.progress + delta) }
          : a
      ),
    })
  }

  addFlag(flag: string) {
    if (this.#properties.flags.includes(flag)) {
      return this
    }
    return this.with({
      ...this.#properties,
      flags: [...this.#properties.flags, flag],
    })
  }

  removeFlag(flag: string) {
    return this.with({
      ...this.#properties,
      flags: this.#properties.flags.filter((f) => f !== flag),
    })
  }

  hasFlag(flag: string) {
    return this.#properties.flags.includes(flag)
  }

  addLog(message: WizLogMessage): WizVaultValue {
    const newLog = [...this.#properties.log, message]
    const trimmedLog = newLog.length > 50 ? newLog.slice(-50) : newLog
    return this.with({
      ...this.#properties,
      log: trimmedLog,
    })
  }

  findNpc(npcId: string) {
    return this.#properties.npcs.find((n) => n.id === npcId)
  }

  findQuest(questId: string) {
    return this.#properties.quests.find((q) => q.id === questId)
  }

  findArea(areaId: string) {
    return this.#properties.areas.find((a) => a.id === areaId)
  }

  updateQuestProgressDefeat(monsterId: string): WizVaultValue {
    return this.#properties.quests.reduce<WizVaultValue>((vault, quest) => {
      if (!quest.accepted || quest.completed) return vault
      if (quest.objective.type !== "defeat") return vault
      if (quest.objective.monsterId !== monsterId) return vault

      const newCurrent = Math.min(
        quest.objective.current + 1,
        quest.objective.count
      )
      return vault.updateQuest(quest.id, (currentQuest) => ({
        ...currentQuest,
        objective: { ...currentQuest.objective, current: newCurrent },
      }))
    }, this)
  }

  updateQuestProgressGather(itemId: string): WizVaultValue {
    const itemCount = this.inventory.totalQuantity("item", itemId)
    return this.#properties.quests.reduce<WizVaultValue>((vault, quest) => {
      if (!quest.accepted || quest.completed) return vault
      if (quest.objective.type !== "gather") return vault
      if (quest.objective.itemId !== itemId) return vault

      const current = Math.min(itemCount, quest.objective.count)
      return vault.updateQuest(quest.id, (currentQuest) => ({
        ...currentQuest,
        objective: { ...currentQuest.objective, current },
      }))
    }, this)
  }

  /** @internal Use `WizStandardSceneWorld.snapshot()` at the stable boundary. */
  toPlain() {
    return this.#properties
  }
}

Object.freeze(WizVaultValue.prototype)
Object.freeze(WizVaultValue)
