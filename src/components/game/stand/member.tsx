import { useLayoutEffect, useRef, type ReactNode } from "react"
import { frameOf } from "@/lib/content/looks"
import { COLOR, EASE_IN, EASE_OUT } from "@/components/stage/kit"
import { useWide } from "@/components/stage/word"
import { RarityBadge } from "@/components/game/list-view"
import { useGame, useGameState } from "@/contexts/game"
import { BUTTON_BASE, IMG_BASE, REVERT } from "@/components/canvas/tokens"
import { play } from "@/components/canvas/play"

/** ステータスの1行。項目どうしの間をあけて右へ並べ、入りきらなければ折り返す。 */
function StatRow({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "flex-end",
        alignItems: "baseline",
        gap: "0 calc(var(--u)*2.4)",
      }}
    >
      {children}
    </div>
  )
}

/** 項目ひとつ。見出しのあとに値を置き、途中で折り返さない。 */
function Stat({
  label,
  size = 1.5,
  color = COLOR.mist,
  wrap = false,
  children,
}: {
  label: string
  /** 値の大きさ（見出しに対する倍率）。 */
  size?: number
  color?: string
  wrap?: boolean
  children: ReactNode
}) {
  return (
    <span style={{ whiteSpace: wrap ? "normal" : "nowrap" }}>
      {label} <span style={{ color, fontSize: `${size}em` }}>{children}</span>
    </span>
  )
}

export function Stand({ id, onSkills }: { id: string; onSkills: () => void }) {
  const game = useGame()
  const state = useGameState()
  const wide = useWide()
  const member = game.queries.member(state, id)
  const slab = useRef<HTMLDivElement>(null)
  const stand = useRef<HTMLDivElement>(null)
  const info = useRef<HTMLDivElement>(null)
  const frame = frameOf(
    game.queries.look(state, id),
    member?.hero ? member.outfit : member?.armor?.good,
    member?.pact?.find((mode) => mode.current)?.index
  )
  useLayoutEffect(() => {
    const viewportHeight = innerHeight
    play(
      slab.current,
      [
        { transform: `translateY(${viewportHeight}px) rotate(-4deg)` },
        {
          transform: `translateY(${-viewportHeight * 0.03}px) rotate(-1deg)`,
          offset: 0.7,
        },
        { transform: "rotate(-2deg)" },
      ],
      { duration: 600, easing: EASE_OUT, fill: "both" }
    )
    play(
      stand.current,
      [
        { transform: `translateY(${viewportHeight}px) rotate(6deg)` },
        {
          transform: `translateY(${-viewportHeight * 0.04}px) rotate(-1deg)`,
          offset: 0.7,
        },
        { transform: "rotate(0deg)" },
      ],
      { duration: 650, delay: 80, easing: EASE_OUT, fill: "both" }
    )
    play(
      stand.current?.firstElementChild,
      [
        { translate: `calc(${frame.fx} * -100%) 0` },
        { translate: `calc(${frame.fx} * -100%) -1.2%` },
        { translate: `calc(${frame.fx} * -100%) 0` },
      ],
      { duration: 3400, delay: 800, iterations: Infinity }
    )
    play(
      info.current,
      [{ transform: "translateX(80vw) rotate(8deg)" }, { transform: "none" }],
      { duration: 520, delay: 120, easing: EASE_OUT, fill: "both" }
    )
    const parts = [slab.current, stand.current]
    return () => {
      for (const el of parts)
        if (el)
          play(
            el,
            [
              { transform: getComputedStyle(el).transform },
              { transform: "translateY(110%)" },
            ],
            { duration: 220, easing: EASE_IN, fill: "both" }
          )
    }
  }, [frame.fx])
  if (!member) return null
  const demon = member.hero ? game.queries.demon(state) : null
  return (
    <>
      <div
        ref={slab}
        className="slab"
        aria-hidden="true"
        style={{
          ...REVERT,
          position: "absolute",
          background: `linear-gradient(170deg, ${COLOR.mist} 50%, ${frame.color})`,
          ...(wide
            ? {
                left: "10%",
                width: "30%",
                top: "8%",
                height: "96%",
                clipPath: "polygon(14% 0, 100% 0, 86% 100%, 0 100%)",
              }
            : {
                left: "4%",
                width: "60%",
                top: "6%",
                height: "96%",
                clipPath: "polygon(16% 0, 100% 0, 84% 100%, 0 100%)",
              }),
          zIndex: 33,
        }}
      />
      <div
        ref={stand}
        className="stand"
        aria-hidden="true"
        style={{
          ...REVERT,
          position: "absolute",
          bottom: 0,
          pointerEvents: "none",
          left: wide ? "25%" : "42%",
          top: wide ? "10%" : "37%",
          height: `${wide ? 90 : 62}%`,
          width: 0,
          zIndex: 34,
        }}
      >
        <img
          src={frame.img}
          alt=""
          style={{
            ...IMG_BASE,
            position: "absolute",
            top: 0,
            left: 0,
            height: "100%",
            translate: `calc(${frame.fx} * -100%) 0`,
            filter: `drop-shadow(calc(var(--u)*1.4) calc(var(--u)*1.4) 0 ${COLOR.ink})`,
          }}
        />
      </div>
      <div
        ref={info}
        style={{
          position: "absolute",
          right: wide ? "5%" : "3%",
          top: wide ? "8%" : "5%",
          width: wide ? "44%" : "62%",
          padding: "calc(var(--u)*2) calc(var(--u)*2.4)",
          // 立ち絵の上でも読めるように、文字は墨の下地に乗せる
          background: "rgb(11 12 18 / 0.84)",
          clipPath: "polygon(1% 3%, 100% 0, 99% 98%, 0 100%)",
          textAlign: "right",
          pointerEvents: "none",
          zIndex: 36,
        }}
      >
        <button
          type="button"
          style={{
            ...BUTTON_BASE,
            pointerEvents: "auto",
            marginBottom: 8,
            padding: "6px 10px",
            fontSize: 13,
          }}
          onClick={onSkills}
        >
          ワザの残りを見る
        </button>
        <div
          style={{
            fontSize: "calc(var(--u)*2.2)",
            letterSpacing: ".3em",
            color: COLOR.sage,
          }}
        >
          {member.row === "front" ? "前衛" : "後衛"}／{member.roleName}／
          {member.job}
          {member.pact
            ? `／ケイヤク：${member.pact.find((mode) => mode.current)?.name ?? ""}`
            : member.fixedArmor
              ? "／装備は変えられない"
              : member.unique
                ? "／専用の武器"
                : ""}
        </div>
        <div
          style={{
            fontSize: `calc(var(--u)*${wide ? 11 : 10})`,
            lineHeight: 1.05,
            color: COLOR.mist,
            textShadow: `calc(var(--u)*1) calc(var(--u)*1) 0 ${COLOR.ink}`,
          }}
        >
          {member.name}
        </div>
        <div
          style={{
            fontSize: `calc(var(--u)*${wide ? 6 : 5.5})`,
            lineHeight: 1,
            color: COLOR.sage,
          }}
        >
          <small style={{ fontSize: ".4em", color: COLOR.stone }}>
            {member.hero ? "悪魔 Lv" : "Lv"}
          </small>
          {member.hero ? (demon?.lv ?? 1) : member.lv}
        </div>
        <div
          data-stand-stats
          style={{
            marginTop: "calc(var(--u)*1.4)",
            display: "grid",
            gap: "calc(var(--u)*.4)",
            fontSize: "max(10px, calc(var(--u)*2.05))",
            lineHeight: 1.35,
            color: COLOR.stone,
          }}
        >
          <StatRow>
            <Stat label="筋力">{member.str}</Stat>
            <Stat label="技量">{member.tec}</Stat>
            <Stat label="速さ">{member.spd}</Stat>
            <Stat label="役割" size={1} wrap>
              {member.combatStyle}
            </Stat>
            {member.hero ? (
              <Stat label="成長">悪魔の力</Stat>
            ) : (
              <Stat label="成長">{member.growthTypeName}</Stat>
            )}
          </StatRow>
          <StatRow>
            <Stat label="探索" size={1} wrap>
              {member.exploration}
            </Stat>
          </StatRow>
          {member.weapon ? (
            <StatRow>
              <Stat label="攻撃力">{member.weapon.attack}</Stat>
              <Stat label="得意" size={1}>
                {member.favoriteName}
              </Stat>
              {member.weapon.met ? null : (
                <span
                  data-stand-weapon-short
                  style={{ color: COLOR.paper, fontSize: "max(11px, 1em)" }}
                >
                  {[
                    member.weapon.short.str
                      ? `筋力 ${member.weapon.short.str}不足`
                      : null,
                    member.weapon.short.tec
                      ? `技量 ${member.weapon.short.tec}不足`
                      : null,
                  ]
                    .filter(Boolean)
                    .join("・")}
                </span>
              )}
            </StatRow>
          ) : null}
          <StatRow>
            {member.hero ? null : (
              <Stat label="経験" size={1.3}>
                {member.exp}
                <span style={{ fontSize: ".72em" }}>/{member.next}</span>
              </Stat>
            )}
            <Stat label="疲れ" size={1.3}>
              {member.fatigue}
            </Stat>
            <Stat label="汚れ" size={1.3}>
              {member.dirt}
            </Stat>
          </StatRow>
          {member.bond ? (
            <StatRow>
              <Stat label="関係" size={1}>
                {member.bond.label}
              </Stat>
            </StatRow>
          ) : null}
          {member.levelUpReady ? (
            <div
              data-stand-level-up
              role="status"
              style={{
                ...REVERT,
                marginTop: 6,
                padding: "6px 8px",
                background: COLOR.paper,
                color: COLOR.ink,
                fontSize: "max(11px, calc(var(--u)*2.4))",
                lineHeight: 1.5,
                fontWeight: 800,
              }}
            >
              {member.row === null ? "出撃の3人に入れて、" : ""}
              宿の普通の部屋・高い部屋で
              <span style={{ whiteSpace: "nowrap" }}>レベルアップ</span>
            </div>
          ) : null}
          <StatRow>
            <Stat label="流派">
              {member.schoolNames.length
                ? member.schoolNames.join("・")
                : "なし"}
            </Stat>
            {member.affinityName ? (
              <Stat label="相性◎" size={1} color={COLOR.sage}>
                {member.affinityName}
              </Stat>
            ) : null}
          </StatRow>
          {demon ? (
            <div>
              契約：
              <span style={{ color: COLOR.mist, fontSize: "1.3em" }}>
                {demon.name}
                {demon.schoolName ? `（流派：${demon.schoolName}）` : ""}
              </span>
            </div>
          ) : null}
          {member.fusion ? (
            <div
              data-stand-fusion
              style={{ fontSize: "max(11px, calc(var(--u)*2.05))" }}
            >
              合体の効果：
              <span style={{ color: COLOR.mist, fontSize: "1.3em" }}>
                {[
                  member.fusion.attackPercent
                    ? `攻撃力 +${member.fusion.attackPercent}%`
                    : null,
                  member.fusion.maxHp ? `HP +${member.fusion.maxHp}` : null,
                  ...member.fusion.resist.map((entry) =>
                    entry.immune
                      ? entry.label
                      : `${entry.name}耐性 ${entry.percent}%`
                  ),
                ]
                  .filter(Boolean)
                  .join("・")}
              </span>
            </div>
          ) : null}
          <div
            data-stand-weapon
            style={{ fontSize: "max(11px, calc(var(--u)*2.05))" }}
          >
            武器：
            <span style={{ color: COLOR.mist, fontSize: "1.3em" }}>
              {member.weapon ? (
                <>
                  <RarityBadge rarity={member.weapon.rarity} size={2.2} />
                  {member.weapon.name}
                  {member.weapon.plus ? `+${member.weapon.plus}` : ""}（
                  {member.weapon.typeName}）
                  {member.weapon.extraPower
                    ? `　上振れ +${member.weapon.extraPower}`
                    : ""}
                </>
              ) : (
                "なし"
              )}
            </span>
          </div>
          {member.armor ? (
            <div
              data-stand-armor
              style={{ fontSize: "max(11px, calc(var(--u)*2.05))" }}
            >
              防具：
              <span style={{ color: COLOR.mist, fontSize: "1.3em" }}>
                {member.armor.name}（耐久 {member.armor.durability}/
                {member.armor.maxDurability}）
              </span>
              {member.armor.durability < member.armor.maxDurability ? (
                <small
                  style={{
                    display: "block",
                    color: COLOR.mist,
                    fontSize: "max(10px, .85em)",
                    lineHeight: 1.5,
                  }}
                >
                  {member.armor.durability === 0 ? (
                    <span
                      data-stand-armor-broken
                      style={{
                        display: "block",
                        color: COLOR.paper,
                        fontWeight: 800,
                      }}
                    >
                      耐久切れ：ダメージを防げない。
                    </span>
                  ) : null}
                  街の鍛冶屋で修理：{member.armor.gold}G
                </small>
              ) : null}
            </div>
          ) : null}
        </div>
        {frame.line && (
          <div
            style={{
              marginTop: "calc(var(--u)*1.8)",
              display: "block",
              padding: "calc(var(--u)*1.2) calc(var(--u)*1.6)",
              background: COLOR.ink,
              fontSize: "calc(var(--u)*2.4)",
              fontWeight: 700,
              letterSpacing: ".05em",
              lineHeight: 1.5,
              textAlign: "left",
            }}
          >
            「{frame.line}」
          </div>
        )}
      </div>
    </>
  )
}
