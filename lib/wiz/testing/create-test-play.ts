import { GameDefinition } from "@/lib/wiz/definition/game-definition"
import type { Game } from "@/lib/wiz/game/game"
import { realContent } from "@/lib/wiz/testing/real-content"
import { fixedClock } from "@/lib/wiz/testing/fixed-clock"
import { startedState } from "@/lib/wiz/testing/started-state"
import { testEnvironment } from "@/lib/wiz/testing/test-environment"

export type TestPlay = Readonly<{ definition: GameDefinition; game: Game }>

/**
 * 乱数を固定値（または渡した関数）で回し、IDを連番にしたプレイ。
 * 始まりは「遊べる街」（`startedState`）。`definition` も返すので、別の状態から始めるプレイも作れる。
 */
export function createTestPlay(
  random: number | (() => number) = 0.5,
  content: unknown = realContent()
): TestPlay {
  const definition = new GameDefinition(content)
  return {
    definition,
    game: definition.create(
      testEnvironment({ random, clock: fixedClock(1000) }),
      startedState(definition)
    ),
  }
}
