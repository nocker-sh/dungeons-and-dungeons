import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence } from "motion/react"
import { foeAppearance } from "@/lib/content/foe-appearance"
import { battleSceneOf } from "@/lib/content/looks"
import { useFormation } from "@/components/game/formation"
import { TurnArrow } from "@/components/game/turn-arrow"
import { useNav } from "@/components/game/nav"
import { isAborted } from "@/components/stage/kit"
import { useStage } from "@/components/stage/stage-context"
import { useFx } from "@/components/stage/use-fx"
import { useWide } from "@/components/stage/word"
import { useGame, useGameState } from "@/contexts/game"
import { CommandMenu } from "@/components/screens/battle/command-menu"
import { BattleDirector } from "@/components/screens/battle/director"
import { Foes } from "@/components/screens/battle/foes"
import { Order } from "@/components/screens/battle/order"
import { BattleParts } from "@/components/screens/battle/parts"
import { Peek } from "@/components/screens/battle/peek"
import { Picker } from "@/components/screens/battle/picker"
import { useBattleTurns } from "@/components/screens/battle/turns"
import {
  skillNote,
  type BattlePhase,
  type BattleView,
  type FoeAttack,
  type Menu,
} from "@/components/screens/battle/types"

/**
 * 戦闘。エンカウント → 敵が落ちてくる → 行動順は速さで決まり、左上のリボルバーに並ぶ。
 * 手番の仲間に指示し、1行動ごとに1つの結果を見せる。敵が複数なら押して狙いを選ぶ。
 */
export function Battle({
  onEnd,
}: {
  onEnd: (result: "victory" | "defeat") => void
}) {
  const game = useGame()
  const state = useGameState()
  const stage = useStage()
  const fx = useFx()
  const formation = useFormation()
  const nav = useNav()
  const wide = useWide()
  const live = game.queries.battle(state)
  const last = useRef<BattleView | null>(live)
  if (live) last.current = live
  const view = last.current
  // 戦う場所はエンジンの Query、絵は作品のデータが決める
  const scene = view ? battleSceneOf(view.place, wide) : null
  const [phase, setPhase] = useState<BattlePhase>("intro")
  const [menu, setMenu] = useState<Menu>(null)
  const [selected, setSelected] = useState(0)
  const [shownHp, setShownHp] = useState<Record<string, number>>(() =>
    Object.fromEntries((view?.foes ?? []).map((foe) => [foe.id, foe.hp]))
  )
  const [gone, setGone] = useState<string[]>(() =>
    (view?.foes ?? []).filter((foe) => foe.hp <= 0).map((foe) => foe.id)
  )
  const [target, setTarget] = useState<string | null>(null)
  const [peek, setPeek] = useState<string | null>(null)
  const [settled, setSettled] = useState(0)
  const [attacking, setAttacking] = useState<FoeAttack | null>(null)
  const parts = useMemo(
    () => new BattleParts(fx, formation.cards),
    [fx, formation.cards]
  )
  const abort = useRef(new AbortController())
  const signalOf = useCallback(() => abort.current.signal, [])

  const livingFoes = (view?.foes ?? []).filter((foe) => foe.hp > 0)
  const aim =
    livingFoes.find((foe) => foe.id === target)?.id ?? livingFoes[0]?.id ?? null

  const current = live?.current ?? null
  const actorId = current?.kind === "member" ? current.id : null

  // 再生の順序（演出）と、入力（指示を送る）を分けて持つ
  const director = new BattleDirector({
    game,
    fx,
    stage,
    nav,
    formation,
    parts,
    view,
    scene,
    gone,
    shownHp,
    signal: signalOf,
    onEnd,
    setPhase,
    setMenu,
    setPeek,
    setShownHp,
    setGone,
  })
  const { act, foeTurn, busy } = useBattleTurns({
    game,
    fx,
    wide,
    formation,
    parts,
    director,
    signal: signalOf,
    actorId,
    aim,
    current,
    setMenu,
    setAttacking,
    setSettled,
  })

  // エンジンの結果は即時に確定する。行動順の表示だけは演出完了まで保つ。
  const shownOrder = useRef(view)
  if (!busy.current && view) shownOrder.current = view

  // 差分の絵は先に読んでおく（切り替えた瞬間に出るように）
  useEffect(() => {
    for (const foe of view?.foes ?? []) {
      const art = foeAppearance(foe.foe, foe.appearanceId)
      for (const image of [
        ...(art?.attacks ?? []),
        ...Object.values(art?.skills ?? {}),
        art?.sleeping,
        art?.attack,
        art?.defeated,
      ]) {
        if (image) new Image().src = image
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 戦闘中に画面の向きが変わったら、その向きの戦闘背景へ（最初の差し替えは突入の演出が行う）
  const shownScene = useRef(scene)
  useEffect(() => {
    if (shownScene.current === scene) return
    shownScene.current = scene
    if (scene) void stage.art(scene)
  }, [scene, stage])

  // 戦闘中に隊列を押すと詳細
  useEffect(() => {
    formation.setPress((id) =>
      setPeek((current) => (current === id ? null : id))
    )
    return () => formation.setPress(null)
  }, [formation.setPress])
  useEffect(() => formation.lift(peek), [peek])

  // 突入：閃光、ぶれ、景色が暗く寄る → 敵が落ちてくる
  useEffect(() => {
    abort.current = new AbortController()
    director.intro(abort.current.signal).catch((error) => {
      if (!isAborted(error)) throw error
    })
    const controller = abort.current
    return () => {
      controller.abort()
      director.leave()
    }
    // 始まりだけ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const commands = actorId ? game.queries.commands(state, actorId) : null
  // いま選んでいる手。矢印の形（近接・遠距離・全体）と、出すかどうかを決める
  const armed = !commands
    ? null
    : menu === "command"
      ? ([
          ...commands.weaponSkills,
          ...(commands.blessing ? [commands.blessing] : []),
        ][selected] ?? null)
      : menu === "skill"
        ? (commands.skills[selected] ?? null)
        : menu === "item"
          ? (commands.items[selected] ?? null)
          : null
  const arrowStyle =
    armed && "reach" in armed && armed.reach === "ranged" ? "ranged" : "melee"
  // 手番の仲間の札 → 狙う敵 の矢印
  const arrowFrom = useCallback(() => {
    const index = actorId ? game.state.party.indexOf(actorId) : -1
    return formation.cards.card(index)
  }, [actorId, game, formation.cards])
  // 全体のワザは生きている敵すべてへ
  const allFoes = armed?.target === "foes"
  const arrowTo = useCallback(() => {
    const ids = allFoes
      ? (game.queries.battle(game.state)?.foes ?? [])
          .filter((foe) => foe.hp > 0)
          .map((foe) => foe.id)
      : aim
        ? [aim]
        : []
    return ids.flatMap((id) => {
      const element = parts.foe(id)
      return element ? [element] : []
    })
  }, [aim, allFoes, game, parts])

  // 手番の仲間は絵が上がる。指示は使える武器のワザから選び始める
  useEffect(() => {
    if (phase !== "fight" || busy.current) return
    if (actorId && !peek) formation.lift(actorId)
    if (actorId) {
      setMenu("command")
      const commands = game.queries.commands(game.state, actorId)
      const skills = commands
        ? [
            ...commands.weaponSkills,
            ...(commands.blessing ? [commands.blessing] : []),
          ]
        : []
      const first = skills?.findIndex((skill) => skill.usable) ?? -1
      setSelected(first < 0 ? 0 : first)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actorId, phase, live?.turn, settled])

  // 敵の手番は自動で進む
  useEffect(() => {
    if (phase !== "fight" || !current || current.kind !== "foe" || busy.current)
      return
    void foeTurn()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, live?.turn, current?.kind, settled])

  // 指示の板は AnimatePresence が外へ飛ばす（次の板は出ていってから）。指示はすぐ送る
  const switchMenu = (next: Menu, then?: () => void) => {
    setMenu(next)
    then?.()
  }

  if (!view) return null
  const hero = actorId ? game.queries.member(state, actorId)?.hero : false
  const choosing =
    phase === "fight" &&
    !!actorId &&
    (menu === "command" || menu === "skill" || menu === "item") &&
    livingFoes.length > 0
  /** 武器のワザ・祝福を放つ。味方ひとりに使う手は、下の仲間の札から選ぶ。 */
  const castWeaponSkill = (skill: string) => {
    if (!commands) return
    const entry = [
      ...commands.weaponSkills,
      ...(commands.blessing ? [commands.blessing] : []),
    ].find((entry) => entry.id === skill)
    if (!entry?.usable) return
    const send = (target?: string) =>
      void act({ command: "skill", skill, target })
    if (entry.target !== "ally") return switchMenu(null, send)
    const eligible = game.queries
      .party(game.state)
      .filter((member) => (entry.revive ? member.hp <= 0 : member.hp > 0))
      .map((member) => member.id)
    if (!eligible.length) return
    switchMenu(null, () =>
      formation.requestTarget({
        eligible,
        label: `${entry.name}を誰に？`,
        onPick: send,
        onCancel: () => setMenu("command"),
      })
    )
  }
  /** スキル・アイテムの一覧から選んだ手を使う。 */
  const pick = (list: "skill" | "item", key: string) => {
    if (!commands) return
    const entry =
      list === "skill"
        ? commands.skills.find((skill) => skill.id === key)
        : commands.items.find((item) => item.id === key)
    const send = (target?: string) =>
      list === "skill"
        ? void act({ command: "skill", skill: key, target })
        : void act({ command: "item", good: key, target })
    // 味方ひとりに使う手は、下の仲間の札から選ぶ
    if (entry?.target !== "ally") return send()
    // 効く相手はエンジンが決める（ワザは生きている仲間、道具は効く仲間だけ）
    const eligible =
      "targets" in entry
        ? entry.targets
        : game.queries
            .party(game.state)
            .filter((member) => (entry.revive ? member.hp <= 0 : member.hp > 0))
            .map((member) => member.id)
    if (!eligible.length) {
      fx.shake(0.6)
      return setMenu("command")
    }
    // 誰に使うかを選ぶ間は、この一覧を外へ引かせる（やめたら戻す）
    setMenu(null)
    formation.requestTarget({
      eligible,
      label: `${entry.name}を誰に？`,
      onPick: (member) => send(member),
      onCancel: () => setMenu(list),
    })
  }
  /** 狙っている敵を押した（決定した）とき、選んでいる手を放つ。 */
  const fire = () => {
    if (!commands) return
    if (menu === "command") {
      const skill = [
        ...commands.weaponSkills,
        ...(commands.blessing ? [commands.blessing] : []),
      ][selected]
      if (skill?.usable) return castWeaponSkill(skill.id)
    }
    if (menu === "skill" || menu === "item") {
      const entry =
        menu === "skill" ? commands.skills[selected] : commands.items[selected]
      if (entry?.usable) return pick(menu, entry.id)
    }
    fx.shake(0.6)
  }
  return (
    <>
      {phase !== "intro" ? (
        <Foes
          view={view}
          wide={wide}
          parts={parts}
          shownHp={shownHp}
          gone={gone}
          attacking={attacking}
          choosing={choosing}
          aim={aim}
          onAim={setTarget}
          onFire={fire}
        />
      ) : null}
      {phase === "fight" && live ? (
        <Order view={shownOrder.current ?? live} />
      ) : null}
      {phase === "fight" &&
      actorId &&
      aim &&
      menu !== null &&
      (armed?.target === "foe" || armed?.target === "foes") &&
      !formation.target &&
      !peek ? (
        <TurnArrow
          key={`${actorId}-${aim}-${arrowStyle}-${allFoes}`}
          from={arrowFrom}
          to={arrowTo}
          arrowStyle={arrowStyle}
        />
      ) : null}
      {/* 指示と一覧は同時に出さない。前の板が出ていってから次が入る */}
      <AnimatePresence mode="wait">
        {phase === "fight" && actorId && commands && menu === "command" ? (
          <CommandMenu
            key={`cmd-${live?.turn}-${settled}`}
            commands={commands}
            hero={hero}
            wide={wide}
            selected={selected}
            onSelect={setSelected}
            onWeaponSkill={castWeaponSkill}
            onSkills={() => {
              setSelected(0)
              switchMenu("skill")
            }}
            onGuard={() =>
              switchMenu(null, () => void act({ command: "guard" }))
            }
            onItems={() => {
              setSelected(0)
              switchMenu("item")
            }}
            onBrawl={() =>
              switchMenu(null, () => void act({ command: "brawl" }))
            }
            onPact={() => {
              const first = commands.pact?.findIndex((mode) => mode.usable)
              setSelected(first === undefined || first < 0 ? 0 : first)
              switchMenu("pact")
            }}
          />
        ) : null}
        {phase === "fight" && commands?.pact && menu === "pact" ? (
          <Picker
            key="pact"
            kind="pact"
            items={commands.pact.map((mode) => ({
              key: String(mode.index),
              no: mode.index + 1,
              unit: `/${commands.pact!.length}`,
              name: mode.name,
              note: mode.current
                ? "いまのモード"
                : mode.open
                  ? `${mode.roleName}：${mode.combatStyle || mode.skills.join("・")}`
                  : `Lv${mode.level}で契約できる`,
              locked: !mode.usable,
            }))}
            selected={selected}
            onSelect={setSelected}
            onBack={() => setMenu("command")}
            onPick={(key) => void act({ command: "pact", mode: Number(key) })}
          />
        ) : null}
        {phase === "fight" &&
        commands &&
        (menu === "skill" || menu === "item") ? (
          <Picker
            key={menu}
            kind={menu}
            items={
              menu === "skill"
                ? commands.skills.map((skill) => ({
                    key: skill.id,
                    no: skill.left ?? 0,
                    unit: `/${skill.uses ?? 0}`,
                    name: skill.name,
                    note: skillNote(skill),
                    locked: !skill.usable,
                  }))
                : commands.items.map((item) => ({
                    key: item.id,
                    no: item.count,
                    unit: "個",
                    name: item.name,
                    note: item.desc,
                    locked: !item.usable,
                  }))
            }
            selected={selected}
            onSelect={setSelected}
            onBack={() => setMenu("command")}
            onPick={(key) => pick(menu, key)}
          />
        ) : null}
      </AnimatePresence>
      {peek ? <Peek id={peek} onClose={() => setPeek(null)} /> : null}
    </>
  )
}
