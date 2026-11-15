/** 背景の面の奥行き（stage.tsx の ArtSet の最初の層）。 */
export const ARTBOARD_DEPTH = 0.5

/** 背景の面の拡大・回転の中心（stage.tsx の LAYER の transformOrigin）。 */
export const ORIGIN = { x: 0.5, y: 0.55 }

/** 背景の面と画面の大きさ。面の位置は画面の左上からの、カメラの変形前の値。 */
export type FocusFrame = {
  layerLeft: number
  layerTop: number
  layerWidth: number
  layerHeight: number
  viewportWidth: number
  viewportHeight: number
}
