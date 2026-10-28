import { z } from "zod"
import type { WizDeepReadonly } from "@/lib/wiz/core/immutable-value"
import { WizObjectService } from "@/lib/wiz/core/services/wiz-object-service"
import type { WizAttributes } from "@/lib/wiz/core/types"
import {
  addWizVaultUpperBoundIssue,
  zWizVaultFiniteNumber,
  zWizVaultNonBlankString,
  zWizVaultNonnegativeNumber,
  zWizVaultPositiveInteger,
  zWizVaultPositiveNumber,
  zWizVaultSemanticId,
} from "@/lib/wiz/core/vault/states/schema-values"

const playerStateOwnership = new WizObjectService()

// Attributes schema - base character abilities
export const WizVaultAttributesSchema = z.strictObject({
  strength: zWizVaultFiniteNumber,
  dexterity: zWizVaultFiniteNumber,
  agility: zWizVaultFiniteNumber,
  vitality: zWizVaultFiniteNumber,
  wisdom: zWizVaultFiniteNumber,
  charisma: zWizVaultFiniteNumber,
})

// Party member state
export const WizVaultPartyMemberStateSchema = z
  .strictObject({
    id: zWizVaultSemanticId.refine(
      (id) => id !== "player",
      'partyMembers id "player" is reserved for the canonical player actor'
    ),
    name: zWizVaultNonBlankString,
    classId: zWizVaultSemanticId,
    level: zWizVaultPositiveInteger,
    hp: zWizVaultNonnegativeNumber,
    maxHp: zWizVaultNonnegativeNumber,
    mp: zWizVaultNonnegativeNumber,
    maxMp: zWizVaultNonnegativeNumber,
    attributes: WizVaultAttributesSchema,
    abilityIds: z.array(zWizVaultSemanticId),
  })
  .superRefine((member, context) => {
    addWizVaultUpperBoundIssue(
      context,
      ["hp"],
      "hp",
      member.hp,
      "maxHp",
      member.maxHp
    )
    addWizVaultUpperBoundIssue(
      context,
      ["mp"],
      "mp",
      member.mp,
      "maxMp",
      member.maxMp
    )
  })

export type WizVaultPartyMemberState = WizDeepReadonly<
  z.infer<typeof WizVaultPartyMemberStateSchema>
>

// Player state - abilities are ID references only
export const WizVaultPlayerStateSchema = z
  .strictObject({
    name: zWizVaultNonBlankString,
    level: zWizVaultPositiveInteger,
    exp: zWizVaultNonnegativeNumber,
    expToNextLevel: zWizVaultPositiveNumber,
    hp: zWizVaultNonnegativeNumber,
    maxHp: zWizVaultNonnegativeNumber,
    mp: zWizVaultNonnegativeNumber.optional(),
    maxMp: zWizVaultNonnegativeNumber.optional(),
    hunger: zWizVaultNonnegativeNumber.max(100),
    ap: zWizVaultNonnegativeNumber,
    maxAp: zWizVaultNonnegativeNumber,
    gold: zWizVaultNonnegativeNumber,
    attributes: WizVaultAttributesSchema,
    /**
     * 任意の追加属性 (luck, perception, faith など)。
     * 既存の固定 6 属性は `attributes` に残し、独自属性のみここに置く。
     * `WizVaultPlayer.getCustomAttribute / withCustomAttribute / addCustomAttribute` で操作する。
     */
    customAttributes: z
      .record(zWizVaultSemanticId, zWizVaultFiniteNumber)
      .optional(),
    abilityIds: z.array(zWizVaultSemanticId),
  })
  .superRefine((player, context) => {
    addWizVaultUpperBoundIssue(
      context,
      ["hp"],
      "hp",
      player.hp,
      "maxHp",
      player.maxHp
    )
    addWizVaultUpperBoundIssue(
      context,
      ["ap"],
      "ap",
      player.ap,
      "maxAp",
      player.maxAp
    )

    const hasMp = player.mp !== undefined
    const hasMaxMp = player.maxMp !== undefined
    if (hasMp !== hasMaxMp) {
      context.addIssue({
        code: "custom",
        path: [hasMp ? "maxMp" : "mp"],
        message: "mp and maxMp must either both be present or both be omitted",
      })
      return
    }
    if (player.mp !== undefined && player.maxMp !== undefined) {
      addWizVaultUpperBoundIssue(
        context,
        ["mp"],
        "mp",
        player.mp,
        "maxMp",
        player.maxMp
      )
    }
  })

export type WizVaultPlayerState = WizDeepReadonly<
  z.infer<typeof WizVaultPlayerStateSchema>
>

export const WIZ_VAULT_DEFAULT_ATTRIBUTES: WizDeepReadonly<WizAttributes> =
  playerStateOwnership.ownImmutable({
    strength: 5,
    dexterity: 5,
    agility: 5,
    vitality: 5,
    wisdom: 5,
    charisma: 5,
  })

export const WIZ_VAULT_DEFAULT_PLAYER: WizVaultPlayerState =
  playerStateOwnership.ownImmutable({
    name: "冒険者",
    level: 1,
    exp: 0,
    expToNextLevel: 50,
    hp: 50,
    maxHp: 50,
    mp: 25,
    maxMp: 25,
    hunger: 100,
    ap: 5,
    maxAp: 5,
    gold: 100,
    attributes: WIZ_VAULT_DEFAULT_ATTRIBUTES,
    abilityIds: [],
  })

export const WIZ_VAULT_DEFAULT_PARTY_MEMBERS: readonly WizVaultPartyMemberState[] =
  playerStateOwnership.ownImmutable([
    {
      id: "elena",
      name: "エレナ",
      classId: "healer",
      level: 1,
      hp: 35,
      maxHp: 35,
      mp: 30,
      maxMp: 30,
      attributes: {
        strength: 3,
        dexterity: 4,
        agility: 4,
        vitality: 4,
        wisdom: 8,
        charisma: 6,
      },
      abilityIds: ["heal"],
    },
    {
      id: "gareth",
      name: "ガレス",
      classId: "warrior",
      level: 1,
      hp: 60,
      maxHp: 60,
      mp: 10,
      maxMp: 10,
      attributes: {
        strength: 8,
        dexterity: 5,
        agility: 4,
        vitality: 7,
        wisdom: 2,
        charisma: 3,
      },
      abilityIds: ["powerStrike"],
    },
  ] satisfies readonly WizVaultPartyMemberState[])
