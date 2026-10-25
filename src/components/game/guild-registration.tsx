import { useState } from "react"
import { motion } from "motion/react"
import { NameField } from "@/components/canvas/name-field"
import {
  BUTTON_BASE,
  IMG_BASE,
  PALETTE,
  REVERT,
  unit,
} from "@/components/canvas/tokens"
import { playEventConversation } from "@/components/game/event-conversation"
import { useNav } from "@/components/game/nav"
import { useGame, useGameState } from "@/contexts/game"
import { frameOf, personOf, placeIdOf } from "@/lib/content/looks"
import { GameCommandError, inPhase, katakanaOf } from "@/lib/wiz"
import { useWide } from "@/components/stage/word"
import { Solo } from "@/components/stage/solo"
import { Hand, type HandCard } from "@/components/stage/hand"

/**
 * ギルドの受付で渡される登録用紙。名前を書き、貼る写真（容姿）を選んで登録する。
 * 書きかけの名前と選んだ写真は登録するまでゲーム状態を書き換えない。
 * 登録できたら、受付で仲間の場面（登録直後の会話）と出撃前の案内を流す。はじめから遊ぶときは街はずれへ進む。
 */
export function GuildRegistration() {
  const game = useGame()
  const nav = useNav()
  const state = useGameState()
  const hero = game.queries.hero(state)
  const wide = useWide()
  const [name, setName] = useState("")
  const [look, setLook] = useState(hero.look)
  const [failed, setFailed] = useState(false)
  const accepted = game.queries.heroNameAccepted(name)
  const register = () => {
    if (!accepted) return setFailed(true)
    const result = inPhase(game, "town")?.registerHero(name, look)
    const rejected = !result || result instanceof GameCommandError
    setFailed(rejected)
    if (rejected) return
    // 受付の場所も来たときの場面を流すので、流れている会話が終わるまで待つ
    const settled = () =>
      new Promise<void>((resolve) => {
        if (!game.state.conversation?.active) return resolve()
        const unsubscribe = game.subscribe(() => {
          if (game.state.conversation?.active) return
          unsubscribe()
          resolve()
        })
      })
    void (async () => {
      // 登録直後の仲間の場面と、受付嬢の出撃前の案内を続けて流す
      for (let scene = 0; scene < 3; scene++) {
        await settled()
        const before = game.state
        await playEventConversation(game, "visit", undefined, {
          place: placeIdOf("reception"),
        })
        if (game.state === before && !game.state.conversation?.active) break
      }
      await settled()
      // はじめから遊ぶときは、そのまま街はずれの乗り場へ
      if (game.queries.prologue(game.state) === "depart")
        await nav.go({ name: "outskirts" })
    })()
  }
  // 記入の間は用紙だけを見せる（隊列・戻る・受付の人は引っ込める）
  // 手札の写真は横に並べ、貼った写真は手札から外す
  const hand: HandCard[] = hero.looks
    .filter(({ id }) => id !== look)
    .map(({ id }) => ({
      key: id,
      label: `写真 ${personOf(id)?.name ?? id} を貼る`,
      layoutId: photoLayoutId(id),
      children: <Photo look={id} />,
    }))
  // 記入の間は用紙だけを見せる（隊列・戻る・受付の人は引っ込める）。用紙を上、写真の手札を手元に置く
  return (
    <Solo>
      <div
        style={{
          ...REVERT,
          position: "absolute",
          inset: 0,
          display: "grid",
          gridTemplateRows: "minmax(0, 1fr) auto",
          justifyItems: "center",
          alignItems: "center",
          gap: unit(1),
          padding: `${unit(2)} ${wide ? "0" : "5%"} ${unit(1)}`,
        }}
      >
        <motion.div
          className="guild-registration"
          role="region"
          aria-label="冒険者の登録用紙"
          initial={{ opacity: 0, y: 40, rotate: 2 }}
          animate={{ opacity: 1, y: 0, rotate: -1 }}
          transition={{ duration: 0.36, ease: [0.34, 1.1, 0.64, 1] }}
          style={{
            ...REVERT,
            width: wide ? "min(56%, 720px)" : "100%",
            maxHeight: "100%",
            overflowY: "auto",
            overscrollBehavior: "contain",
            display: "grid",
            gap: unit(1.6),
            padding: `clamp(14px, ${unit(3)}, 28px)`,
            background: PALETTE.paper,
            color: PALETTE.ink,
            boxShadow: `${unit(1)} ${unit(1)} 0 ${PALETTE.ink}`,
            pointerEvents: "auto",
          }}
        >
          <strong
            style={{
              ...REVERT,
              display: "block",
              fontSize: `clamp(18px, ${unit(4)}, 30px)`,
              letterSpacing: ".2em",
              borderBottom: `3px solid ${PALETTE.ink}`,
              paddingBottom: unit(0.6),
            }}
          >
            冒険者 登録用紙
          </strong>
          <div
            style={{
              ...REVERT,
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) auto",
              gap: unit(2),
              alignItems: "start",
            }}
          >
            <div style={{ ...REVERT, display: "grid", gap: unit(1) }}>
              <NameField
                label="名前（カタカナ）"
                value={name}
                onChange={(next) => {
                  setName(next)
                  setFailed(false)
                }}
                normalize={katakanaOf}
                onSubmit={register}
                maxLength={hero.maxName}
                placeholder="カタカナで記入"
              />
              {failed ? (
                <span role="alert" style={{ ...REVERT, color: PALETTE.blood }}>
                  名前は全角カタカナ1〜{hero.maxName}文字で書いてください。
                </span>
              ) : null}
              <span style={{ ...REVERT, fontSize: "clamp(12px, 1.8vw, 15px)" }}>
                手元の写真を押すと貼り替えます。あとからも変えられます。
              </span>
            </div>
            <PhotoSlot look={look} />
          </div>
          <div
            aria-label="契約の内容"
            style={{
              ...REVERT,
              display: "grid",
              gap: unit(0.4),
              paddingTop: unit(1),
              borderTop: `1px solid ${PALETTE.stone}`,
              fontSize: "clamp(12px, 1.9vw, 16px)",
              lineHeight: 1.4,
            }}
          >
            <span style={{ ...REVERT, display: "block" }}>
              登録した冒険者は、次のことができます。
            </span>
            <ul
              style={{
                ...REVERT,
                display: "grid",
                gap: unit(0.2),
                margin: 0,
                paddingLeft: "1.2em",
              }}
            >
              {CAN_DO.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <strong
              style={{ ...REVERT, display: "block", color: PALETTE.blood }}
            >
              谷でのけが・死亡に、補償はありません。
            </strong>
          </div>
          <button
            type="button"
            className="word cta"
            aria-label="この内容で登録する"
            disabled={!accepted}
            onClick={register}
            style={{
              ...BUTTON_BASE,
              minHeight: 48,
              padding: "12px 16px",
              fontSize: "clamp(16px, 2.5vw, 24px)",
              fontWeight: 800,
              textAlign: "center",
              color: accepted ? PALETTE.paper : PALETTE.mist,
              background: accepted ? PALETTE.ink : PALETTE.stone,
              cursor: accepted ? "pointer" : "default",
            }}
          >
            この内容で登録する
          </button>
        </motion.div>
        <Hand
          label="手元の写真"
          cards={hand}
          cardWidth={cardWidthOf(wide)}
          onPlay={setLook}
          style={{
            width: "100%",
            // 札の高さ（幅×4/3と余白）に、扇の端の下がりと持ち上げの分を足す
            height: `calc(${cardWidthOf(wide)} * 1.5)`,
          }}
        />
      </div>
    </Solo>
  )
}

/** 用紙の下の契約の内容。登録した冒険者ができること。 */
const CAN_DO = [
  "ギルドの依頼を受け、報酬を受け取る",
  "冒険者を雇い、3人で谷へ潜る",
  "谷で拾った物を、鑑定して売る",
  "ギルドの宿に泊まる",
] as const

/** 手札の写真一枚の幅。縦長の画面は画面の幅に合わせ、横長は高さに合わせる。 */
function cardWidthOf(wide: boolean) {
  return wide ? "min(13vw, 17vh, 170px)" : "min(27vw, 19vh, 150px)"
}

/** 手札と写真欄で同じ写真を結ぶ名前（貼ると手札から飛んでいく）。 */
function photoLayoutId(look: string) {
  return `registration-photo-${look}`
}

/** 写真の絵。上半身の絵の顔のあたりを写す。 */
function PhotoImage({ look }: { look: string }) {
  const frame = frameOf(look)
  return (
    <img
      src={frame.bust ?? frame.img}
      alt=""
      draggable={false}
      style={{
        ...IMG_BASE,
        width: "100%",
        height: "100%",
        objectFit: "cover",
        objectPosition: "50% 0%",
        background: PALETTE.mist,
      }}
    />
  )
}

/** 用紙の写真欄。選んだ写真が貼られる。 */
function PhotoSlot({ look }: { look: string }) {
  return (
    <div
      aria-label={`貼った写真 ${personOf(look)?.name ?? look}`}
      role="img"
      style={{
        ...REVERT,
        display: "block",
        position: "relative",
        width: `clamp(96px, ${unit(24)}, 200px)`,
        aspectRatio: "3 / 4",
        border: `2px dashed ${PALETTE.stone}`,
        background: PALETTE.mist,
      }}
    >
      <motion.div
        key={look}
        layoutId={photoLayoutId(look)}
        initial={false}
        animate={{ rotate: 2 }}
        transition={{ type: "spring", stiffness: 380, damping: 28 }}
        style={{
          ...REVERT,
          display: "block",
          position: "absolute",
          inset: 3,
          overflow: "hidden",
          boxShadow: `0 0 0 2px ${PALETTE.ink}`,
        }}
      >
        <PhotoImage look={look} />
      </motion.div>
    </div>
  )
}

/** 手札の写真一枚。白い縁の付いた写真。 */
function Photo({ look }: { look: string }) {
  return (
    <span
      style={{
        ...REVERT,
        display: "block",
        padding: unit(0.6),
        paddingBottom: unit(1.6),
        background: "#fff",
        boxShadow: `0 0 0 1px ${PALETTE.stone}, ${unit(0.6)} ${unit(0.6)} 0 ${PALETTE.ink}`,
      }}
    >
      <span
        style={{
          ...REVERT,
          display: "block",
          aspectRatio: "3 / 4",
          overflow: "hidden",
        }}
      >
        <PhotoImage look={look} />
      </span>
    </span>
  )
}
