import { previewQuerySchema } from "@/development/studio/preview-query"
import { parseStudioConfig } from "@/development/studio/parse-studio-config"
import { layoutTime } from "@/development/studio/layout-time"
import { contentSource } from "@/content/game-content"
import { studioMembers, studioScenes } from "@/development/studio/scenarios"
import type { PreviewRequest } from "@/development/studio/preview-request"

/** URLの指定ミスを既定値へ黙って置き換えず、再現条件を検証する。 */
export function getPreviewRequest(
  query: URLSearchParams,
  scene: string | null = null
): PreviewRequest | Error {
  try {
    for (const key of query.keys())
      if (query.getAll(key).length !== 1)
        return new Error(`指定が重複しています: ${key}`)
    const input = previewQuerySchema.parse(Object.fromEntries(query))
    if (scene && input.scene && input.scene !== scene)
      return new Error("パスとsceneの指定が一致しません")
    const slug = scene ?? input.scene ?? "battle"
    if (!studioScenes.some((entry) => entry.slug === slug))
      return new Error(`場面がありません: ${slug}`)
    const at = input.at ?? layoutTime(slug)
    const fields = Object.fromEntries(
      Object.entries(input).filter(
        (entry) =>
          entry[1] !== undefined &&
          !["at", "guides", "actions"].includes(entry[0])
      )
    )
    const config = parseStudioConfig({
      ...fields,
      scene: slug,
      ...(input.actions ? { actions: JSON.parse(input.actions) } : {}),
      duration: input.duration ?? Math.max(6000, at),
    })
    for (const slug of config.party)
      if (!studioMembers.some((member) => member.slug === slug))
        return new Error(`キャラがありません: ${slug}`)
    for (const slug of config.foes)
      if (!contentSource.foes.some((foe) => foe.slug === slug))
        return new Error(`敵がありません: ${slug}`)
    if (at > config.duration)
      return new Error("指定時刻がdurationを超えています")
    return { config, at, guides: input.guides === "1" }
  } catch (problem) {
    return problem instanceof Error ? problem : new Error(String(problem))
  }
}
