/**
 * 見出しの大きさ。長い題（「鍛え直し：アルマ」など）は小さくして、
 * 右上の「‹ 戻る」に重ならないようにする。
 */
export function headSize(title: string, wide: boolean) {
  const full = wide ? 7 : 8
  const fits = wide ? 7 : 5
  if (title.length <= fits) return full
  return Math.max(wide ? 4 : 4.2, (full * fits) / title.length)
}
