import type { CSSProperties } from "react"

/**
 * Canvas（ゲームが映る画面）の見た目の定数。描画用の <canvas> 要素のことではない。
 * スタイルはCSSファイルではなく style 属性で書く。ページ側のCSS（リセットなど）の影響を受けないため。
 */
export const PALETTE = {
  ink: "#0b0c12",
  night: "#12141c",
  deep: "#1b2030",
  moss: "#7fa58a",
  sage: "#c3dbc8",
  amethyst: "#4a3d78",
  lavender: "#aa9fd4",
  dusk: "#4f6c9e",
  mist: "#dcdee5",
  stone: "#858995",
  paper: "#eeebe3",
  blood: "#6b1723",
} as const

export const FONT_FAMILY =
  '"Reggae One", "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", system-ui, sans-serif'
/** 英字の擬音など。 */
export const COMIC_FONT = '"Arial Black", "Helvetica Neue", Impact, sans-serif'

/** 画面の短い辺の1%を、決まった段に丸めた単位の長さ（Canvas の根で --u を決める。段は stage/kit の UNIT_STEPS）。 */
export function unit(amount: number) {
  return `calc(var(--u) * ${amount})`
}

/** ページ側のCSSを無かったことにする。部品の style の先頭に置く。 */
export const REVERT: CSSProperties = { all: "revert", boxSizing: "border-box" }

/**
 * ゲーム画面の層の順。画面の上に直に置くものは、必ずこのどれかに置く（数字を直に書かない）。
 * 部品の中での前後（札の影と札など）は、その部品が作る層の中の順なので、部品ごとに決めてよい。
 * 共通UIは黒帯や暗がりの下に隠さない。何を見せて何を隠すかは StageDirector が決める。
 */
export const STAGE_LAYER = {
  /** 手番の仲間から狙う敵への矢印。敵の上、スキルの指示と下の隊列の札の後ろ。 */
  arrow: 18,
  /** 場面のUI（人物・吹き出し・店の札）。 */
  scene: 20,
  /** 場面の上に出す選択（戦闘のスキル・アイテム）。 */
  pick: 24,
  /** 場面の上に開く板（バッグ・探索装備）。 */
  sheet: 29,
  /** 映画の黒帯。 */
  letterbox: 40,
  /** 周辺の暗がり。 */
  vignette: 45,
  /** 仲間を選ぶ間、場面を暗くする幕。下の隊列より下。 */
  dim: 49,
  /** 下の隊列。 */
  formation: 50,
  /** 共通UI（設定・戻る）。 */
  chrome: 55,
  /** 会話。 */
  conversation: 59,
  /** それだけを見せる面（<Solo>）。 */
  solo: 60,
  /** 場面の上に開く窓（全滅・踏破の結果）。 */
  dialog: 65,
  /** 保存を読めなかったときの知らせ。何より上。 */
  alert: 70,
} as const

/** 画面いっぱいの操作の層。層そのものは押せず、中のボタン類だけが押せる（ボタン側で pointerEvents: auto）。 */

export const UI_LAYER: CSSProperties = {
  ...REVERT,
  display: "block",
  position: "absolute",
  inset: 0,
  zIndex: STAGE_LAYER.scene,
  pointerEvents: "none",
  boxSizing: "border-box",
}

/** 英字の擬音の見た目（傾いた太字に墨と血の段の影）。 */
export const COMIC: CSSProperties = {
  ...REVERT,
  fontFamily: COMIC_FONT,
  fontWeight: 900,
  fontStyle: "italic",
  letterSpacing: "-0.02em",
  lineHeight: 1,
  whiteSpace: "nowrap",
  color: PALETTE.paper,
  WebkitTextStroke: `0.07em ${PALETTE.ink}`,
  paintOrder: "stroke fill",
  transform: "skewX(-10deg) scaleY(1.15)",
  textShadow:
    "0.03em 0.03em 0 #0b0c12, 0.06em 0.06em 0 #6b1723, 0.09em 0.09em 0 #6b1723, 0.12em 0.12em 0 #0b0c12",
}

/** ボタンの素地（ページ側のCSSを打ち消し、押せるようにする）。 */
export const BUTTON_BASE: CSSProperties = {
  ...REVERT,
  display: "block",
  boxSizing: "border-box",
  margin: 0,
  padding: 0,
  border: 0,
  background: "none",
  font: "inherit",
  color: "inherit",
  textAlign: "inherit",
  cursor: "pointer",
  touchAction: "manipulation",
  pointerEvents: "auto",
}

/** 画像の素地（ページ側のCSSの max-width などを打ち消す）。 */
export const IMG_BASE: CSSProperties = {
  ...REVERT,
  display: "block",
  maxWidth: "none",
}
