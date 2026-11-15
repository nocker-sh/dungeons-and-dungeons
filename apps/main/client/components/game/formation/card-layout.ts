/** 画面の形に合わせて、3枚をわざと不揃いに置く。 */
export function layoutFor(wide: boolean) {
  return wide
    ? [
        {
          left: "-4vw",
          bottom: "-4vh",
          width: "38vw",
          height: "19vh",
          rotate: -3,
        },
        {
          left: "30vw",
          bottom: "-6vh",
          width: "37vw",
          height: "21vh",
          rotate: 2.5,
        },
        {
          left: "62vw",
          bottom: "-4vh",
          width: "42vw",
          height: "18.5vh",
          rotate: -2,
        },
      ]
    : [
        // スマホも横一列。幅が狭い分、縦に長くし、隊列の帯（24vh）より上まで届かせる
        {
          left: "-4vw",
          bottom: "-4vh",
          width: "39vw",
          height: "29vh",
          rotate: -2.5,
        },
        {
          left: "31vw",
          bottom: "-5vh",
          width: "38vw",
          height: "30.5vh",
          rotate: 2,
        },
        {
          left: "65vw",
          bottom: "-4vh",
          width: "41vw",
          height: "28.5vh",
          rotate: -2,
        },
      ]
}
