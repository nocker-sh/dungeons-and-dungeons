import ts from "typescript"

export function component(node: ts.Statement) {
  if (
    ts.isFunctionDeclaration(node) &&
    node.name &&
    /^[A-Z]/.test(node.name.text)
  )
    return { name: node.name.text, fn: node }
  if (
    !ts.isVariableStatement(node) ||
    node.declarationList.declarations.length !== 1
  )
    return null
  const declaration = node.declarationList.declarations[0]
  if (
    !ts.isIdentifier(declaration.name) ||
    !/^[A-Z]/.test(declaration.name.text) ||
    !declaration.initializer
  )
    return null
  let value = declaration.initializer
  while (ts.isCallExpression(value) && value.arguments.length)
    value = value.arguments[0]
  return ts.isArrowFunction(value) || ts.isFunctionExpression(value)
    ? { name: declaration.name.text, fn: value }
    : null
}
