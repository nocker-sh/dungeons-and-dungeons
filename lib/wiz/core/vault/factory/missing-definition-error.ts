export type WizVaultDefinitionKind = "monster" | "event"

/**
 * Codex の参照先が欠けたまま Vault を組み立てようとしたことを表す。
 * 欠損 ID を全件保持し、最初の一件だけで診断を打ち切らない。
 */
export class WizVaultMissingDefinitionError extends Error {
  override readonly name = "WizVaultMissingDefinitionError"
  readonly definitionKind: WizVaultDefinitionKind
  readonly missingIds: readonly string[]

  constructor(definitionKind: WizVaultDefinitionKind, missingIds: readonly string[]) {
    const uniqueMissingIds = Object.freeze([...new Set(missingIds)])
    super(`Missing ${definitionKind} definitions: ${uniqueMissingIds.join(", ")}`)
    this.definitionKind = definitionKind
    this.missingIds = uniqueMissingIds
    Object.freeze(this)
  }
}
