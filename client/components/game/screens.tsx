import { TargetDim } from "@/client/components/game/target-dim"
import { useFormation } from "@/client/components/game/formation/context"
import { NavContext } from "@/client/components/game/use-nav"
import { useNavState } from "@/client/components/game/use-nav-state"
import type { Screen } from "@/client/game/navigation"
import { StandView } from "@/client/components/game/stand/stand-view"
import { useKeyboardNav } from "@/client/components/game/focus"
import { Create } from "@/client/components/screens/create"
import { Prologue } from "@/client/components/screens/prologue"
import { Town } from "@/client/components/screens/town"
import { Outskirts } from "@/client/components/screens/outskirts"
import { Place } from "@/client/components/screens/place"
import { Shop } from "@/client/components/screens/shop/shop"
import { Room } from "@/client/components/screens/room/room"
import { Expedition } from "@/client/components/screens/expedition/expedition"
import { Quests } from "@/client/components/screens/quests"
import { WorldMap } from "@/client/components/screens/world-map"
import { BagView } from "@/client/components/screens/bag-view"
import { ResultPanel } from "@/client/components/screens/result-panel"
import { LeavingContext } from "@/client/components/stage/use-leaving"
import { useStage } from "@/client/components/stage/use-stage"
import { useGameState } from "@/client/contexts/use-game-state"

type Props = {
  initial: Screen
  bag: boolean
  /** バッグを開いたときに見せるタブ（見た目の確認用）。 */
  bagTab?: number
  bagClose: number
  closeBag: () => void
  standing: string | null
  closeStand: () => void
}

export function Screens(props: Props) {
  const nav = useNavState(props.initial)
  const formation = useFormation()
  const stage = useStage()
  const state = useGameState()
  useKeyboardNav(stage.canvas)
  const { screen } = nav
  return (
    <NavContext.Provider value={nav}>
      <div
        data-screen-content
        inert={!!props.standing || props.bag || !!formation.target}
        style={{ display: "contents" }}
      >
        <LeavingContext.Provider value={nav.leaving}>
          {screen.name === "create" ? <Create key="create" /> : null}
          {screen.name === "prologue" ? <Prologue key="prologue" /> : null}
          {screen.name === "town" ? (
            <Town key="town" intro={screen.intro} />
          ) : null}
          {screen.name === "outskirts" ? <Outskirts key="outskirts" /> : null}
          {screen.name === "place" ? (
            <Place key={screen.place} place={screen.place} />
          ) : null}
          {screen.name === "shop" ? (
            <Shop key={screen.shop} shop={screen.shop} />
          ) : null}
          {screen.name === "room" ? (
            <Room key={screen.room} room={screen.room} />
          ) : null}
          {screen.name === "quests" ? <Quests key="quests" /> : null}
          {screen.name === "world-map" ? <WorldMap key="world-map" /> : null}
          {screen.name === "expedition" ? (
            <Expedition key="expedition" />
          ) : null}
        </LeavingContext.Provider>
      </div>
      {props.standing ? (
        <StandView id={props.standing} onClose={props.closeStand} />
      ) : null}
      {props.bag && state.phase.type !== "battle" ? (
        <BagView
          onClose={props.closeBag}
          closeSignal={props.bagClose}
          tab={props.bagTab}
        />
      ) : null}
      {/* 全滅で失った物・踏破（エンディング）の結果。街で一度だけ出す */}
      <ResultPanel />
      {formation.target ? <TargetDim request={formation.target} /> : null}
    </NavContext.Provider>
  )
}
