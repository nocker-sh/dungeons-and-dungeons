/** 書き換えられる作品データ（slug 付き）。 */
export type Source = Record<string, unknown>

export type Entry = Record<string, unknown> & { id?: string; slug?: string }

/** id を持つ一覧。`<一覧>.<slug>.<項目>` で指せる。 */
export const COLLECTIONS = [
  "party",
  "skills",
  "goods",
  "foes",
  "layers",
  "demons",
  "rooms",
  "shops",
  "recruits",
  "quests",
  "smithy.recipes",
] as const
