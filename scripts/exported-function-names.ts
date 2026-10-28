import ts from "typescript"

/** ファクトリで作った関数も数え、React Contextのような値を関数と混同しない。 */
export function exportedFunctionNames(
  checker: ts.TypeChecker,
  source: ts.SourceFile
): string[] {
  const module = checker.getSymbolAtLocation(source)
  if (!module) return []
  return checker.getExportsOfModule(module).flatMap((entry) => {
    if (!entry.valueDeclaration || entry.flags & ts.SymbolFlags.TypeAlias)
      return []
    const type = checker.getTypeOfSymbolAtLocation(
      entry,
      entry.valueDeclaration
    )
    if (
      !type.getCallSignatures().length ||
      type.getSymbol()?.getName() === "Context"
    )
      return []
    return [entry.name]
  })
}
