/** レア度をかける前の売値。売値がなければ値段の半分（下限1）。 */
export function baseSellPrice(good: {
  readonly price?: number
  readonly sell?: number
}) {
  return good.sell ?? Math.max(1, Math.floor((good.price ?? 2) / 2))
}
