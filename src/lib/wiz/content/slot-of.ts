/** 品物の装備部位。省略されていれば種類（weapon・armor）をそのまま使う。 */
export function slotOf(good: {
  readonly kind: string
  readonly slot?: string
}) {
  return good.slot ?? good.kind
}
