import { readdirSync, readFileSync } from "node:fs"
import { join, relative } from "node:path"

/** 開発サーバー・開発スタジオだけが持つ入口の目印。本番の配布物に1つも残さない。 */
const markers = [
  "dev.dnd.localhost",
  "/__dev/",
  "dnd-save",
  "save=tmp",
  "save=message",
  "__devStudio",
  "StudioRuntime",
]

/** ビルドしたゲームの配布物から、開発用の入口の残りを探す。 */
export function releaseBundleProblems(dir: string): string[] {
  const files = (path: string): string[] =>
    readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
      const file = join(path, entry.name)
      if (entry.isDirectory()) return files(file)
      return /\.(?:m?js|html)$/.test(entry.name) ? [file] : []
    })
  return files(dir).flatMap((file) => {
    const text = readFileSync(file, "utf8")
    return markers
      .filter((marker) => text.includes(marker))
      .map(
        (marker) =>
          `${relative(dir, file)}: 開発用の入口「${marker}」が本番に残っている`
      )
  })
}
