import { motion } from "motion/react"
import { useEffect, useRef } from "react"
import { CanvasImage } from "@/components/canvas/primitives"
import { goodImage } from "@/lib/concept/goods-art"
import { BUTTON_BASE } from "@/components/canvas/tokens"
import { RarityBadge } from "@/components/game/list-view"
import {
  NO_ATTACK_UPGRADE_MESSAGE,
  RANDOM_SKILL_MARK,
} from "@/components/game/gear-text"
import { TornLabel, TornPlate } from "@/components/canvas/paper"
import { COLOR, MOTION_EASE, seconds } from "@/components/stage/kit"

/** SR の掘り出し物の色。 */
const RARE_GOLD = "#b8901c"

export type AppraisalFind = {
  key: string
  /** 武器・防具の個体 id（道具は null）。 */
  gear: string | null
  /** 品物の id（一覧の絵）。 */
  good: string
  name: string
  rarity: string | null
  stat: string
  /** 防具・道具の特徴と装備条件。 */
  desc: string
  skills: readonly { name: string; uses: number | null; random: boolean }[]
  /** 到達した層より一つ先の段の品。 */
  bargain: boolean
  /** 武器か（武器だけ、持つと強くなる仲間を添える）。 */
  weapon: boolean
  /** いちばん攻撃力が上がる仲間。誰も上がらなければ null。 */
  upgrade: { name: string; before: number; after: number } | null
}

/**
 * 鑑定の結果の札。いちばん良い品の名前・レア度・ワザと、
 * 「誰が持つと何まで上がるか」を見せる。まとめて鑑定したときは内訳も添える。
 */
export function AppraisalCard({
  find,
  summary,
}: {
  find: AppraisalFind
  /** まとめて鑑定したときの内訳（「8個：SR 1・R 2」など）。 */
  summary?: string
}) {
  const gold = find.rarity === "SR"
  const image = goodImage(find.good)
  return (
    <motion.div
      key={find.key}
      initial={{ x: "60vw", rotate: 8, opacity: 0 }}
      animate={{ x: 0, rotate: -1.5, opacity: 1 }}
      transition={{ duration: seconds(380), ease: MOTION_EASE.pop }}
      style={{
        position: "relative",
        padding: "calc(var(--u)*1.6) calc(var(--u)*2.4)",
        color: COLOR.ink,
        fontWeight: 800,
        lineHeight: 1.35,
        filter: `drop-shadow(calc(var(--u)*.8) calc(var(--u)*.8) 0 ${gold ? RARE_GOLD : COLOR.blood})`,
      }}
    >
      <TornPlate
        background={COLOR.paper}
        clip="polygon(1% 4%, 100% 0, 98% 96%, 0 100%)"
      />
      <div style={{ position: "relative", display: "flow-root" }}>
        {image ? (
          <CanvasImage
            src={image}
            alt=""
            style={{
              float: "right",
              width: "24%",
              maxWidth: 180,
              aspectRatio: "3 / 4",
              objectFit: "contain",
              margin: "0 0 calc(var(--u)*1) calc(var(--u)*2)",
            }}
          />
        ) : null}
        {summary ? (
          <div
            style={{
              fontSize: "max(12px, calc(var(--u)*2.6))",
              color: COLOR.stone,
              marginBottom: "calc(var(--u)*.6)",
            }}
          >
            {summary}
          </div>
        ) : null}
        <div style={{ fontSize: "max(18px, calc(var(--u)*4))" }}>
          {find.rarity ? <RarityBadge rarity={find.rarity} size={3.4} /> : null}
          {find.name}
          {find.bargain ? (
            <TornLabel
              background={COLOR.blood}
              color={COLOR.paper}
              clip="polygon(4% 0,100% 12%,96% 100%,0 86%)"
              style={{
                marginLeft: ".5em",
                padding: "0 .5em",
                fontSize: "max(12px, calc(var(--u)*2.6))",
                verticalAlign: "middle",
              }}
            >
              掘り出し物
            </TornLabel>
          ) : null}
        </div>
        <div style={{ fontSize: "max(12px, calc(var(--u)*2.6))" }}>
          {find.stat}
        </div>
        {!find.weapon && find.desc ? (
          <div
            style={{
              marginTop: "calc(var(--u)*.6)",
              fontSize: "max(12px, calc(var(--u)*2.6))",
            }}
          >
            {find.desc}
          </div>
        ) : null}
        {find.skills.length ? (
          <div style={{ fontSize: "max(12px, calc(var(--u)*2.6))" }}>
            ワザ：
            {find.skills
              .map(
                (skill) =>
                  `${skill.random ? RANDOM_SKILL_MARK : ""}${skill.name}（${skill.uses ?? 0}回）`
              )
              .join("・")}
          </div>
        ) : null}
        {find.weapon ? (
          <div
            style={{
              marginTop: "calc(var(--u)*.6)",
              fontSize: "max(14px, calc(var(--u)*3))",
              color: find.upgrade ? COLOR.blood : COLOR.stone,
            }}
          >
            {find.upgrade
              ? `${find.upgrade.name}が持つと 攻撃力 ${find.upgrade.before} → ${find.upgrade.after}`
              : NO_ATTACK_UPGRADE_MESSAGE}
          </div>
        ) : null}
      </div>
    </motion.div>
  )
}

/**
 * 鑑定の直後に画面の中央へ出す結果の札。どこを押しても閉じ、一覧へ戻る。
 */
export function AppraisalReveal({
  find,
  summary,
  onClose,
}: {
  find: AppraisalFind
  summary?: string
  onClose: () => void
}) {
  const closeButton = useRef<HTMLButtonElement>(null)
  const previousFocus = useRef<HTMLElement | null>(null)
  useEffect(() => {
    const button = closeButton.current
    const root = button?.closest(".game")
    const previous = document.activeElement
    if (
      previous instanceof HTMLElement &&
      previous !== button &&
      previous !== document.body
    )
      previousFocus.current = previous
    button?.focus()
    return () => {
      queueMicrotask(() => {
        if (button?.isConnected) return
        if (previousFocus.current?.isConnected) previousFocus.current.focus()
        else
          Array.from(
            root?.querySelectorAll<HTMLButtonElement>(
              ".rows .slot-item.row:not([disabled])"
            ) ?? []
          )
            .find((row) => row.dataset.rowKey === find.key)
            ?.focus()
      })
    }
  }, [find.key])
  return (
    <motion.div
      role="dialog"
      aria-label="鑑定の結果"
      aria-modal="true"
      onClick={onClose}
      onKeyDown={(event) => {
        if (event.key === "Tab") {
          event.preventDefault()
          closeButton.current?.focus()
        }
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: seconds(160) }}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 40,
        display: "grid",
        placeItems: "center",
        background: "rgba(11,12,18,.55)",
        pointerEvents: "auto",
        cursor: "pointer",
      }}
    >
      <div
        style={{
          width: "min(92%, calc(var(--u)*110))",
          maxHeight: "90%",
          overflowY: "auto",
        }}
      >
        <AppraisalCard find={find} summary={summary} />
        <button
          type="button"
          ref={closeButton}
          data-modal-close
          onClick={(event) => {
            event.stopPropagation()
            onClose()
          }}
          style={{
            ...BUTTON_BASE,
            padding: "10px 14px",
            minHeight: 44,
            whiteSpace: "nowrap",
            margin: "calc(var(--u)*2) auto 0",
            color: COLOR.paper,
            fontWeight: 800,
            fontSize: "max(12px, calc(var(--u)*2.6))",
          }}
        >
          押して一覧へ
        </button>
      </div>
    </motion.div>
  )
}
