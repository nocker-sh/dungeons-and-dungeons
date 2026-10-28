/** 読み込み中の絵。開発スタジオが、仮想の時計を進める前に読み終わりを待つ。 */
export const loading = new Set<Promise<void>>()
