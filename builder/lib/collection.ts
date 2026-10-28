import type { Source, Entry } from "@/builder/lib/content"
import { get } from "@/builder/lib/get"

/** 一覧の中身。 */
export function collection(source: Source, name: string): Entry[] {
  const list = get(source, name.split("."))
  return Array.isArray(list) ? (list as Entry[]) : []
}
