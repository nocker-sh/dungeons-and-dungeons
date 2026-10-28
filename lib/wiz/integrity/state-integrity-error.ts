export class StateIntegrityError extends Error {
  constructor(readonly problems: readonly string[]) {
    super(`保存データが今のコンテンツと合いません:\n${problems.join("\n")}`)
    this.name = "StateIntegrityError"
  }
}
