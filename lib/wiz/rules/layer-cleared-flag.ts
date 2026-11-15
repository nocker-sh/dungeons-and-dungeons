/**
 * 層のボスを倒したときにエンジンが立てる会話のフラグ。
 * 次の層が開かない層（開いている一番深い層）でも、突破したあとの場面の条件に使える。
 */
export function layerClearedFlag(no: number) {
  return `layer:cleared:${no}`
}
