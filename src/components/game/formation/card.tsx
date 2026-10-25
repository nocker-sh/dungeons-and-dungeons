import { usePortraitFit } from "./use-portrait-fit"
import {
  type CSSProperties,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import { motion } from "motion/react"
import { ROLES, Svg } from "@/components/game/art"
import { FlowingPattern } from "@/components/canvas/primitives"
import { HalftoneDots, TornLabel, TornPlate } from "@/components/canvas/paper"
import { useActiveMark } from "@/components/canvas/state"
import { BUTTON_BASE, PALETTE, REVERT, unit } from "@/components/canvas/tokens"
import { frameOf } from "@/lib/content/looks"
import { useGame, useGameState } from "@/contexts/game"
import { play } from "@/components/canvas/play"
import { useFormation } from "./context"
import { Counted, LifeGauge } from "./vitals"

/** 画面の形に合わせて、3枚をわざと不揃いに置く。 */
function layoutFor(wide: boolean) {
  return wide
    ? [
        {
          left: "-4vw",
          bottom: "-4vh",
          width: "38vw",
          height: "19vh",
          rotate: -3,
        },
        {
          left: "30vw",
          bottom: "-6vh",
          width: "37vw",
          height: "21vh",
          rotate: 2.5,
        },
        {
          left: "62vw",
          bottom: "-4vh",
          width: "42vw",
          height: "18.5vh",
          rotate: -2,
        },
      ]
    : [
        // スマホも横一列。幅が狭い分、縦に長くし、隊列の帯（24vh）より上まで届かせる
        {
          left: "-4vw",
          bottom: "-4vh",
          width: "39vw",
          height: "29vh",
          rotate: -2.5,
        },
        {
          left: "31vw",
          bottom: "-5vh",
          width: "38vw",
          height: "30.5vh",
          rotate: 2,
        },
        {
          left: "65vw",
          bottom: "-4vh",
          width: "41vw",
          height: "28.5vh",
          rotate: -2,
        },
      ]
}

export function Card({
  index,
  id,
  wide,
  entered,
}: {
  index: number
  id: string
  wide: boolean
  entered: boolean
}) {
  const game = useGame()
  const state = useGameState()
  const formation = useFormation()
  const liveMember = game.queries.member(state, id)
  // 演出中だけ前の表示を保つ。規則・操作可否は常にエンジンのstateから得る。
  const shownMember = useRef(liveMember)
  if (!formation.frozen) shownMember.current = liveMember
  const member = shownMember.current
  const cards = formation.cards
  const ref = useRef<HTMLDivElement>(null)
  const rise = useRef<HTMLDivElement>(null)
  const bust = useRef<HTMLDivElement>(null)
  // 札そのものは隊列へ預け、ほかの場面が並び順で位置を測れるようにする
  const keepCard = useCallback(
    (element: HTMLDivElement | null) => {
      ref.current = element
      cards.register(index, element)
    },
    [cards, index]
  )
  const [hover, setHover] = useState(false)
  const layout = layoutFor(wide)[index]
  const standing = frameOf(
    member?.look ?? id,
    member?.hero ? member.outfit : member?.armor?.good,
    member?.pact?.find((mode) => mode.current)?.index
  )
  // 札には上半身の絵を出す（持ち上げたときは立ち絵）。上半身の絵がなければ立ち絵から切り抜く
  const useBust = !!standing.bust && formation.lifted !== id
  const frame = useBust
    ? {
        ...standing,
        img: standing.bust!,
        fx: 0.47,
        fy: 0.22,
        zoom: 1,
        ratio: 4 / 3,
      }
    : standing
  const role = ROLES[member?.role ?? "damage"]

  const img = useRef<HTMLImageElement>(null)
  const up = formation.lifted === id
  const active = useActiveMark(ref)
  // 対象を選んでいる間：選べる仲間は true、選べない仲間は false
  const aimable = formation.target
    ? formation.target.eligible.includes(id)
    : undefined
  // 持ち上げた・選ばれている仲間は息をするように揺れる
  const breathing = up || active
  const fit = usePortraitFit({
    cards,
    frame,
    wide,
    useBust,
    up,
    card: ref,
    picture: img,
  })

  // 札ごと画面の下の外から、1枚ずつ回りながら飛び込む。絵と数字は少し遅れて弾む
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || entered) return
    play(
      el,
      [
        {
          transform: `translateY(60vh) rotate(${index % 2 ? 24 : -24}deg)`,
          easing: "cubic-bezier(.16,1,.3,1)",
        },
        {
          transform: "translateY(-4%) rotate(0deg)",
          offset: 0.75,
          easing: "cubic-bezier(.34,1.56,.64,1)",
        },
        { transform: "none" },
      ],
      { duration: 700, delay: 700 + index * 90, fill: "both" }
    )
    play(
      bust.current,
      [
        {
          transform: "translateY(40%) scale(.7)",
          opacity: 0,
          easing: "cubic-bezier(.34,1.56,.64,1)",
        },
        { transform: "none", opacity: 1 },
      ],
      { duration: 420, delay: 700 + index * 90 + 380, fill: "both" }
    )
    // 最初に並ぶときだけ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!member) return null
  const lit = up || active
  const dim = formation.lifted !== null && !up
  const tilt = "calc(var(--r) * 1deg + var(--mx) * 2deg)"
  const lift = "0 calc(var(--hov) * -4%)"
  return (
    <motion.div
      initial={false}
      transition={{
        "--up": { duration: 0.5, ease: [0.34, 1.56, 0.64, 1], repeat: 0 },
        "--hov": { duration: 0.25, ease: "easeOut", repeat: 0 },
        translate: { duration: 0.25, ease: [0.34, 1.56, 0.64, 1], repeat: 0 },
      }}
      animate={{
        "--up": up ? 1 : 0,
        "--hov": hover ? 1 : 0,
        translate: active ? "0 -4%" : "0 0",
      }}
      ref={keepCard}
      className={["card", up ? "up" : ""].join(" ")}
      style={
        {
          ...REVERT,
          display: "block",
          position: "absolute",
          left: layout.left,
          bottom: layout.bottom,
          width: layout.width,
          height: layout.height,
          "--r": layout.rotate,

          filter:
            aimable === false ? "brightness(0.4) saturate(0.6)" : undefined,
          zIndex: aimable ? 3 : undefined,
        } as CSSProperties
      }
    >
      <div
        style={{
          ...REVERT,
          position: "absolute",
          inset: 0,
          zIndex: 1,
          rotate: tilt,
          translate: lift,
          transformOrigin: "50% 100%",
        }}
      >
        <TornPlate
          background={lit ? PALETTE.blood : role.edge}
          clip={role.shape}
        />
        <TornPlate
          background={role.base}
          clip={role.shape}
          style={{ inset: unit(0.55), overflow: "hidden" }}
        >
          <Svg html={role.art} style={{ position: "absolute", inset: 0 }} />
          {lit ? (
            <FlowingPattern
              to="60px -36px"
              duration={900}
              style={{
                position: "absolute",
                inset: 0,
                backgroundImage:
                  "repeating-linear-gradient(-60deg, rgb(238 235 227 / 0.22) 0 6px, transparent 6px 16px)",
              }}
            />
          ) : (
            <HalftoneDots
              color="rgb(238 235 227 / 0.16)"
              fade="linear-gradient(100deg, transparent 30%, #000 100%)"
            />
          )}
        </TornPlate>
      </div>
      <motion.div
        initial={false}
        transition={{
          clipPath: { duration: 0.5, ease: [0.34, 1.3, 0.64, 1], repeat: 0 },
        }}
        animate={{ clipPath: role.shape }}
        ref={bust}
        style={{
          ...REVERT,
          position: "absolute",
          inset: 0,
          zIndex: up ? 6 : 2,
          pointerEvents: "none",
          transformOrigin: "50% 100%",
          rotate: tilt,
          translate: lift,

          filter: member.hp <= 0 ? "grayscale(1) brightness(.55)" : undefined,
        }}
      >
        <div
          className="rise"
          ref={rise}
          style={{
            ...REVERT,
            position: "absolute",
            inset: 0,
            transformOrigin: "50% 100%",
            translate:
              "calc(var(--mx) * 4%) calc(var(--up) * -6% + var(--my) * 2% - var(--hov) * 3%)",
            scale: "calc(1 + var(--up) * 0.1 + var(--hov) * 0.03)",
            rotate: "calc(var(--mx) * 3deg)",
          }}
        >
          {frame.img ? (
            <motion.img
              initial={false}
              ref={img}
              src={frame.img}
              alt=""
              onLoad={fit}
              animate={{
                ...(breathing
                  ? { y: ["0%", "-3%", "0%"], scale: [1, 1.03, 1] }
                  : { y: "0%", scale: 1 }),
                filter: `drop-shadow(${unit(0.6)} ${unit(0.6)} 0 ${PALETTE.ink})${dim ? " brightness(0.5)" : ""}`,
              }}
              transition={{
                ...(breathing
                  ? { duration: 1.4, ease: "easeInOut", repeat: Infinity }
                  : { duration: 0 }),
                filter: { duration: 0.3, ease: "easeInOut", repeat: 0 },
              }}
              style={{
                ...REVERT,
                display: "block",
                maxWidth: "none",
                position: "absolute",
              }}
            />
          ) : null}
        </div>
      </motion.div>
      <div
        style={{
          ...REVERT,
          position: "absolute",
          left: "12%",
          bottom: "32%",
          zIndex: up ? 7 : 3,
          fontSize: unit(2.2),
          color: PALETTE.mist,
          pointerEvents: "none",
          textShadow: `0 0 4px ${PALETTE.ink}`,
          rotate: "calc(var(--r) * 1deg)",
        }}
      >
        {member.hero ? "契約者" : `Lv${member.lv}`}
      </div>
      {aimable ? <AimCursor /> : null}
      {/* HPと武器名。札の右が隠れている分（--hidden-right）だけ内側へ寄せ、3桁でも欠けないようにする */}
      <div
        style={{
          ...REVERT,
          position: "absolute",
          right: "calc(var(--hidden-right, 0px) + 2vw)",
          bottom: "30%",
          zIndex: up ? 7 : 3,
          textAlign: "right",
          lineHeight: 0.9,
          whiteSpace: "nowrap",
          pointerEvents: "none",
          rotate: "calc(var(--r) * 1deg)",
          translate: lift,
        }}
      >
        <Counted
          value={member.hp}
          style={{
            fontSize: unit(wide ? 6.4 : 4.8),
            color:
              member.hp / member.maxHp < 0.3 ? PALETTE.lavender : PALETTE.mist,
            textShadow: `${unit(0.4)} ${unit(0.4)} 0 ${PALETTE.ink}`,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          <small
            style={{ ...REVERT, fontSize: "0.38em", color: PALETTE.stone }}
          >
            /{member.maxHp}
          </small>
        </Counted>
        <LifeGauge
          hp={member.hp}
          maxHp={member.maxHp}
          armor={member.armor}
          width={unit(wide ? 22 : 17)}
        />
        {member.armor ? (
          <div
            data-formation-armor={member.id}
            style={{
              ...REVERT,
              display: "block",
              marginTop: unit(0.5),
              fontSize: `max(10px, ${unit(wide ? 2.2 : 2)})`,
              color: member.armor.durability ? PALETTE.dusk : PALETTE.paper,
              background: member.armor.durability ? undefined : PALETTE.blood,
              padding: member.armor.durability ? undefined : "2px 4px",
              letterSpacing: "0.05em",
              whiteSpace: "nowrap",
            }}
          >
            {member.armor.durability === 0 ? (
              "耐久切れ"
            ) : (
              <>
                耐久 {member.armor.durability}
                <small style={{ ...REVERT, color: PALETTE.stone }}>
                  /{member.armor.maxDurability}
                </small>
              </>
            )}
          </div>
        ) : null}
        <div
          style={{
            ...REVERT,
            display: "block",
            marginTop: unit(0.6),
            fontSize: unit(wide ? 2.2 : 2),
            color: PALETTE.mist,
            opacity: 0.75,
            letterSpacing: "0.05em",
            whiteSpace: "nowrap",
          }}
        >
          {member.hp <= 0 ? "たおれている" : (member.weapon?.name ?? "素手")}
          {member.status.map((entry) => (
            <b
              key={entry.kind}
              style={{
                ...REVERT,
                marginLeft: ".4em",
                padding: "0 .3em",
                background: "#6b1723",
                color: "#eeebe3",
              }}
            >
              {entry.name}
            </b>
          ))}
        </div>
      </div>
      <button
        type="button"
        className="hit"
        disabled={aimable === false}
        aria-pressed={up}
        aria-label={`${member.name} HP${member.hp}/${member.maxHp}${member.armor ? ` 耐久${member.armor.durability}/${member.armor.maxDurability}${member.armor.durability === 0 ? " 耐久切れ" : ""}` : ""}`}
        aria-describedby={
          formation.target?.details?.some((entry) => entry.member === id)
            ? `target-detail-${id}`
            : undefined
        }
        onClick={() => formation.press(id)}
        onPointerEnter={() => setHover(true)}
        onPointerLeave={(event) => {
          setHover(false)
          const card = event.currentTarget.parentElement
          card?.style.setProperty("--mx", "0")
          card?.style.setProperty("--my", "0")
        }}
        onPointerMove={(event) => {
          const bounds = event.currentTarget.getBoundingClientRect()
          const card = event.currentTarget.parentElement
          card?.style.setProperty(
            "--mx",
            String(((event.clientX - bounds.left) / bounds.width - 0.5) * 2)
          )
          card?.style.setProperty(
            "--my",
            String(((event.clientY - bounds.top) / bounds.height - 0.5) * 2)
          )
        }}
        style={{
          ...BUTTON_BASE,
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          top: "-8%",
          zIndex: 7,
        }}
      />
    </motion.div>
  )
}

/** 対象に選べる仲間の上で揺れる「これ」と三角。 */
function AimCursor() {
  return (
    <motion.div
      className="aim"
      aria-hidden="true"
      animate={{ y: ["0%", "20%", "0%"] }}
      transition={{ duration: 1.4, ease: "easeInOut", repeat: Infinity }}
      style={{
        ...REVERT,
        position: "absolute",
        left: "50%",
        top: 0,
        zIndex: 5,
        translate: "-50% -100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        pointerEvents: "none",
      }}
    >
      <TornLabel
        background={PALETTE.paper}
        color={PALETTE.ink}
        clip="polygon(4% 0, 100% 6%, 96% 100%, 0 92%)"
        style={{
          padding: "0.05em 0.5em",
          fontSize: unit(3),
          fontWeight: "bold",
        }}
      >
        これ
      </TornLabel>
      <i
        style={{
          ...REVERT,
          width: unit(3.6),
          height: unit(2.6),
          background: PALETTE.paper,
          clipPath: "polygon(0 0, 100% 0, 50% 100%)",
        }}
      />
    </motion.div>
  )
}

// 札の傾き・持ち上げ・カーソルの追従を滑らかに変えるため、数値のカスタムプロパティとして登録する
if (typeof CSS !== "undefined" && "registerProperty" in CSS)
  for (const name of ["--up", "--hov", "--mx", "--my"])
    try {
      CSS.registerProperty({
        name,
        syntax: "<number>",
        inherits: true,
        initialValue: "0",
      })
    } catch {
      // 二度目の登録（HMR など）は無視する
    }
