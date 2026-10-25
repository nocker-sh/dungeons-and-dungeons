import { useLayoutEffect, useRef, type CSSProperties } from "react"
import { frameOf } from "@/lib/content/looks"
import { RarityBadge } from "@/components/game/list-view"
import { COLOR, EASE_OUT } from "@/components/stage/kit"
import { useWide } from "@/components/stage/word"
import { useGame, useGameState } from "@/contexts/game"
import { BUTTON_BASE, IMG_BASE } from "@/components/canvas/tokens"
import { play } from "@/components/canvas/play"
import { TornLabel } from "@/components/canvas/paper"

/** 戦闘中に隊列のキャラを押す：下から色の板がせり上がり、立ち絵とHP・ステータスをさっと見せる。 */
export function Peek({ id, onClose }: { id: string; onClose: () => void }) {
  const game = useGame()
  const state = useGameState()
  const wide = useWide()
  const plate = useRef<HTMLDivElement>(null)
  const plateEdge = useRef<HTMLDivElement>(null)
  const figure = useRef<HTMLImageElement>(null)
  const info = useRef<HTMLDivElement>(null)
  const member = game.queries.member(state, id)
  const frame = frameOf(
    game.queries.look(state, id),
    member?.armor?.good,
    member?.pact?.find((mode) => mode.current)?.index
  )
  useLayoutEffect(() => {
    play(
      plate.current,
      [{ transform: "translateY(100%)" }, { transform: "none" }],
      { duration: 380, easing: EASE_OUT, fill: "both" }
    )
    play(
      plateEdge.current,
      [{ transform: "translateY(100%)" }, { transform: "none" }],
      { duration: 380, easing: EASE_OUT, fill: "both" }
    )
    play(
      figure.current,
      [
        { transform: "translateY(60%)" },
        { transform: "translateY(-2%)", offset: 0.7 },
        { transform: "none" },
      ],
      { duration: 520, delay: 60, easing: EASE_OUT, fill: "both" }
    )
    play(
      info.current,
      [{ transform: "translateX(60vw)" }, { transform: "none" }],
      { duration: 460, delay: 120, easing: EASE_OUT, fill: "both" }
    )
  }, [id])
  if (!member) return null
  const role = member.hero ? "#b8901c" : frame.color
  const demon = member.hero ? game.queries.demon(state) : null
  const armor = member.armor
  /** 帯の中の減り具合（右から削る）。 */
  const fill = (value: number, max: number, color: string) => (
    <i
      style={{
        position: "absolute",
        inset: 0,
        right: `${100 - (value / Math.max(1, max)) * 100}%`,
        background: color,
      }}
    />
  )
  /** HP（生命力）の帯。防具を着けていれば、続きに耐久の帯をつなげる。 */
  const bar = () => (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "3.2em 1fr auto",
        alignItems: "center",
        gap: ".6em",
      }}
    >
      <span style={{ color: "#c9c5ba" }}>HP</span>
      <span
        style={{
          display: "flex",
          height: ".7em",
          background: COLOR.ink,
          clipPath: "polygon(0 0,100% 0,97% 100%,0 100%)",
        }}
      >
        <span
          style={{
            position: "relative",
            flex: `${member.maxHp} 0 0`,
            minWidth: 0,
          }}
        >
          {fill(member.hp, member.maxHp, COLOR.paper)}
        </span>
        {armor ? (
          <span
            aria-label={`防具の耐久 ${armor.durability}/${armor.maxDurability}`}
            style={{
              position: "relative",
              flex: `${armor.maxDurability} 0 0`,
              minWidth: 0,
              borderLeft: `2px solid ${COLOR.night}`,
            }}
          >
            {fill(armor.durability, armor.maxDurability, COLOR.dusk)}
          </span>
        ) : null}
      </span>
      <b style={{ fontSize: "1.5em", lineHeight: 1 }}>
        {member.hp}
        <small style={{ fontSize: ".5em", color: "#c9c5ba" }}>
          /{member.maxHp}
        </small>
      </b>
    </div>
  )
  return (
    <button
      type="button"
      className="peek"
      aria-live="polite"
      onClick={onClose}
      style={{
        ...BUTTON_BASE,
        position: "absolute",
        inset: 0,
        zIndex: 45,
        textAlign: "left",
      }}
    >
      <div
        ref={plate}
        style={{
          position: "absolute",
          left: "-10%",
          right: "-10%",
          bottom: "-4%",
          height: `${wide ? 82 : 74}%`,
          background: `linear-gradient(175deg, ${role} 0%, ${COLOR.ink} 90%)`,
          clipPath: "polygon(0 16%, 46% 0, 100% 10%, 100% 100%, 0 100%)",
          boxShadow: `inset 0 0 0 4px ${COLOR.paper}`,
        }}
      />
      <div
        ref={plateEdge}
        style={{
          position: "absolute",
          left: "-10%",
          right: "-10%",
          bottom: "-4%",
          height: `${wide ? 82 : 74}%`,
          background: COLOR.paper,
          clipPath:
            "polygon(0 16%, 46% 0, 100% 10%, 100% 10.8%, 46% .8%, 0 16.8%)",
        }}
      />
      <img
        ref={figure}
        src={frame.img}
        alt=""
        style={{
          ...IMG_BASE,
          position: "absolute",
          ...(wide
            ? { left: "6%", bottom: 0, height: "96%" }
            : { left: "2%", bottom: 0, height: "72%" }),
          filter: `drop-shadow(calc(var(--u)*1.4) calc(var(--u)*1.4) 0 ${COLOR.ink})`,
        }}
      />
      <div
        ref={info}
        style={{
          position: "absolute",
          // スマホは立ち絵と重なるので、下半分を沈めた板に文字を乗せる
          ...(wide
            ? { right: "6%", bottom: "8%", width: "40%" }
            : {
                right: "3%",
                left: "26%",
                bottom: "3%",
                padding: "calc(var(--u)*2) calc(var(--u)*2.2)",
                background: "rgb(11 12 18 / 0.82)",
                clipPath: "polygon(1% 3%, 100% 0, 99% 98%, 0 100%)",
              }),
          color: COLOR.paper,
          fontWeight: 900,
          fontSize: `calc(var(--u)*${wide ? 2.6 : 3})`,
          display: "grid",
          gap: `calc(var(--u)*${wide ? 1.2 : 1})`,
          rotate: "-2deg",
        }}
      >
        <div
          style={{ fontSize: ".8em", letterSpacing: ".3em", color: "#c9c5ba" }}
        >
          {member.row === "front" ? "前衛" : "後衛"}／{member.job}
        </div>
        <div
          style={
            {
              fontSize: `${wide ? 4 : 3.2}em`,
              lineHeight: 1,
              WebkitTextStroke: `.05em ${COLOR.ink}`,
              paintOrder: "stroke fill",
              textShadow: `.06em .06em 0 ${COLOR.blood}`,
            } as CSSProperties
          }
        >
          {member.name}
          <small style={{ fontSize: ".35em", marginLeft: ".4em" }}>
            Lv{member.lv}
          </small>
        </div>
        {/* 主人公は流派が合体している悪魔で決まるので、悪魔と同じ行に出す */}
        {demon ? (
          <div style={{ fontSize: ".9em" }}>
            合体中：<b>{demon.name}</b>
            {demon.schoolName ? `／流派：${demon.schoolName}` : ""}
          </div>
        ) : (
          <div style={{ fontSize: ".9em", color: "#c9c5ba" }}>
            流派：
            <b style={{ color: COLOR.paper }}>
              {member.schoolNames.length
                ? member.schoolNames.join("・")
                : "なし"}
            </b>
            {member.affinityName ? (
              <b style={{ color: COLOR.sage, marginLeft: ".5em" }}>相性◎</b>
            ) : null}
          </div>
        )}
        {member.fusion ? (
          <div style={{ fontSize: ".85em", color: "#c9c5ba" }}>
            合体：
            <b style={{ color: COLOR.paper }}>
              {[
                member.fusion.attackPercent
                  ? `攻撃 +${member.fusion.attackPercent}%`
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
            </b>
          </div>
        ) : null}
        {bar()}
        <div style={{ color: "#c9c5ba" }}>
          {armor ? (
            <>
              {armor.name}・耐久{" "}
              <b
                style={{
                  color: armor.durability ? COLOR.dusk : COLOR.paper,
                  fontSize: "1.3em",
                }}
              >
                {armor.durability}
              </b>
              <small>/{armor.maxDurability}</small>
              {armor.durability === 0 ? (
                <b
                  data-member-armor-broken
                  style={{ display: "block", color: COLOR.paper }}
                >
                  耐久切れ：ダメージを防げない。
                </b>
              ) : null}
            </>
          ) : (
            "防具なし"
          )}
        </div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: ".5em",
            alignItems: "center",
          }}
        >
          <span style={{ color: "#c9c5ba", marginRight: ".3em" }}>状態</span>
          {member.status.length ? (
            member.status.map((entry) => (
              <span key={entry.kind} data-member-status={entry.kind}>
                <TornLabel
                  background={COLOR.blood}
                  color={COLOR.paper}
                  clip="polygon(4% 0,100% 8%,96% 100%,0 92%)"
                  style={{ padding: ".1em .6em" }}
                >
                  {entry.name}
                  {entry.kind === "charge" || entry.kind === "protect"
                    ? "：使うまで有効"
                    : `：残り${entry.turns}手番`}
                </TornLabel>
              </span>
            ))
          ) : (
            <span style={{ color: "#c9c5ba" }}>状態異常なし</span>
          )}
        </div>
        <div style={{ display: "flex", gap: "1.2em", color: "#c9c5ba" }}>
          筋力{" "}
          <b style={{ color: COLOR.paper, fontSize: "1.4em" }}>{member.str}</b>{" "}
          技量{" "}
          <b style={{ color: COLOR.paper, fontSize: "1.4em" }}>{member.tec}</b>{" "}
          速さ{" "}
          <b style={{ color: COLOR.paper, fontSize: "1.4em" }}>{member.spd}</b>
        </div>
        {member.weapon ? (
          <div style={{ color: "#c9c5ba" }}>
            <RarityBadge rarity={member.weapon.rarity} size={2.2} />
            <span data-member-weapon-name>
              {member.weapon.name}
              {member.weapon.plus ? `+${member.weapon.plus}` : ""}
            </span>
            （{member.weapon.typeName}・攻撃力{" "}
            <b style={{ color: COLOR.paper, fontSize: "1.2em" }}>
              {member.weapon.attack}
            </b>
            {member.weapon.extraPower ? (
              <>・上振れ +{member.weapon.extraPower}</>
            ) : null}
            ）
            {member.weapon.met ? null : (
              <b
                data-member-weapon-short
                style={{ display: "block", color: COLOR.paper }}
              >
                {[
                  member.weapon.short.str
                    ? `筋力が${member.weapon.short.str}足りない`
                    : null,
                  member.weapon.short.tec
                    ? `技量が${member.weapon.short.tec}足りない`
                    : null,
                ]
                  .filter(Boolean)
                  .join("・")}
              </b>
            )}
          </div>
        ) : null}
      </div>
    </button>
  )
}
