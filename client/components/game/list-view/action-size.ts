/**
 * 主操作の文字の大きさ。長い言葉（「素材にして打ち直す」など）は小さくして、
 * スマホでも画面の左右からはみ出さないようにする。
 */
export function actionSize(label: string, wide: boolean) {
  const full = 11
  const fits = wide ? 8 : 5
  if (label.length <= fits) return full
  return Math.max(wide ? 5.5 : 4.6, (full * fits) / label.length)
}
