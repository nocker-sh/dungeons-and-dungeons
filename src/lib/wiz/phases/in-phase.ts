import type { Game } from "@/lib/wiz/game"
import type { Phase } from "@/lib/wiz/phases/phase"
import { phaseOf } from "@/lib/wiz/phases/phase-of"

type PhaseOfKind<K extends Phase["kind"]> = Extract<Phase, { kind: K }>

/** 今のフェーズが kind なら、そのフェーズ。違えば null。画面の操作はここから始める。 */
export function inPhase<K extends Phase["kind"]>(
  game: Game,
  kind: K
): PhaseOfKind<K> | null {
  const phase = phaseOf(game)
  return phase.kind === kind ? (phase as PhaseOfKind<K>) : null
}
