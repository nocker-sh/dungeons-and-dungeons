import { previews } from "@/development/scenarios/index"

// 場面はブラウザの保存・画面の大きさを使うので、ブラウザだけで描く
export const ssr = false

export function getPrerenderPaths() {
  return previews().map((preview) => ({ slug: preview.slug }))
}
