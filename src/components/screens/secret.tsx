import { characterGroups } from "@/lib/concept/characters"
import { useLayoutEffect, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { useGame, useGameState } from "@/contexts/game"
import { GameCommandError, eventsOf, inPhase } from "@/lib/wiz"
import { ListView, type Row } from "@/components/game/list-view"
import { playEventConversation } from "@/components/game/event-conversation"
import { useVisitScene } from "@/components/game/event-conversation"
import {
  DEMON_ART,
  frameOf,
  personFor,
  sceneOf,
  placeIdOf,
} from "@/lib/content/looks"
import { IMG_BASE, REVERT } from "@/components/canvas/tokens"
import { play } from "@/components/canvas/play"
import { EASE_IN, EASE_OUT, MOTION_EASE, seconds } from "@/components/stage/kit"
import { useWide } from "@/components/stage/word"

const demonNames = new Map(
  characterGroups.flatMap((group) =>
    group.characters.map((character) => [character.id, character.name] as const)
  )
)

/** 悪魔に出会い、話してから素材と契約料を払う。仲間との会話と合体もここで選ぶ。 */
export function SecretRoom({
  keeper,
  onClose,
}: {
  keeper: HTMLElement | null
  onClose: () => void
}) {
  const game = useGame()
  const state = useGameState()
  const wide = useWide()
  const [open, setOpen] = useState(true)
  const [notice, setNotice] = useState(
    "まずは話そう。契約した後も、用事がなくても会いに来ていい。"
  )
  const owned = game.queries.demons(state)
  const candidates = game.queries.demonContracts(state)
  useVisitScene(placeIdOf("secret"), true)
  useLayoutEffect(() => {
    play(
      keeper,
      [{ opacity: 1 }, { opacity: 0, transform: "translateX(-80vw)" }],
      { duration: 300, easing: EASE_IN, fill: "both" }
    )
    return () => {
      play(
        keeper,
        [
          { opacity: 0, transform: "translateX(-80vw)" },
          { opacity: 1, transform: "rotate(-3deg)" },
        ],
        { duration: 500, easing: EASE_OUT, fill: "both" }
      )
    }
  }, [keeper])
  const available =
    !state.conversation?.active &&
    !state.wipe &&
    !state.hero.registrationPending
  const action = (row: Row) => {
    const [operation, id] = row.key.split(":")
    if (!available) return null
    if (operation === "resident")
      return game.queries.canStartConversation(state, "talk", { resident: id })
        ? "話す"
        : null
    if (operation === "talk")
      return owned.find((entry) => entry.id === id)?.canTalk ? "話す" : null
    if (operation === "choose")
      return owned.find((entry) => entry.id === id)?.active ? null : "合体する"
    if (operation === "waiting")
      return candidates.find((entry) => entry.id === id)?.canInvoke
        ? "もう一度話す"
        : null
    const candidate = candidates.find((entry) => entry.id === id)
    return candidate?.canContract
      ? "契約する"
      : candidate?.canInvoke
        ? candidate.called
          ? "もう一度話す"
          : "召喚する"
        : null
  }
  return (
    <AnimatePresence onExitComplete={onClose}>
      {open && (
        <motion.div
          key="secret"
          initial={{ clipPath: "circle(0% at 50% 50%)" }}
          animate={{
            clipPath: "circle(150% at 50% 50%)",
            transition: { duration: seconds(600), ease: MOTION_EASE.out },
          }}
          exit={{
            clipPath: "circle(0% at 50% 50%)",
            transition: { duration: seconds(420), ease: MOTION_EASE.in },
          }}
          style={{
            ...REVERT,
            position: "absolute",
            inset: 0,
            zIndex: 30,
            background: "#07060c",
            overflow: "hidden",
            pointerEvents: "auto",
          }}
        >
          <img
            src={sceneOf("secret", wide) ?? undefined}
            alt=""
            style={{
              ...IMG_BASE,
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              filter: "brightness(.35)",
            }}
          />
          <ListView
            title="悪魔との契約"
            kind="demon-contracts"
            gold={state.gold}
            detailLabel="悪魔の話と契約の条件"
            notice={<span role="status">{notice}</span>}
            tabs={[
              {
                name: "仲間と話す",
                rows: [
                  ...owned.map((demon) => ({
                    key: `talk:${demon.id}`,
                    icon: "demon",
                    image: DEMON_ART[demon.id]?.img,
                    name: demonNames.get(demon.id) ?? demon.name,
                    stat: demon.bond.label,
                    sub: `・会話 ${demon.bond.count}本`,
                    desc: `${DEMON_ART[demon.id]?.note ?? ""} 同じ話を繰り返しても親しさは変わらない。`,
                    badge: demon.active ? "合体中" : "",
                  })),
                  ...candidates
                    .filter((demon) => demon.called)
                    .map((demon) => ({
                      key: `waiting:${demon.id}`,
                      icon: "demon",
                      image: DEMON_ART[demon.id]?.img,
                      name: demonNames.get(demon.id) ?? demon.name,
                      stat: "契約前・また会える",
                      desc: `頼まれた品：${demon.materials.map((entry) => `${entry.name} ${entry.owned}/${entry.count}`).join("・")}。急がず探して、また話そう。`,
                    })),
                  {
                    key: `resident:${personFor("secret")}`,
                    icon: "demon",
                    image: frameOf(personFor("secret")).bust,
                    name: "部屋の番人",
                    stat: "秘密の部屋での話",
                    desc: "仲間や契約について、番人にも話を聞ける。",
                  },
                ],
              },
              {
                name: "合体する",
                rows: owned.map((demon) => ({
                  key: `choose:${demon.id}`,
                  icon: "demon",
                  image: DEMON_ART[demon.id]?.img,
                  name: demonNames.get(demon.id) ?? demon.name,
                  stat: `流派：${demon.schoolName ?? "なし"}`,
                  desc: `${DEMON_ART[demon.id]?.note ?? ""} ワザ：${demon.skills.map((id) => game.queries.skill(id)?.name ?? id).join("・")}`,
                  badge: demon.active ? "合体中" : "",
                })),
              },
              {
                name: "新しい出会い",
                rows: candidates.map((demon) => ({
                  key: `encounter:${demon.id}`,
                  icon: "demon",
                  image: DEMON_ART[demon.id]?.img,
                  name: demonNames.get(demon.id) ?? demon.name,
                  stat: demon.met
                    ? "話を聞いた・契約の準備"
                    : demon.called
                      ? "呼び出し済み・また会える"
                      : `${demon.paperName ?? "契約書"} ${demon.ownedPapers}枚`,
                  desc: demon.met
                    ? `頼まれた品：${demon.materials.map((entry) => `${entry.name} ${entry.owned}/${entry.count}`).join("・")}。契約料 ${demon.gold}G。世界地図で探そう。契約前でもまた話せる。`
                    : `${demon.paperName ?? "契約書"}で呼び出し、本人から契約の条件を聞こう。契約書は村や拠点で手に入る。${demon.unlock > 0 ? `${demon.unlock - 1}層突破と関わる仲間の加入も必要。` : ""}`,
                  badge: demon.canContract
                    ? "契約できる"
                    : demon.met
                      ? "素材と契約料を用意"
                      : "出会い",
                })),
              },
            ]}
            action={action}
            onAction={(row) => {
              const [operation, id] = row.key.split(":")
              if (operation === "talk" || operation === "resident") {
                void playEventConversation(game, "talk", undefined, {
                  resident: id,
                })
                return
              }
              if (
                operation === "waiting" ||
                (operation === "encounter" &&
                  !candidates.find((entry) => entry.id === id)?.canContract)
              ) {
                const result = inPhase(game, "town")?.invokeDemon(id)
                if (result instanceof GameCommandError)
                  setNotice("まだ呼び出せない。契約書と進行を確かめよう。")
                return
              }
              const result = eventsOf(
                operation === "choose"
                  ? inPhase(game, "town")?.chooseDemon(id)
                  : inPhase(game, "town")?.contractDemon(id)
              )
              if (
                result instanceof GameCommandError ||
                !Array.isArray(result)
              ) {
                setNotice("今はできない。契約の条件を確かめよう。")
                return
              }
              setNotice(
                `${game.queries.demonDef(id)?.name ?? "悪魔"}と${operation === "choose" ? "合体した" : "契約した。仲間と話すから、また会いに行こう"}。`
              )
            }}
            onClose={() => setOpen(false)}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
