import { FOE_ART } from "@/content/looks/combat-art"

/** 個体の識別子から同じ絵を引く。戦闘の乱数を消費せず、再開しても姿が変わらない。 */
export function foeAppearance(foe: string, appearanceId?: string) {
  const art = FOE_ART[foe]
  if (!art?.appearances?.length || !appearanceId) return art
  let hash = 0
  for (const character of appearanceId)
    hash = (Math.imul(hash, 31) + character.charCodeAt(0)) >>> 0
  const appearances = [art, ...art.appearances]
  return { ...appearances[hash % appearances.length], glow: art.glow }
}
