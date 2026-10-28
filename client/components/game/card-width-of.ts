/** 手札の写真一枚の幅。縦長の画面は画面の幅に合わせ、横長は高さに合わせる。 */
export function cardWidthOf(wide: boolean) {
  return wide ? "min(13vw, 17vh, 170px)" : "min(27vw, 19vh, 150px)"
}
