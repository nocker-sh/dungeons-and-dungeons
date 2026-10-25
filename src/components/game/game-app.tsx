import {
  EventConversation,
  VisitScenesContext,
} from "@/components/game/event-conversation"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { motion } from "motion/react"
import {
  BUTTON_BASE,
  PALETTE,
  REVERT,
  unit,
  STAGE_LAYER,
} from "@/components/canvas/tokens"
import {
  Formation,
  FormationContext,
  useFormation,
  type TargetRequest,
} from "@/components/game/formation"
import { FormationCards } from "@/components/game/formation-cards"
import {
  initialOverlay,
  overlayView,
  reduceOverlay,
  type OverlayAction,
} from "@/components/game/overlay"
import { NavContext, useNavState, type Screen } from "@/components/game/nav"
import { StartOverContext } from "@/components/game/settings"
import { StandView } from "@/components/game/stand"
import { useKeyboardNav } from "@/components/game/focus"
import { Create } from "@/components/screens/create"
import { Prologue } from "@/components/screens/prologue"
import { Town } from "@/components/screens/town"
import { Outskirts } from "@/components/screens/outskirts"
import { Place } from "@/components/screens/place"
import { Shop } from "@/components/screens/shop"
import { Room } from "@/components/screens/room"
import { Expedition } from "@/components/screens/expedition"
import { Quests } from "@/components/screens/quests"
import { WorldMap } from "@/components/screens/world-map"
import { BagView } from "@/components/screens/bag"
import { ResultPanel } from "@/components/screens/result"
import { Stage } from "@/components/stage/stage"
import { TakeoverWhile } from "@/components/stage/takeover"
import { LeavingContext, useStage } from "@/components/stage/stage-context"
import { GameProvider, useGameState } from "@/contexts/game"
import { gameContent } from "@/lib/content/game-content"
import {
  BrowserStorage,
  DevFileStorage,
  MemoryStorage,
  wantsDevFileSave,
  connectSave,
  discardSave,
  type SaveStorage,
  type Session,
} from "@/lib/game-client/storage"
import { ContentError, GameDefinition, type Game } from "@/lib/wiz"

type Boot =
  | { kind: "ready"; game: Game; storage: SaveStorage; session: Session }
  | { kind: "content"; problems: readonly string[] }

import type { PreviewStart } from "@/lib/game-client/start"
export type { PreviewStart } from "@/lib/game-client/start"

/** 起動。エンジンを作り、保存を読み込んでから画面を出す。 */
export function GameApp({
  preview,
  onReady,
}: { preview?: PreviewStart; onReady?: (game: Game) => void } = {}) {
  const [boot, setBoot] = useState<Boot | null>(null)
  useEffect(() => {
    let disconnect = () => {}
    let cancelled = false
    void (async () => {
      let game: Game
      try {
        game = new GameDefinition(preview?.content ?? gameContent).create(
          preview?.environment,
          preview?.initialState
        )
        if (preview?.save) {
          const failed = game.restore(preview.save)
          if (failed) throw failed
        }
      } catch (error) {
        setBoot({
          kind: "content",
          problems:
            error instanceof ContentError ? error.problems : [String(error)],
        })
        return
      }
      // 開発中に ?save=tmp で開いたら、AI の CLI と同じ /tmp の保存を使う
      const storage = preview
        ? new MemoryStorage()
        : wantsDevFileSave()
          ? await DevFileStorage.load()
          : new BrowserStorage()
      if (cancelled) return
      const session = connectSave(game, storage)
      disconnect = session.disconnect
      setBoot({ kind: "ready", game, storage, session })
      onReady?.(game)
    })()
    return () => {
      cancelled = true
      disconnect()
    }
    // 起動し直すのは preview が変わったときだけ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  if (!boot) return <div className="game" />
  if (boot.kind === "content")
    return <ContentProblems problems={boot.problems} />
  const discard = () => {
    const session = discardSave(boot.game, boot.storage)
    setBoot({ ...boot, session })
  }
  // 自動保存を止めてから保存を消し、読み込み直して容姿選びから始める
  const startOver = preview
    ? null
    : () => {
        boot.session.disconnect()
        boot.storage.clear()
        window.location.reload()
      }
  return (
    <GameProvider game={boot.game}>
      <StartOverContext value={startOver}>
        <VisitScenesContext value={!preview || preview.visitScenes === true}>
          <Shell
            game={boot.game}
            preview={preview}
            unreadable={
              boot.session.status === "unreadable"
                ? boot.session.problems
                : null
            }
            onDiscard={discard}
          />
        </VisitScenesContext>
      </StartOverContext>
    </GameProvider>
  )
}

/** コンテンツの誤りを一覧で出す（作っている途中で壊れたとき）。 */
function ContentProblems({ problems }: { problems: readonly string[] }) {
  return (
    <div
      className="game"
      style={{
        display: "block",
        overflow: "auto",
        padding: "6vh 6vw",
        color: "#eeebe3",
      }}
    >
      <h1 style={{ fontSize: "calc(var(--u)*5)", marginBottom: "1em" }}>
        コンテンツに誤りがあります
      </h1>
      <p style={{ fontWeight: 700, marginBottom: "1em", opacity: 0.8 }}>
        src/lib/content を直したら、ページを再読み込みしてください。
      </p>
      <ul
        style={{
          display: "grid",
          gap: ".4em",
          fontWeight: 700,
          fontSize: "calc(var(--u)*2.4)",
        }}
      >
        {problems.map((problem) => (
          <li key={problem}>・{problem}</li>
        ))}
      </ul>
    </div>
  )
}

function Shell({
  game,
  preview,
  unreadable,
  onDiscard,
}: {
  game: Game
  preview?: PreviewStart
  unreadable: readonly string[] | null
  onDiscard: () => void
}) {
  // バッグ・仲間選び・持ち上げた札は、一つの有限オートマトン（overlay.ts）で持つ
  const [overlay, setOverlay] = useState(() =>
    initialOverlay({
      bag: preview?.overlay?.kind === "bag",
      lifted:
        preview?.overlay?.kind === "stand" ? preview.overlay.member : null,
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
    preview?.screen ??
      (game.state.phase.type === "creating"
        ? { name: "create" }
        : game.queries.prologue(game.state)
          ? { name: "prologue" }
          : game.state.phase.type === "town"
            ? { name: "town", intro: true }
            : game.state.phase.type === "battle" && game.state.phase.townQuest
              ? { name: "quests" }
              : { name: "expedition" })
  )
  return (
    <FormationContext.Provider value={formation}>
      <Stage
        // 容姿選択中は隊列を隠し、主人公の外見を見せる
        formation={creating ? null : <Formation />}
      >
        <TakeoverWhile takeover="bag" active={formation.cardsHidden} />
        <TakeoverWhile takeover="appearance" active={creating} />
        <EventConversation />
        {preview?.render ?? (
          <Screens
            initial={initial.current}
            bag={overlayView.bagMounted(overlay)}
            bagTab={
              preview?.overlay?.kind === "bag" ? preview.overlay.tab : undefined
            }
            bagClose={overlay.closeRequests}
            closeBag={() => dispatch({ type: "bagClosed" })}
            standing={override ? null : overlay.lifted}
            closeStand={() => dispatch({ type: "lift", member: null })}
            unreadable={unreadable}
            onDiscard={onDiscard}
          />
        )}
      </Stage>
    </FormationContext.Provider>
  )
}

function Screens({
  initial,
  bag,
  bagTab,
  bagClose,
  closeBag,
  standing,
  closeStand,
  unreadable,
  onDiscard,
}: {
  initial: Screen
  bag: boolean
  /** バッグを開いたときに見せるタブ（見た目の確認用）。 */
  bagTab?: number
  bagClose: number
  closeBag: () => void
  standing: string | null
  closeStand: () => void
  unreadable: readonly string[] | null
  onDiscard: () => void
}) {
  const nav = useNavState(initial)
  const formation = useFormation()
  const stage = useStage()
  const state = useGameState()
  useKeyboardNav(stage.canvas)
  const { screen } = nav
  return (
    <NavContext.Provider value={nav}>
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
        {screen.name === "expedition" ? <Expedition key="expedition" /> : null}
      </LeavingContext.Provider>
      {standing ? <StandView id={standing} onClose={closeStand} /> : null}
      {bag && state.phase.type !== "battle" ? (
        <BagView onClose={closeBag} closeSignal={bagClose} tab={bagTab} />
      ) : null}
      {/* 全滅で失った物・踏破（エンディング）の結果。街で一度だけ出す */}
      <ResultPanel />
      {formation.target ? <TargetDim request={formation.target} /> : null}
      {unreadable ? (
        <UnreadableSave problems={unreadable} onDiscard={onDiscard} />
      ) : null}
    </NavContext.Provider>
  )
}

/** 保存を読めなかったとき：理由を見せ、消して始めるかを選べる。消すまでは上書きしない。 */
function UnreadableSave({
  problems,
  onDiscard,
}: {
  problems: readonly string[]
  onDiscard: () => void
}) {
  const [open, setOpen] = useState(true)
  if (!open) return null
  return (
    <div
      role="alert"
      style={{
        position: "absolute",
        left: "3%",
        right: "3%",
        top: "3%",
        zIndex: STAGE_LAYER.alert,
        padding: "1em 1.2em",
        background: "#0b0c12",
        color: "#eeebe3",
        boxShadow: "0 0 0 3px #6b1723",
        fontSize: "calc(var(--u)*2.4)",
        fontWeight: 700,
        display: "grid",
        gap: ".6em",
      }}
    >
      <b style={{ fontSize: "1.3em" }}>保存データを読み込めませんでした</b>
      <span>今は新しく始めた状態で、保存はまだ上書きしていません。</span>
      <ul style={{ opacity: 0.75, maxHeight: "8em", overflow: "auto" }}>
        {problems.slice(0, 8).map((problem) => (
          <li key={problem}>・{problem}</li>
        ))}
      </ul>
      <span style={{ display: "flex", gap: "1em", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={onDiscard}
          style={{
            ...BUTTON_BASE,
            padding: ".3em .9em",
            background: "#6b1723",
            color: "#eeebe3",
          }}
        >
          古い保存を消して、はじめから遊ぶ
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          style={{
            ...BUTTON_BASE,
            padding: ".3em .9em",
            boxShadow: "inset 0 0 0 2px #eeebe3",
          }}
        >
          このまま（保存しない）
        </button>
      </span>
    </div>
  )
}

/** 仲間を選んでいる間、上の場面を暗くして下の札に目を向けさせる。押すと取りやめ。 */
function TargetDim({ request }: { request: TargetRequest }) {
  const formation = useFormation()
  // 取りやめは有限オートマトンが受け、依頼の onCancel を呼ぶ
  const cancel = () => formation.requestTarget(null)
  return (
    <motion.div
      className="target-dim"
      onClick={cancel}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      style={{
        ...REVERT,
        display: "block",
        position: "absolute",
        inset: 0,
        zIndex: STAGE_LAYER.dim,
        background: "rgb(7 6 12 / 0.62)",
        cursor: "pointer",
      }}
    >
      {request.details?.length ? (
        <div
          role="region"
          aria-label={request.detailLabel ?? "着替え後の比較"}
          onClick={(event) => event.stopPropagation()}
          style={{
            ...REVERT,
            position: "absolute",
            left: "50%",
            top: "20%",
            bottom: "22%",
            translate: "-50% 0",
            width: "90%",
            maxWidth: unit(110),
            overflowY: "auto",
            color: PALETTE.paper,
            fontSize: unit(3.4),
            lineHeight: 1.5,
            cursor: "auto",
          }}
        >
          {request.details.map((entry) => (
            <div
              key={entry.member}
              id={`target-detail-${entry.member}`}
              style={{
                ...REVERT,
                padding: `${unit(1.4)} ${unit(2)}`,
                marginBottom: unit(1),
                background: PALETTE.ink,
              }}
            >
              <b style={{ ...REVERT, display: "block", fontWeight: 800 }}>
                {entry.name}
              </b>
              <span style={{ ...REVERT }}>
                {entry.description.split("　").map((part) => (
                  <span
                    key={part}
                    style={{
                      ...REVERT,
                      display: "inline-block",
                      maxWidth: "100%",
                      marginRight: unit(2),
                      wordBreak: "keep-all",
                    }}
                  >
                    {part}
                  </span>
                ))}
              </span>
            </div>
          ))}
        </div>
      ) : null}
      <p
        style={{
          ...REVERT,
          position: "absolute",
          left: "50%",
          bottom: "6%",
          translate: "-50% 0",
          rotate: "-3deg",
          margin: 0,
          textAlign: "center",
          color: PALETTE.paper,
          whiteSpace: "nowrap",
        }}
      >
        <b
          style={{
            ...REVERT,
            display: "block",
            fontSize: unit(5),
            textShadow: `${unit(0.5)} ${unit(0.5)} 0 ${PALETTE.blood}`,
          }}
        >
          {request.label}
        </b>
        <span style={{ ...REVERT, fontSize: unit(2.6), fontWeight: 700 }}>
          下の仲間から選ぶ
        </span>
      </p>
      <button
        type="button"
        className="target-cancel"
        onClick={(event) => {
          event.stopPropagation()
          cancel()
        }}
        style={{
          ...BUTTON_BASE,
          position: "absolute",
          right: "4%",
          top: "6%",
          padding: "0.2em 0.9em",
          fontSize: unit(3.4),
          fontWeight: 800,
          color: PALETTE.ink,
          background: PALETTE.paper,
          clipPath: "polygon(6% 0, 100% 8%, 94% 100%, 0 90%)",
        }}
      >
        やめる
      </button>
    </motion.div>
  )
}
