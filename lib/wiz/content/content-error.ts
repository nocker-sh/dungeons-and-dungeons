/** データの誤り。全部まとめて返す。 */
export class ContentError extends Error {
  constructor(readonly problems: readonly string[]) {
    super(`コンテンツに誤りがあります:\n${problems.join("\n")}`)
    this.name = "ContentError"
  }
}
