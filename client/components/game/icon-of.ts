import { goodIconKey } from "@/content/looks/good-icon-key"

export const LOOT_ICONS: Record<string, string> = {
  coin: `<svg viewBox="0 0 40 40"><path d="M20 3 L34 11 L34 29 L20 37 L6 29 L6 11Z" fill="#eeebe3"/><path d="M20 10 L27 14 L27 26 L20 30 L13 26 L13 14Z" fill="none" stroke="#0b0c12" stroke-width="3"/></svg>`,
  bone: `<svg viewBox="0 0 40 40"><path d="M8 6 L14 8 L16 14 L26 24 L32 26 L34 32 L28 34 L26 28 L16 18 L10 16 L8 10 L4 12 L6 6Z" fill="#eeebe3"/></svg>`,
  junk: `<svg viewBox="0 0 40 40"><path d="M6 30 L14 8 L22 14 L30 6 L34 20 L26 34 L12 36Z" fill="#eeebe3"/><path d="M14 18 L24 26 M20 12 L16 30" stroke="#0b0c12" stroke-width="3"/></svg>`,
  potion: `<svg viewBox="0 0 40 40"><path d="M15 3 H25 V12 L33 26 L28 37 H12 L7 26 L15 12Z" fill="#eeebe3"/><path d="M10 26 H30" stroke="#0b0c12" stroke-width="3"/></svg>`,
  hurt: `<svg viewBox="0 0 40 40"><path d="M4 34 L10 14 L14 26 L20 6 L26 26 L30 14 L36 34Z" fill="#eeebe3"/></svg>`,
  cinder: `<svg viewBox="0 0 40 40"><path d="M8 32 L12 16 L20 10 L30 14 L34 28 L24 36Z" fill="#eeebe3"/><path d="M14 22 L20 18 L26 24 L20 30Z" fill="#6b1723"/><path d="M12 16 L18 24 M30 14 L24 22" stroke="#0b0c12" stroke-width="2.5"/></svg>`,
  demon: `<svg viewBox="0 0 40 40"><path d="M6 4 L14 14 L26 14 L34 4 L32 20 L28 32 L20 37 L12 32 L8 20Z" fill="#eeebe3"/><path d="M12 20 L18 23 L12 25Z M28 20 L22 23 L28 25Z" fill="#6b1723"/><path d="M15 30 L20 27 L25 30" stroke="#0b0c12" stroke-width="2.5" fill="none"/></svg>`,
  crystal: `<svg viewBox="0 0 40 40"><path d="M20 3 L30 14 L24 37 L16 37 L10 14Z" fill="#eeebe3"/><path d="M20 3 L20 37 M10 14 L30 14" stroke="#0b0c12" stroke-width="2.5"/></svg>`,
  sword: `<svg viewBox="0 0 40 40"><path d="M30 4 L36 4 L36 10 L16 30 L10 24Z" fill="#eeebe3"/><path d="M8 22 L18 32 L14 34 L6 26Z M6 30 L10 34 L4 38 L2 36Z" fill="#eeebe3"/></svg>`,
  axe: `<svg viewBox="0 0 40 40"><path d="M8 36 L28 6 L31 8 L11 38Z" fill="#eeebe3"/><path d="M22 6 L36 2 L34 18 L26 14Z" fill="#eeebe3"/></svg>`,
  bow: `<svg viewBox="0 0 40 40"><path d="M10 4 L22 8 L30 20 L22 32 L10 36 L20 28 L24 20 L20 12Z" fill="#eeebe3"/><path d="M10 4 L10 36" stroke="#eeebe3" stroke-width="2"/><path d="M4 20 L34 20 L30 16 M34 20 L30 24" stroke="#eeebe3" stroke-width="3" fill="none"/></svg>`,
  staff: `<svg viewBox="0 0 40 40"><path d="M10 38 L26 10 L29 12 L13 40Z" fill="#eeebe3"/><path d="M26 2 L34 6 L34 14 L26 16 L20 12 L20 6Z" fill="#eeebe3"/></svg>`,
  ether: `<svg viewBox="0 0 40 40"><path d="M16 3 H24 V10 L30 18 L30 34 L10 34 L10 18 L16 10Z" fill="#eeebe3"/><path d="M14 22 L26 22 L20 30Z" fill="#0b0c12"/></svg>`,
  antidote: `<svg viewBox="0 0 40 40"><path d="M6 20 L20 4 L34 20 L20 36Z" fill="#eeebe3"/><path d="M14 20 H26 M20 14 V26" stroke="#0b0c12" stroke-width="4"/></svg>`,
  bomb: `<svg viewBox="0 0 40 40"><path d="M8 18 L18 10 L30 14 L34 26 L26 36 L12 34 L6 26Z" fill="#eeebe3"/><path d="M26 12 L32 4 L36 6" stroke="#eeebe3" stroke-width="3" fill="none"/></svg>`,
  smoke: `<svg viewBox="0 0 40 40"><path d="M4 26 L10 16 L18 18 L22 8 L32 12 L36 24 L28 34 L12 34Z" fill="#eeebe3"/></svg>`,
  rope: `<svg viewBox="0 0 40 40"><path d="M20 4 L34 12 L34 28 L20 36 L6 28 L6 12Z" fill="none" stroke="#eeebe3" stroke-width="5"/><path d="M20 12 L27 16 L27 24 L20 28 L13 24 L13 16Z" fill="none" stroke="#eeebe3" stroke-width="3"/></svg>`,
  torch: `<svg viewBox="0 0 40 40"><path d="M17 20 L23 20 L21 38 L19 38Z" fill="#eeebe3"/><path d="M20 2 L28 12 L24 20 L16 20 L12 12Z" fill="#eeebe3"/></svg>`,
  leather: `<svg viewBox="0 0 40 40"><path d="M12 4 L17 8 H23 L28 4 L36 10 L32 18 L30 16 V36 H10 V16 L8 18 L4 10Z" fill="#eeebe3"/><path d="M14 24 H26" stroke="#0b0c12" stroke-width="3"/></svg>`,
  mail: `<svg viewBox="0 0 40 40"><path d="M12 4 L17 8 H23 L28 4 L36 10 L32 18 L30 16 V36 H10 V16 L8 18 L4 10Z" fill="#eeebe3"/><path d="M13 18 L17 22 L21 18 L25 22 L28 19 M13 26 L17 30 L21 26 L25 30 L28 27" stroke="#0b0c12" stroke-width="2.4" fill="none"/></svg>`,
  shield: `<svg viewBox="0 0 40 40"><path d="M6 6 L20 2 L34 6 L32 24 L20 38 L8 24Z" fill="#eeebe3"/><path d="M20 8 V30 M11 15 H29" stroke="#0b0c12" stroke-width="3"/></svg>`,
  helm: `<svg viewBox="0 0 40 40"><path d="M6 36 L6 18 L12 6 L28 6 L34 18 L34 36Z" fill="#eeebe3"/><path d="M11 20 H29 M16 25 V31 M20 25 V31 M24 25 V31" stroke="#0b0c12" stroke-width="3"/></svg>`,
  robe: `<svg viewBox="0 0 40 40"><path d="M14 2 L26 2 L28 10 L36 38 L4 38 L12 10Z" fill="#eeebe3"/><path d="M20 10 L20 38 M16 20 L24 20" stroke="#0b0c12" stroke-width="2.4"/></svg>`,
}

/** 品物のアイコン。looks.json の別名・種類の既定を通して、手元のSVGから選ぶ。 */
export function iconOf(id: string, kind?: string) {
  return LOOT_ICONS[id] ?? LOOT_ICONS[goodIconKey(id, kind)] ?? LOOT_ICONS.junk
}
