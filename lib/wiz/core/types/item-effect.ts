export const WIZ_ITEM_EFFECT_TYPE = Object.freeze({
  buff: "buff",
  cure: "cure",
  damage: "damage",
  escape: "escape",
  food: "food",
  fuel: "fuel",
  heal: "heal",
  poison: "poison",
  restoreMp: "restore_mp",
  revive: "revive",
  teleport: "teleport",
  torch: "torch",
  trap: "trap",
  unlock: "unlock",
} as const)

export type WizItemEffectType = (typeof WIZ_ITEM_EFFECT_TYPE)[keyof typeof WIZ_ITEM_EFFECT_TYPE]

/**
 * content、inventory、battleが共有するprovider-neutralなitem effect定義。
 */
export type WizItemEffectDefinition =
  | Readonly<{ type: typeof WIZ_ITEM_EFFECT_TYPE.heal; value: number }>
  | Readonly<{ type: typeof WIZ_ITEM_EFFECT_TYPE.restoreMp; value: number }>
  | Readonly<{
      type: typeof WIZ_ITEM_EFFECT_TYPE.food
      hungerRestore: number
      healValue?: number
    }>
  | Readonly<{ type: typeof WIZ_ITEM_EFFECT_TYPE.revive; value?: number }>
  | Readonly<{ type: typeof WIZ_ITEM_EFFECT_TYPE.cure; effectId?: string }>
  | Readonly<{
      type: typeof WIZ_ITEM_EFFECT_TYPE.buff
      stat: string
      value: number
      duration: number
    }>
  | Readonly<{
      type: typeof WIZ_ITEM_EFFECT_TYPE.damage
      value: number
      element?: string
    }>
  | Readonly<{ type: typeof WIZ_ITEM_EFFECT_TYPE.poison; value?: number }>
  | Readonly<{ type: typeof WIZ_ITEM_EFFECT_TYPE.trap; value?: number }>
  | Readonly<{ type: typeof WIZ_ITEM_EFFECT_TYPE.torch }>
  | Readonly<{ type: typeof WIZ_ITEM_EFFECT_TYPE.fuel; value?: number }>
  | Readonly<{ type: typeof WIZ_ITEM_EFFECT_TYPE.escape }>
  | Readonly<{
      type: typeof WIZ_ITEM_EFFECT_TYPE.teleport
      targetId?: string
      destination?: string
    }>
  | Readonly<{ type: typeof WIZ_ITEM_EFFECT_TYPE.unlock; targetId?: string }>
