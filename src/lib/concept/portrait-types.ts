export const portraitStates = [
  { value: "normal", label: "通常" },
  { value: "talk", label: "会話中" },
  { value: "happy", label: "喜び" },
  { value: "sigh", label: "ため息" },
  { value: "angry", label: "怒り" },
  { value: "surprised", label: "驚き" },
  { value: "surprisedLarge", label: "驚き（大）" },
  { value: "thinking", label: "考え中" },
  { value: "shy", label: "照れ" },
  { value: "special", label: "特殊モーション" },
  { value: "skill", label: "スキル発動" },
] as const
export type PortraitState = (typeof portraitStates)[number]["value"]
export type BustPortraitState = Exclude<PortraitState, "skill">
export type BustPortraitSlots = Record<
  "normal" | "talk" | "happy" | "sigh" | "angry",
  string | null
> &
  Partial<
    Record<
      "surprised" | "surprisedLarge" | "thinking" | "shy" | "special",
      string | null
    >
  >
export type PortraitSlots = {
  normal: string | null
  skill?: string | null
} & Partial<BustPortraitSlots>

export function resolvePortrait(
  slots: PortraitSlots,
  state: PortraitState,
  bustPortraits?: BustPortraitSlots
) {
  if (state === "special")
    return (
      bustPortraits?.special ||
      slots.special ||
      bustPortraits?.normal ||
      slots.normal ||
      undefined
    )
  return (
    (state !== "skill"
      ? bustPortraits?.[state] || bustPortraits?.normal
      : undefined) ||
    slots[state] ||
    slots.normal ||
    undefined
  )
}
