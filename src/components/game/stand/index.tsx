import { useLayoutEffect, useState } from "react"
import { motion } from "motion/react"
import { COLOR } from "@/components/stage/kit"
import { useStage } from "@/components/stage/stage-context"
import { useFx } from "@/components/stage/use-fx"
import { ListView } from "@/components/game/list-view"
import { useGame, useGameState } from "@/contexts/game"
import { REVERT } from "@/components/canvas/tokens"
import { play } from "@/components/canvas/play"
import { Stand } from "./member"
import { StandActions } from "./actions"
import { STAND_BARS } from "./constants"

function fadeUi(view: HTMLElement | null, to: number, ms: number) {
  for (const el of view?.querySelectorAll<HTMLElement>(":scope > .ui-layer") ??
    [])
    play(el, [{ opacity: to ? 0 : 1 }, { opacity: to }], {
      duration: ms,
      fill: "both",
    })
}

/** 立ち絵の舞台を開く／閉じる。カメラは寄りへカットし、街は暗く沈む。 */
export function StandView({
  id,
  onClose,
}: {
  id: string
  onClose: () => void
}) {
  const stage = useStage()
  const fx = useFx()
  const game = useGame()
  const state = useGameState()
  const [showSkills, setShowSkills] = useState(false)
  const member = game.queries.member(state, id)
  const commands = game.queries.commands(state, id)
  const skills = commands
    ? [
        ...commands.weaponSkills,
        ...commands.skills,
        ...(commands.blessing ? [commands.blessing] : []),
      ].filter(
        (skill, index, entries) =>
          entries.findIndex((entry) => entry.id === skill.id) === index
      )
    : []
  useLayoutEffect(() => {
    const saved = { ...stage.camera.cam }
    stage.camera.cut({ z: 1.35, r: -4, x: saved.x + 120, y: saved.y - 40 })
    fx.flash(COLOR.mist, 0.35)
    stage.bars(STAND_BARS)
    play(
      stage.set.current,
      [{ filter: "brightness(1)" }, { filter: "brightness(.3) saturate(.6)" }],
      { duration: 200, fill: "both" }
    )
    fadeUi(stage.canvas.current, 0, 160)
    void stage.camera.to(
      { z: 1.45, r: -5 },
      4000,
      (t) => 1 - Math.pow(1 - t, 4)
    )
    return () => {
      play(
        stage.set.current,
        [
          { filter: "brightness(.3) saturate(.6)" },
          { filter: "brightness(1)" },
        ],
        { duration: 300, fill: "both" }
      )
      fadeUi(stage.canvas.current, 1, 300)
      stage.bars(4)
      stage.camera.cut(saved)
      fx.flash(COLOR.mist, 0.25)
    }
  }, [stage, fx])
  return (
    <>
      {/* 後ろの場面（街・店の一覧）を沈める。押す操作は上の close-layer が受ける */}
      <motion.div
        className="stand-dim"
        aria-hidden="true"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        style={{
          ...REVERT,
          display: "block",
          position: "absolute",
          inset: 0,
          zIndex: 32,
          background: "rgb(7 6 12 / 0.72)",
          pointerEvents: "none",
        }}
      />
      <button
        type="button"
        className="close-layer"
        aria-label="立ち絵を閉じる"
        style={{
          ...REVERT,
          display: "block",
          position: "absolute",
          inset: 0,
          zIndex: 35,
          border: 0,
          padding: 0,
          background: "none",
          cursor: "pointer",
        }}
        onClick={onClose}
      />
      <Stand key={id} id={id} onSkills={() => setShowSkills(true)} />
      <StandActions key={`actions-${id}`} id={id} onClose={onClose} />
      {showSkills && member ? (
        <div style={{ position: "absolute", inset: 0, zIndex: 40 }}>
          <ListView
            title={`${member.name}のワザの残り`}
            detailLabel="選んだワザの詳細"
            notice={
              skills.some((skill) => skill.left === 0)
                ? `使い切ったワザ：${skills.filter((skill) => skill.left === 0).length}個。休息や素材で補充できる。`
                : undefined
            }
            tabs={[
              {
                name: "ワザ",
                rows: skills.map((skill) => ({
                  key: skill.id,
                  icon:
                    skill.kind === "hit"
                      ? "sword"
                      : skill.kind === "heal"
                        ? "potion"
                        : "crystal",
                  name: skill.name,
                  badge:
                    skill.left === null
                      ? "制限なし"
                      : `残り ${skill.left}/${skill.uses}回`,
                  stat:
                    skill.left === null
                      ? "回数制限なし"
                      : `残り ${skill.left}/${skill.uses}回`,
                  desc: [
                    commands?.blessing?.id === skill.id
                      ? "この探索中だけ有効な祝福。帰還すると消える。"
                      : "",
                    skill.desc,
                    skill.reach
                      ? `射程：${skill.reach === "melee" ? "近接" : "遠距離"}`
                      : "",
                    skill.weak ? "後衛からの近接：与える被害が減る" : "",
                    skill.cost > 0
                      ? `使用時にHP（生命力） ${skill.cost}を消費`
                      : "",
                    skill.cost > 0 && member.hp > 0 && member.hp <= skill.cost
                      ? "HPが足りず使えない（消費後にHPが1以上必要）"
                      : "",
                    skill.blocked ? "流派が合わず使えない" : "",
                    member.hp === 0 ? "戦闘不能（復活するまで使えない）" : "",
                    skill.left === 0
                      ? "残り回数がない。休息や素材で補充できる。"
                      : "",
                  ]
                    .filter(Boolean)
                    .join("\n"),
                })),
              },
            ]}
            onClose={() => setShowSkills(false)}
          />
        </div>
      ) : null}
    </>
  )
}
