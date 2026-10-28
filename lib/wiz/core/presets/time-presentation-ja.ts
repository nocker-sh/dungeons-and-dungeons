import type { WizSeason, WizTimeOfDay, WizWeather } from "@/lib/wiz/core/types/time"

export type WizTimeDescriptionsJa = Readonly<{
  seasons: Readonly<Record<WizSeason, string>>
  timesOfDay: Readonly<Record<WizTimeOfDay, string>>
  weather: Readonly<Record<WizWeather, string>>
}>

export const WIZ_TIME_DESCRIPTIONS_JA: WizTimeDescriptionsJa = Object.freeze({
  seasons: Object.freeze({
    spring: "春。植物が芽吹く季節。",
    summer: "夏。暑さで疲れやすい。",
    autumn: "秋。収穫の季節だ。",
    winter: "冬。厳しい寒さが体力を奪う。",
  }),
  timesOfDay: Object.freeze({
    morning: "朝。比較的安全。",
    noon: "昼。通常の危険度。",
    evening: "夕方。モンスターが活発に。",
    night: "夜。危険が増す。",
  }),
  weather: Object.freeze({
    sunny: "晴天。冒険日和だ。",
    cloudy: "曇り空。特に影響なし。",
    rainy: "雨が降っている。探索が難しい。",
    stormy: "嵐だ! 外出は危険。",
    snowy: "雪が積もっている。移動が困難。",
  }),
})
