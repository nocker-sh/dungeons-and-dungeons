/**
 * 保存の置き場所。エンジンは localStorage やファイルを知らず、この受け口だけを見る。
 * ブラウザの実装は `client/game`、テスト用の実装は `testing/in-memory-save-store.ts`。
 */
export type SaveStore = Readonly<{
  read: () => string | null
  write: (value: string) => void
  clear: () => void
}>
