import { existsSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vite-plus/test"
import layers from "@/lib/content/data/layers.json"
import { gameContent } from "@/lib/content/game-content"
import { layerSceneArt, layerScenes } from "@/lib/content/looks"

const publicFile = (path: string) => join(process.cwd(), "public", path)

describe("層ごとの背景の候補", () => {
  it.each(layers.map((layer) => [layer.name, layer.id]))(
    "%s は道中3枚以上・宝箱・休憩の背景を持ち、絵のファイルがある",
    (_name, id) => {
      const scenes = layerScenes(id)
      expect(
        scenes.filter((entry) => entry.kind === "path").length
      ).toBeGreaterThanOrEqual(3)
      expect(scenes.some((entry) => entry.kind === "treasure")).toBe(true)
      expect(scenes.some((entry) => entry.kind === "rest")).toBe(true)
      expect(new Set(scenes.map((entry) => entry.key)).size).toBe(scenes.length)
      for (const entry of scenes) {
        expect(existsSync(publicFile(entry.image))).toBe(true)
        if (entry.wideImage)
          expect(existsSync(publicFile(entry.wideImage))).toBe(true)
      }
    }
  )

  it("エンジンへは絵の識別子だけを渡し、どの識別子も絵に引ける", () => {
    for (const layer of gameContent.layers) {
      const scenes = layer.scenes!
      expect(scenes).toBeDefined()
      for (const key of [
        ...scenes.path,
        ...(scenes.treasure ?? []),
        ...(scenes.rest ?? []),
      ]) {
        expect(key).not.toMatch(/\//)
        expect(layerSceneArt(layer.id, key)).toMatch(/^\/art\/scenes\//)
        expect(layerSceneArt(layer.id, key, true)).toMatch(/^\/art\/scenes\//)
      }
    }
  })
})
