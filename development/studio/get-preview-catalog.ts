import { defaultStudioConfig } from "@/development/studio/config"
import { previewQuerySchema } from "@/development/studio/preview-query"
import { studioMembers, studioScenes } from "@/development/studio/scenarios"
import { contentSource } from "@/content/game-content"
import { layoutTime } from "@/development/studio/layout-time"

/** AIが使えるslugと再現用の入口を実行データから取得する。 */
export function getPreviewCatalog() {
  return {
    version: 1,
    view: "/dev/view?scene={scene}&seed={seed}&at={milliseconds}",
    play: "/dev/play/{scene}?seed={seed}",
    parameters: previewQuerySchema.keyof().options,
    scenes: studioScenes.map((scene) => ({
      ...scene,
      at: layoutTime(scene.slug),
    })),
    members: studioMembers,
    foes: contentSource.foes.map((foe) => ({ slug: foe.slug, name: foe.name })),
    defaults: defaultStudioConfig,
  }
}
