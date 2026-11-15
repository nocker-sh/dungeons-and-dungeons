/** 演出で使う色・イージング・小道具。見た目の乱数はゲームの規則に関わらないので Math.random でよい。 */
export const COLOR = {
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

export const EASE_OUT = "cubic-bezier(.16,1,.3,1)"

export const EASE_IN = "cubic-bezier(.7,0,.84,0)"

export const EASE_POP = "cubic-bezier(.34,1.56,.64,1)"

/** motion 用の同じ曲線（3次ベジェの4つの値）。 */
export const MOTION_EASE = {
  out: [0.16, 1, 0.3, 1],
  in: [0.7, 0, 0.84, 0],
  pop: [0.34, 1.56, 0.64, 1],
} as const satisfies Record<string, readonly [number, number, number, number]>
