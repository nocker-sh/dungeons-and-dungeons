/** デコード中のImageを保持する。表示前の画像をGCや重複読込で失わない。 */
const images = new Map<
  string,
  { image: HTMLImageElement; decoded: Promise<void> }
>()

/** 読み込み中の絵。開発スタジオが、仮想の時計を進める前に読み終わりを待つ。 */
const loading = new Set<Promise<void>>()

/** 読み込み中の絵がなくなるまで待つ（失敗した読み込みも終わりとして数える）。 */
export async function artworkSettled() {
  while (loading.size) await Promise.allSettled(loading)
}

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
