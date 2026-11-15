/** カメラ用の名前（camelCase）を CSS の名前（kebab-case）へ。 */
export function cssName(property: string) {
  return property.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)
}
