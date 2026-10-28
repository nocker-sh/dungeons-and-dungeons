import { places, tuning, lines } from "@/content/looks/data"

/** 層の背景・光・案内人の説明。 */
export function layerLook(id: string): {
  art?: string
  glow?: string
  line: string
} {
  const look = tuning.layers[id] ?? {}
  return {
    art: (look.scene && places.get(look.scene)?.image) || undefined,
    glow: look.glow,
    line: lines.layers[id] ?? lines.guide.far,
  }
}
