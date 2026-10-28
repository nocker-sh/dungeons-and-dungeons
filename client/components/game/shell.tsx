import { EventConversation } from "@/client/components/game/event-conversation"
import { useCallback, useMemo, useRef, useState } from "react"
import { Formation } from "@/client/components/game/formation/formation"
import { FormationContext } from "@/client/components/game/formation/context"
import type { TargetRequest } from "@/client/components/game/formation/context"
import { FormationCards } from "@/client/components/game/formation-cards"
import { initialOverlay } from "@/client/components/game/initial-overlay"
import { overlayView } from "@/client/components/game/overlay"
import { reduceOverlay } from "@/client/components/game/reduce-overlay"
import type { OverlayAction } from "@/client/components/game/reduce-overlay"
import type { Screen } from "@/client/game/navigation"
import { SaveWarning } from "@/client/components/game/save-warning"
import { UnreadableSave } from "@/client/components/game/unreadable-save"
import { Stage } from "@/client/components/stage/stage"
import { TakeoverWhile } from "@/client/components/stage/takeover-while"
import { useGameState } from "@/client/contexts/use-game-state"
import type { Game } from "@/lib/wiz/game/game"
import type { PreviewStart } from "@/client/dev/preview-start"
import { Screens } from "@/client/components/game/screens"

type Props = {
  game: Game
  preview?: PreviewStart
  unreadable: readonly string[] | null
  onDiscard: () => Promise<void>
  saveFailed: boolean
  onRetrySave?: () => Promise<void>
}

export function Shell(props: Props) {
  // バッグ・仲間選び・持ち上げた札は、一つの有限オートマトン（overlay.ts）で持つ
  const [ignoreUnreadable, setIgnoreUnreadable] = useState(false)
  const [overlay, setOverlay] = useState(() =>
    initialOverlay({
      bag: props.preview?.overlay?.kind === "bag",
      lifted:
        props.preview?.overlay?.kind === "stand"
          ? props.preview.overlay.member
          : null,
    })
  )
  const current = useRef(overlay)
  const [frozen, freeze] = useState(false)
  const [override, setOverride] = useState<{
    press: (id: string) => void
  } | null>(null)
  const setPress = useCallback(
    (press: ((id: string) => void) | null) =>
      setOverride(press ? { press } : null),
    []
  )
  const creating = useGameState().phase.type === "creating"
  const cards = useMemo(() => new FormationCards(), [])
  const overrideRef = useRef(override)
  overrideRef.current = override
  // 操作はすべてここを通す。受け付けない操作は状態も変えず、何も起こさない
  const dispatch = useCallback((action: OverlayAction) => {
    const { state, effect } = reduceOverlay(current.current, action)
    if (state !== current.current) {
      current.current = state
      setOverlay(state)
    }
    if (effect?.type === "pick") effect.request.onPick(effect.member)
    if (effect?.type === "cancel") effect.request.onCancel()
    if (effect?.type === "delegate") overrideRef.current?.press(effect.member)
  }, [])
  const formation = useMemo(
    () => ({
      cards,
      lifted: overlay.lifted,
      lift: (member: string | null) => dispatch({ type: "lift", member }),
      press: (member: string) =>
        dispatch({ type: "pressCard", member, delegated: !!override }),
      // バッグのボタンで開き、開いていればもう一度押すと閉じる
      openBag: () => dispatch({ type: "toggleBag" }),
      bagOpen: overlayView.bagOpen(overlay),
      cardsHidden: overlayView.cardsHidden(overlay),
      target: overlayView.target(overlay),
      requestTarget: (request: TargetRequest | null) =>
        dispatch(
          request ? { type: "choose", request } : { type: "cancelChoosing" }
        ),
      setPress,
      frozen,
      freeze,
    }),
    [cards, overlay, override, dispatch, setPress, frozen]
  )
  const initial = useRef<Screen>(
    props.preview?.screen ??
      (props.game.state.phase.type === "creating"
        ? { name: "create" }
        : props.game.queries.prologue(props.game.state)
          ? { name: "prologue" }
          : props.game.state.phase.type === "town"
            ? { name: "town", intro: true }
            : props.game.state.phase.type === "battle" &&
                props.game.state.phase.townQuest
              ? { name: "quests" }
              : { name: "expedition" })
  )
  // 保存の扱いを選ぶまで、背後の会話や登録画面を開始しない。
  if (props.unreadable && !ignoreUnreadable)
    return (
      <Stage
        formation={null}
        alerts={
          <UnreadableSave
            problems={props.unreadable}
            onDiscard={props.onDiscard}
            onContinue={() => setIgnoreUnreadable(true)}
          />
        }
      >
        <TakeoverWhile takeover="appearance" active />
      </Stage>
    )
  return (
    <FormationContext.Provider value={formation}>
      <Stage
        // 容姿選択中は隊列を隠し、主人公の外見を見せる
        formation={creating ? null : <Formation />}
        alerts={
          props.saveFailed && props.onRetrySave ? (
            <SaveWarning onRetry={props.onRetrySave} />
          ) : null
        }
        backgroundInert={
          overlayView.bagMounted(overlay) ||
          !!formation.target ||
          (!override && !!overlay.lifted)
        }
      >
        <TakeoverWhile takeover="bag" active={formation.cardsHidden} />
        <TakeoverWhile takeover="appearance" active={creating} />
        <EventConversation />
        {props.preview?.render ?? (
          <Screens
            initial={initial.current}
            bag={overlayView.bagMounted(overlay)}
            bagTab={
              props.preview?.overlay?.kind === "bag"
                ? props.preview.overlay.tab
                : undefined
            }
            bagClose={overlay.closeRequests}
            closeBag={() => dispatch({ type: "bagClosed" })}
            standing={override ? null : overlay.lifted}
            closeStand={() => dispatch({ type: "lift", member: null })}
          />
        )}
      </Stage>
    </FormationContext.Provider>
  )
}
