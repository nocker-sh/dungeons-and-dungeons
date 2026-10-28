import type { SaveStorage } from "./save-storage"

/** ブラウザへ保存を残さない、プレビュー用のメモリ保存。 */
export class MemoryStorage implements SaveStorage {
  value: string | null = null
  read() {
    return this.value
  }
  write(value: string) {
    this.value = value
  }
  clear() {
    this.value = null
  }
}
