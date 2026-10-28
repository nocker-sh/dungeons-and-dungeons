import ts from "typescript"
import { basename } from "node:path"
import { component } from "@/scripts/component"
import { kebab } from "@/scripts/kebab"

/** 構文で確認できるファイルと依存の規約を検査する。 */
export function sourceProblems(file: string, text: string): string[] {
  const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
  const imported = new Set<string>()
  for (const node of ast.statements) {
    if (!ts.isImportDeclaration(node) || !node.importClause) continue
    if (node.importClause.name) imported.add(node.importClause.name.text)
    const bindings = node.importClause.namedBindings
    if (bindings && ts.isNamedImports(bindings))
      for (const binding of bindings.elements) imported.add(binding.name.text)
    else if (bindings) imported.add(bindings.name.text)
  }
  const problems: string[] = []
  const report = (node: ts.Node, message: string) => {
    const line = ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1
    problems.push(`${file}:${line}: ${message}`)
  }
  for (const node of ast.statements) {
    if (ts.isExportDeclaration(node)) {
      if (
        node.moduleSpecifier ||
        (node.exportClause &&
          ts.isNamedExports(node.exportClause) &&
          node.exportClause.elements.some((entry) =>
            imported.has((entry.propertyName ?? entry.name).text)
          ))
      )
        report(node, "re-exportは禁止。定義元を直接importする")
    }
    if (
      ts.isVariableStatement(node) &&
      node.modifiers?.some(
        (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword
      )
    ) {
      for (const declaration of node.declarationList.declarations) {
        let value = declaration.initializer
        while (value && ts.isPropertyAccessExpression(value))
          value = value.expression
        if (value && ts.isIdentifier(value) && imported.has(value.text))
          report(declaration, "importした値を別名でexportすることは禁止")
      }
    }
    if (
      ts.isExportAssignment(node) &&
      ts.isIdentifier(node.expression) &&
      imported.has(node.expression.text)
    )
      report(node, "importした値のdefault exportは禁止")
  }
  const exportedFunctions = new Set<string>()
  for (const node of ast.statements) {
    if (
      !ts.canHaveModifiers(node) ||
      !ts
        .getModifiers(node)
        ?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
    )
      continue
    if (ts.isFunctionDeclaration(node))
      exportedFunctions.add(node.name?.text ?? "default")
    if (ts.isVariableStatement(node))
      for (const declaration of node.declarationList.declarations) {
        if (
          declaration.initializer &&
          (ts.isArrowFunction(declaration.initializer) ||
            ts.isFunctionExpression(declaration.initializer))
        )
          exportedFunctions.add(declaration.name.getText(ast))
      }
  }
  if (exportedFunctions.size > 1)
    report(ast, "1ファイルからexportする関数は1つまで")
  const isComponentFile = file.endsWith(".tsx") && !file.endsWith(".test.tsx")
  if (isComponentFile && basename(file) === "index.tsx")
    report(ast, "index.tsxは禁止")
  for (const node of ast.statements) {
    const hook =
      ts.isFunctionDeclaration(node) &&
      node.name &&
      /^use[A-Z]/.test(node.name.text) &&
      node.parameters.length === 1
        ? { name: node.name.text, fn: node }
        : null
    const parameter = hook?.fn.parameters[0]
    const inputAlias =
      parameter?.type && ts.isTypeReferenceNode(parameter.type)
        ? ast.statements.find(
            (statement) =>
              ts.isTypeAliasDeclaration(statement) &&
              statement.name.text === parameter.type?.getText(ast)
          )
        : null
    const objectHook =
      hook &&
      parameter &&
      (ts.isObjectBindingPattern(parameter.name) ||
        (parameter.type && ts.isTypeLiteralNode(parameter.type)) ||
        (inputAlias &&
          ts.isTypeAliasDeclaration(inputAlias) &&
          ts.isTypeLiteralNode(inputAlias.type)))
        ? hook
        : null
    const entry = (isComponentFile ? component(node) : null) ?? objectHook
    if (!entry) continue
    if (
      isComponentFile &&
      entry !== objectHook &&
      basename(file) !== `${kebab(entry.name)}.tsx`
    )
      report(node, `コンポーネント${entry.name}とファイル名を一致させる`)
    const props = entry.fn.parameters[0]
    if (
      props &&
      !ast.statements.some(
        (statement) =>
          ts.isTypeAliasDeclaration(statement) &&
          statement.name.text === "Props"
      )
    )
      report(node, "コンポーネント・フックの入力型はtype Propsで定義する")
    if (
      props &&
      (!ts.isIdentifier(props.name) ||
        props.name.text !== "props" ||
        !props.type ||
        !ts.isTypeReferenceNode(props.type) ||
        props.type.typeName.getText(ast) !== "Props")
    )
      report(props, "propsはtype Propsで定義し、分割代入しない")
  }
  const visit = (node: ts.Node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isObjectBindingPattern(node.name) &&
      node.initializer &&
      ts.isIdentifier(node.initializer) &&
      node.initializer.text === "props"
    )
      report(node, "本体でもpropsの分割代入は禁止")
    ts.forEachChild(node, visit)
  }
  visit(ast)
  return problems
}
