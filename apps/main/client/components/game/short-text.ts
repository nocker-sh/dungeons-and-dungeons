/** 必要な能力の不足。足りていれば空文字。 */
export function shortText(short: { str: number; tec: number }) {
  const parts = [
    ...(short.str ? [`筋力が${short.str}`] : []),
    ...(short.tec ? [`技量が${short.tec}`] : []),
  ]
  return parts.length ? `${parts.join("・")}足りない：攻撃力が下がる` : ""
}
