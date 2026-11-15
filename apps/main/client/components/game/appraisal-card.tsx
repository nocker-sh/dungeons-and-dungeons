import { motion } from "motion/react"
import { CanvasImage } from "@/client/components/canvas/canvas-image"
import { goodImage } from "@/concept/goods-art"
import { RarityBadge } from "@/client/components/game/list-view/rarity-badge"
import { NO_ATTACK_UPGRADE_MESSAGE } from "@/client/components/game/gear-text"
import { RANDOM_SKILL_MARK } from "@/client/components/game/gear-desc"
import { TornLabel } from "@/client/components/canvas/torn-label"
import { TornPlate } from "@/client/components/canvas/torn-plate"
import { COLOR, MOTION_EASE } from "@/client/components/stage/kit"
import { seconds } from "@/client/components/stage/seconds"
import type { AppraisalFind } from "@/client/components/game/appraisal-card-shared"

/** SR の掘り出し物の色。 */
export const RARE_GOLD = "#b8901c"

/**
 * 鑑定の結果の札。いちばん良い品の名前・レア度・ワザと、
 * 「誰が持つと何まで上がるか」を見せる。まとめて鑑定したときは内訳も添える。
 */
type Props = {
  find: AppraisalFind
  /** まとめて鑑定したときの内訳（「8個：SR 1・R 2」など）。 */
  summary?: string
}

export function AppraisalCard(props: Props) {
  const gold = props.find.rarity === "SR"
  const image = goodImage(props.find.good)
  return (
    <motion.div
      key={props.find.key}
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
        {props.summary ? (
          <div
            style={{
              fontSize: "max(12px, calc(var(--u)*2.6))",
              color: COLOR.stone,
              marginBottom: "calc(var(--u)*.6)",
            }}
          >
            {props.summary}
          </div>
        ) : null}
        <div style={{ fontSize: "max(18px, calc(var(--u)*4))" }}>
          {props.find.rarity ? (
            <RarityBadge rarity={props.find.rarity} size={3.4} />
          ) : null}
          {props.find.name}
          {props.find.bargain ? (
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
          {props.find.stat}
        </div>
        {!props.find.weapon && props.find.desc ? (
          <div
            style={{
              marginTop: "calc(var(--u)*.6)",
              fontSize: "max(12px, calc(var(--u)*2.6))",
            }}
          >
            {props.find.desc}
          </div>
        ) : null}
        {props.find.skills.length ? (
          <div style={{ fontSize: "max(12px, calc(var(--u)*2.6))" }}>
            ワザ：
            {props.find.skills
              .map(
                (skill) =>
                  `${skill.random ? RANDOM_SKILL_MARK : ""}${skill.name}（${skill.uses ?? 0}回）`
              )
              .join("・")}
          </div>
        ) : null}
        {props.find.weapon ? (
          <div
            style={{
              marginTop: "calc(var(--u)*.6)",
              fontSize: "max(14px, calc(var(--u)*3))",
              color: props.find.upgrade ? COLOR.blood : COLOR.stone,
            }}
          >
            {props.find.upgrade
              ? `${props.find.upgrade.name}が持つと 攻撃力 ${props.find.upgrade.before} → ${props.find.upgrade.after}`
              : NO_ATTACK_UPGRADE_MESSAGE}
          </div>
        ) : null}
      </div>
    </motion.div>
  )
}
