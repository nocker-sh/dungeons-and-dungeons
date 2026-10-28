import type { Game } from "@/lib/wiz/game/game"

export type RoomView = ReturnType<Game["queries"]["rooms"]>[number]

/** 部屋の効果を札にする。数値はエンジンのデータから。 */
export function perks(room: RoomView) {
  return [
    room.heal === "full" ? "HP（生命力）全回復" : "HP（生命力）半分回復",
    "ワザの残り 全回復",
    room.clean
      ? "疲れ・汚れ 全快"
      : `疲れ ${room.fatigue > 0 ? "+" : "−"}${Math.abs(room.fatigue)}`,
    ...(!room.clean && room.dirt ? [`汚れ +${room.dirt}`] : []),
    room.levelUp ? "レベルアップ" : "レベルアップなし",
    "防具の耐久は回復しない",
  ]
}
