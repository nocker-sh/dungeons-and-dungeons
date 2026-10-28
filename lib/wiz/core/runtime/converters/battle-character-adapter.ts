import { WizBattleCharacter } from "@/lib/wiz/core/engine/battle/actors/character"
import { WizEffectSet } from "@/lib/wiz/core/domain/values/effect-set"
import { WizBattleParty } from "@/lib/wiz/core/engine/battle/actors/party"
import {
  getWizRuntimeContentEntry,
  type WizRuntimeContentView,
} from "@/lib/wiz/core/runtime/content-view"
import { WizSceneBattleStatusConversionService } from "@/lib/wiz/core/runtime/converters/wiz-status-conversion-service"
import type { WizVaultObject } from "@/lib/wiz/core/vault/types"
import type {
  WizBattleStatusBase,
  WizBattleStatusCustom,
  WizDefaultBattleStatus,
} from "@/lib/wiz/core/types/wiz-types"

/**
 * 戦闘開始とsession復元が同じactor変換規則を共有するための読み取り専用port。
 */
export type WizSceneBattleCharacterAuthority<TStatus = unknown, TCustom = unknown> = {
  readonly actorsFromVault: (
    vault: WizVaultObject,
  ) => readonly WizBattleCharacter<TStatus, TCustom>[]
  readonly partyFromVault: (vault: WizVaultObject) => WizBattleParty<TStatus, TCustom>
}

const assertUniquePartyActorIds = (partyMembers: WizVaultObject["partyMembers"]): void => {
  const reservedIndex = partyMembers.findIndex((member) => member.id === "player")
  if (reservedIndex >= 0) {
    throw new RangeError(
      `partyMembers[${reservedIndex}].id cannot be "player"; the ID is reserved for the canonical player actor`,
    )
  }

  const duplicateIndex = partyMembers.findIndex(
    (member, index) => partyMembers.findIndex((candidate) => candidate.id === member.id) !== index,
  )
  if (duplicateIndex < 0) return
  const duplicateId = partyMembers[duplicateIndex].id
  const firstIndex = partyMembers.findIndex((member) => member.id === duplicateId)
  throw new RangeError(
    `Duplicate party actor ID "${duplicateId}" at partyMembers[${duplicateIndex}].id; first declared at partyMembers[${firstIndex}].id`,
  )
}

export class WizSceneBattleCharacterAdapter<
  TBattleStatus extends WizBattleStatusBase = WizDefaultBattleStatus,
> {
  private readonly statusService: WizSceneBattleStatusConversionService<TBattleStatus>
  private readonly content?: Pick<WizRuntimeContentView, "weapons" | "armors">

  constructor(
    statusService: WizSceneBattleStatusConversionService<TBattleStatus>,
    content?: Pick<WizRuntimeContentView, "weapons" | "armors">,
  ) {
    WizSceneBattleStatusConversionService.assertAuthentic(statusService)
    this.statusService = statusService
    this.content = content
    Object.freeze(this)
  }

  static createDefault(
    content?: Pick<WizRuntimeContentView, "weapons" | "armors">,
  ): WizSceneBattleCharacterAdapter<WizDefaultBattleStatus> {
    return new WizSceneBattleCharacterAdapter(
      WizSceneBattleStatusConversionService.createDefault(),
      content,
    )
  }

  fromPlayer(
    player: WizVaultObject["player"],
  ): WizBattleCharacter<WizBattleStatusCustom<TBattleStatus>> {
    const status = this.statusService.convert({
      hp: player.hp,
      maxHp: player.maxHp,
      mp: player.mp,
      maxMp: player.maxMp,
      strength: player.attributes.strength,
      vitality: player.attributes.vitality,
      agility: player.attributes.agility,
      wisdom: player.attributes.wisdom,
      customAttributes: player.customAttributes,
    })

    return new WizBattleCharacter({
      id: "player",
      name: player.name,
      custom: { abilityIds: [...player.abilityIds] },
      status,
      effects: WizEffectSet.create(),
    })
  }

  fromPartyMember(
    member: WizVaultObject["partyMembers"][number],
  ): WizBattleCharacter<WizBattleStatusCustom<TBattleStatus>> {
    const status = this.statusService.convert({
      hp: member.hp,
      maxHp: member.maxHp,
      mp: member.mp,
      maxMp: member.maxMp,
      strength: member.attributes.strength,
      vitality: member.attributes.vitality,
      agility: member.attributes.agility,
      wisdom: member.attributes.wisdom,
    })

    return new WizBattleCharacter({
      id: member.id,
      name: member.name,
      custom: { classId: member.classId, abilityIds: [...member.abilityIds] },
      status,
      effects: WizEffectSet.create(),
    })
  }

  partyFromVault(vault: WizVaultObject): WizBattleParty<WizBattleStatusCustom<TBattleStatus>> {
    const actors = this.actorsFromVault(vault)
    const livingMemberIds = new Set(
      vault.partyMembers.filter((member) => member.hp > 0).map((member) => member.id),
    )

    return new WizBattleParty({
      id: "party",
      members: actors.filter((actor) => actor.id === "player" || livingMemberIds.has(actor.id)),
    })
  }

  /**
   * 現在のvaultから、戦闘開始時と同じ変換規則・装備補正で全actorを再構築する。
   *
   * `partyFromVault`と異なり、戦闘中にHPが0になったmemberも復元時の照合対象にするため
   * 除外しない。
   */
  actorsFromVault(
    vault: WizVaultObject,
  ): readonly WizBattleCharacter<WizBattleStatusCustom<TBattleStatus>>[] {
    assertUniquePartyActorIds(vault.partyMembers)
    return Object.freeze([
      this.fromPlayerWithEquipment(vault),
      ...vault.partyMembers.map((member) => this.fromPartyMember(member)),
    ])
  }

  private fromPlayerWithEquipment(
    vault: WizVaultObject,
  ): WizBattleCharacter<WizBattleStatusCustom<TBattleStatus>> {
    let weaponAttackBonus = 0
    let weaponDexBonus = 0
    let armorDefenseBonus = 0
    let armorAgiPenalty = 0

    if (this.content) {
      for (const entryId of Object.values(vault.equipment)) {
        const equipped = vault.inventory.entries.find((entry) => entry.entryId === entryId)
        if (equipped?.contentType === "weapon") {
          const weapon = getWizRuntimeContentEntry(this.content.weapons, equipped.contentId)
          if (weapon) {
            weaponAttackBonus += weapon.attack
            weaponDexBonus += weapon.dexterityBonus ?? 0
          }
        }
        if (equipped?.contentType === "armor") {
          const armor = getWizRuntimeContentEntry(this.content.armors, equipped.contentId)
          if (armor) {
            armorDefenseBonus += armor.defense
            armorAgiPenalty += armor.agilityPenalty ?? 0
          }
        }
      }
    }

    const player = vault.player
    const status = this.statusService.convert({
      hp: player.hp,
      maxHp: player.maxHp,
      mp: player.mp,
      maxMp: player.maxMp,
      strength: player.attributes.strength,
      vitality: player.attributes.vitality,
      agility: player.attributes.agility + weaponDexBonus - armorAgiPenalty,
      wisdom: player.attributes.wisdom,
      customAttributes: player.customAttributes,
    })

    const adjustedStatus = status.withAttributes(
      status.attributes.add("attack", weaponAttackBonus).add("defense", armorDefenseBonus),
    )

    return new WizBattleCharacter({
      id: "player",
      name: player.name,
      custom: { abilityIds: [...player.abilityIds] },
      status: adjustedStatus,
      effects: WizEffectSet.create(),
    })
  }

  partyFromPlayer(
    player: WizVaultObject["player"],
  ): WizBattleParty<WizBattleStatusCustom<TBattleStatus>> {
    const wizCharacter = this.fromPlayer(player)

    return new WizBattleParty({
      id: "party",
      members: [wizCharacter],
    })
  }
}

Object.freeze(WizSceneBattleCharacterAdapter)
Object.freeze(WizSceneBattleCharacterAdapter.prototype)
