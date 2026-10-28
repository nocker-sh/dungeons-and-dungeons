import type { StatusKind } from "@/lib/wiz/content/constants"

/** 状態異常と強化の日本語。 */
export const STATUS_NAMES = {
  poison: "毒",
  bind: "縛り",
  charge: "溜め",
  protect: "守り",
  regen: "再生",
  taunt: "挑発",
} as const

/** 状態異常耐性の表示。丸めた割合だけで完全無効と判断しない。 */
export function statusResistanceView(kind: StatusKind, value: number) {
  const name = STATUS_NAMES[kind]
  const percent = Math.round(value * 100)
  const immune = value === 1
  return {
    kind,
    name,
    percent,
    immune,
    label: immune
      ? `${name}無効`
      : percent === 100
        ? `${name}100%未満`
        : `${name}${percent}%`,
  }
}
