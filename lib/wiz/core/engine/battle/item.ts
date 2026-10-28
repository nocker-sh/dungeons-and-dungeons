import { WizItemWithEffect } from "@/lib/wiz/core/domain/values/item"
import type { WizItemEffectDefinition } from "@/lib/wiz/core/types/item-effect"

export type WizBattleItemEffect = Extract<
  WizItemEffectDefinition,
  {
    readonly type: "heal" | "restore_mp" | "revive" | "cure" | "buff" | "damage"
  }
>

export type WizBattleItem<TCustom = unknown> = WizItemWithEffect<
  string,
  WizBattleItemEffect,
  TCustom
>
