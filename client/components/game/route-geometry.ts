export type Geometry = {
  sp: number
  off: number
  anchor: number
  nodeS: number
  bossS: number
  startS: number
  vh: number
}

export function geometry(wide: boolean, vw: number, vh: number): Geometry {
  const sp = wide ? Math.max(190, Math.min(vw * 0.26, vh * 0.46)) : vw * 0.33
  return {
    sp,
    off: sp * (wide ? 0.4 : 0.55),
    anchor: wide ? vw * 0.3 : vw * 0.5 - sp,
    nodeS: wide ? vh * 0.2 : sp * 0.7,
    bossS: wide ? vh * 0.27 : sp * 0.9,
    startS: wide ? vh * 0.13 : sp * 0.48,
    vh,
  }
}
