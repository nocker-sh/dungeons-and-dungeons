import type { Dispatch, SetStateAction } from "react"
import type { useFormation } from "@/client/components/game/formation/context"
import type { useNav } from "@/client/components/game/use-nav"
import type { StageApi } from "@/client/components/stage/use-stage"
import type { Fx } from "@/client/components/stage/use-fx"
import type { Game } from "@/lib/wiz/game/game"
import type { BattleParts } from "@/client/components/screens/battle/parts"
import {
  type BattlePhase,
  type BattleView,
  type Menu,
} from "@/client/components/screens/battle/types"

export type BattleDirectorDeps = {
  game: Game
  fx: Fx
  stage: StageApi
  nav: ReturnType<typeof useNav>
  formation: ReturnType<typeof useFormation>
  parts: BattleParts
  view: BattleView | null
  /** 戦う場所の背景（エンジンの戦う場所から作品のデータで引いた絵）。 */
  scene: string | null
  gone: readonly string[]
  shownHp: Record<string, number>
  /** 今の中断の合図（画面を離れたら止める）。 */
  signal: () => AbortSignal
  onEnd: (result: "victory" | "defeat") => void
  setPhase: Dispatch<SetStateAction<BattlePhase>>
  setMenu: Dispatch<SetStateAction<Menu>>
  setPeek: Dispatch<SetStateAction<string | null>>
  setShownHp: Dispatch<SetStateAction<Record<string, number>>>
  setGone: Dispatch<SetStateAction<string[]>>
}
