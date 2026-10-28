import { loading } from "@/client/game/artwork"

/** デコード中のImageを保持する。表示前の画像をGCや重複読込で失わない。 */
export const images = new Map<
  string,
  { image: HTMLImageElement; decoded: Promise<void> }
>()

export async function loadArtwork(paths: readonly string[]) {
  await Promise.all(
    paths.map((path) => {
      let entry = images.get(path)
      if (!entry) {
        const image = new Image()
        image.src = path
        const decoded = image.decode().catch((problem) => {
          images.delete(path)
          throw new Error(`画像を読めません: ${path}: ${String(problem)}`)
        })
        entry = { image, decoded }
        images.set(path, entry)
        loading.add(decoded)
        void decoded.catch(() => {}).finally(() => loading.delete(decoded))
      }
      return entry.decoded
    })
  )
}
