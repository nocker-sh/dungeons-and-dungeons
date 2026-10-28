import { useState } from "react"
import { HeroAppearance } from "@/client/components/game/hero-appearance"
import { useFx } from "@/client/components/stage/use-fx"
import { Word } from "@/client/components/stage/word"
import { useWide } from "@/client/components/stage/use-wide"
import { ListView } from "@/client/components/game/list-view/list-view"
import { useListBurst } from "@/client/components/game/list-view/use-list-burst"
import { armorComparisonText } from "@/client/components/game/armor-comparison-text"
import { gearDesc } from "@/client/components/game/gear-desc"
import { useFormation } from "@/client/components/game/formation/context"
import { LeavingContext } from "@/client/components/stage/use-leaving"
import { GameCommandError } from "@/lib/wiz/game/game-command-error"
import { SLOT_NAMES } from "@/lib/wiz/queries/names"
import { eventsOf } from "@/lib/wiz/phases/events-of"
import { inPhase } from "@/lib/wiz/phases/in-phase"
import { useGame } from "@/client/contexts/use-game"
import { useGameState } from "@/client/contexts/use-game-state"
import { RenamePanel } from "@/client/components/game/stand/rename-panel"
import {
  STAND_BARS,
  AUTO_EQUIP,
} from "@/client/components/game/stand/constants"
import { gearKey } from "@/client/components/game/stand/gear-key"

export type Panel = "gear" | "swap" | "rows" | "name" | "appearance" | null

/** 街にいるときだけ、立ち絵から装備・交代・隊列を変えられる。 */
export type Props = {
  id: string
  onClose: () => void
}

export function StandActions(props: Props) {
  const game = useGame()
  const state = useGameState()
  const fx = useFx()
  const wide = useWide()
  const formation = useFormation()
  const burst = useListBurst()
  const [panel, setPanel] = useState<Panel>(null)
  const [key, setKey] = useState(0)
  const member = game.queries.member(state, props.id)
  if (!member || state.phase.type !== "town" || !member.inParty) return null
  const close = () => {
    setPanel(null)
    setKey((n) => n + 1)
  }
  const fail = (result: unknown) => {
    if (result instanceof GameCommandError) {
      fx.shake(0.6)
      return true
    }
    return false
  }
  // 悪魔と契約して戦う仲間（R）と固定装備の仲間は装備を変えられない。専用の武器を持つ仲間は武器だけ変えられない。
  // 理由をエンジンのQueryから受け取る
  const lock = game.queries.gearLock(member.id)
  const weaponLock = game.queries.weaponLock(member.id)
  // おまかせの割り振り（誰も着けていない武器を、出撃の全員へ）
  const plan =
    panel === "gear" && !lock && !weaponLock
      ? game.queries.bestWeapons(state)
      : []
  const options =
    panel === "gear" ? game.queries.equipOptions(state, member.id) : []
  // 候補の表示は使い回し、着用中とおまかせのアイコンだけ個体を指定して補う。
  const gearByKey = new Map(
    [
      ...options,
      ...(panel === "gear"
        ? game.queries.gear(
            state,
            new Set([
              ...member.gear.map((gear) => gear.id),
              ...plan.slice(0, 1).map((entry) => entry.gear),
            ])
          )
        : []),
    ].map((entry) => [gearKey(entry.gear), entry])
  )
  const others =
    panel === "rows"
      ? game.queries.party(state).filter((entry) => entry.row !== member.row)
      : []
  const reserve = panel === "swap" ? game.queries.reserve(state) : []
  return (
    <>
      <LeavingContext.Provider value={panel !== null}>
        <div
          key={key}
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 37,
            pointerEvents: "none",
          }}
        >
          <Word
            text="装備"
            size={wide ? 8 : 7}
            paper
            big
            tilt={-3}
            rotate={-6}
            delay={250}
            style={{
              pointerEvents: "auto",
              ...(wide
                ? {
                    right: "6vw",
                    bottom: `calc(var(--u) * ${STAND_BARS} + 1.5%)`,
                  }
                : {
                    right: "4vw",
                    bottom: `calc(var(--u) * ${STAND_BARS} + 3%)`,
                  }),
            }}
            // 下の黒帯（レターボックス、STAND_BARS）の上に置き、帯に隠れないようにする
            onClick={() => setPanel("gear")}
          />
          {member.hero ? (
            <>
              <Word
                text="容姿"
                size={wide ? 5 : 4.5}
                tilt={-2}
                rotate={-3}
                delay={320}
                style={{
                  pointerEvents: "auto",
                  right: wide ? "26vw" : "40vw",
                  bottom: `calc(var(--u) * ${STAND_BARS} + 17%)`,
                }}
                onClick={() => setPanel("appearance")}
              />
              {game.queries.hero(state).registrationPending ? null : (
                <Word
                  text="改名"
                  size={wide ? 6 : 5.5}
                  big
                  tilt={3}
                  rotate={4}
                  delay={320}
                  style={{
                    pointerEvents: "auto",
                    ...(wide
                      ? {
                          right: "26vw",
                          bottom: `calc(var(--u) * ${STAND_BARS} + 3%)`,
                        }
                      : {
                          right: "40vw",
                          bottom: `calc(var(--u) * ${STAND_BARS} + 5%)`,
                        }),
                  }}
                  onClick={() => setPanel("name")}
                />
              )}
            </>
          ) : (
            <Word
              text="交代"
              size={wide ? 6 : 5.5}
              big
              tilt={3}
              rotate={4}
              delay={320}
              style={{
                pointerEvents: "auto",
                ...(wide
                  ? {
                      right: "26vw",
                      bottom: `calc(var(--u) * ${STAND_BARS} + 3%)`,
                    }
                  : {
                      right: "40vw",
                      bottom: `calc(var(--u) * ${STAND_BARS} + 5%)`,
                    }),
              }}
              onClick={() => setPanel("swap")}
            />
          )}
          <Word
            text={member.row === "front" ? "後衛へ" : "前衛へ"}
            size={wide ? 5 : 4.6}
            big
            tilt={-2}
            rotate={-3}
            delay={390}
            style={{
              pointerEvents: "auto",
              ...(wide
                ? {
                    right: "40vw",
                    bottom: `calc(var(--u) * ${STAND_BARS} + 6%)`,
                  }
                : {
                    right: "62vw",
                    bottom: `calc(var(--u) * ${STAND_BARS} + 17%)`,
                  }),
            }}
            onClick={() => setPanel("rows")}
          />
        </div>
      </LeavingContext.Provider>
      {panel === "appearance" ? <HeroAppearance onClose={close} /> : null}
      {panel === "gear" ? (
        <div style={{ position: "absolute", inset: 0, zIndex: 40 }}>
          <ListView
            title={
              member.fixedArmor
                ? `${member.name}の装備（変えられない）`
                : `${member.name}の装備`
            }
            tabs={[
              {
                name: "着けている",
                rows: member.gear.map((gear) => {
                  const entry = gearByKey.get(gearKey(gear.id))!
                  return {
                    key: gearKey(gear.id),
                    icon: gear.good,
                    name: entry.name,
                    stat: `${SLOT_NAMES[gear.slot] ?? gear.slot}・${entry.stat}`,
                    desc: () =>
                      [
                        gearDesc(
                          entry,
                          game.queries.weaponFit(
                            state,
                            member.id,
                            entry.id,
                            entry.plus,
                            entry.weapon?.extraPower ?? 0
                          )
                        ),
                        armorComparisonText(
                          game.queries.armorRemovalComparison(state, gear.id),
                          "外した後"
                        ),
                        lock ?? (entry.fixed ? (weaponLock ?? "") : ""),
                      ]
                        .filter(Boolean)
                        .join("　"),
                    sub: entry.fixed ? "専用" : "",
                    rarity: entry.rarity,
                  }
                }),
              },
              {
                name: "持ち物",
                rows: [
                  // 誰も着けていない武器を、出撃の全員へ一番強くなるように持たせる
                  ...(plan.length && !lock && !weaponLock
                    ? [
                        {
                          key: AUTO_EQUIP,
                          icon:
                            gearByKey.get(gearKey(plan[0].gear))?.id ?? "junk",
                          name: "おまかせで持たせる",
                          stat: `${plan.length}人が強くなる`,
                          desc: plan
                            .map(
                              (entry) =>
                                `${entry.name} ${entry.before} → ${entry.after}`
                            )
                            .join("　"),
                          badge: `${plan.length}人`,
                        },
                      ]
                    : []),
                  ...options.map((entry) => ({
                    key: gearKey(entry.gear),
                    icon: entry.id,
                    name: entry.name,
                    stat: `${entry.slotName}・${entry.stat}`,
                    desc: () =>
                      [
                        gearDesc(
                          entry,
                          game.queries.weaponFit(
                            state,
                            member.id,
                            entry.id,
                            entry.plus,
                            entry.weapon?.extraPower ?? 0
                          )
                        ),
                        armorComparisonText(
                          game.queries.armorComparison(
                            state,
                            member.id,
                            entry.gear
                          )
                        ),
                      ]
                        .filter(Boolean)
                        .join("　"),
                    owner: entry.owner ?? undefined,
                    sub: entry.owner ?? "",
                    rarity: entry.rarity,
                  })),
                ],
              },
            ]}
            action={(row) => {
              if (row.key === AUTO_EQUIP) return "全員に持たせる"
              if (lock) return null
              if (member.gear.some((gear) => gearKey(gear.id) === row.key))
                return gearByKey.get(row.key)?.locked ? null : "外す"
              const entry = gearByKey.get(row.key)
              return entry?.ownerId ? "付け替える" : "着ける"
            }}
            onAction={(row, at) => {
              if (row.key === AUTO_EQUIP) {
                let done = 0
                for (const entry of game.queries.bestWeapons(game.state))
                  if (
                    !fail(
                      eventsOf(
                        inPhase(game, "town")?.equip(entry.gear, entry.member)
                      )
                    )
                  )
                    done++
                if (done) burst(at, "")
                return
              }
              const gear = state.gear.find(
                (entry) => gearKey(entry.id) === row.key
              )
              if (!gear) return
              const wearing = gear.owner === member.id
              const result = wearing
                ? eventsOf(inPhase(game, "town")?.unequip(gear.id))
                : eventsOf(inPhase(game, "town")?.equip(gear.id, member.id))
              if (!fail(result)) burst(at, "", !wearing)
            }}
            onClose={close}
          />
        </div>
      ) : null}
      {panel === "swap" ? (
        <div style={{ position: "absolute", inset: 0, zIndex: 40 }}>
          <ListView
            title="交代"
            tabs={[
              {
                name: "控え",
                rows: reserve.map((entry) => ({
                  key: entry.id,
                  icon: entry.weapon?.good ?? "junk",
                  name: entry.name,
                  stat: `${entry.roleName}・${entry.job}・Lv${entry.lv}`,
                  desc: `HP ${entry.hp}/${entry.maxHp}　筋力 ${entry.str}　技量 ${entry.tec}　速さ ${entry.spd}`,
                  sub: `Lv${entry.lv}`,
                })),
              },
            ]}
            action={() => `${member.name}と入れ替える`}
            onAction={(row, at) => {
              const result = eventsOf(
                inPhase(game, "town")?.swap(member.id, row.key)
              )
              if (fail(result)) return
              burst(at, "")
              formation.lift(null)
              props.onClose()
            }}
            onClose={close}
          />
        </div>
      ) : null}
      {panel === "name" ? (
        <div style={{ position: "absolute", inset: 0, zIndex: 40 }}>
          <RenamePanel current={member.name} onClose={close} />
        </div>
      ) : null}
      {panel === "rows" ? (
        <div style={{ position: "absolute", inset: 0, zIndex: 40 }}>
          <ListView
            title={member.row === "front" ? "後衛へ" : "前衛へ"}
            tabs={[
              {
                name: member.row === "front" ? "後衛" : "前衛",
                rows: others.map((entry) => ({
                  key: entry.id,
                  icon: entry.weapon?.good ?? "junk",
                  name: entry.name,
                  stat: `${entry.roleName}・${entry.job}`,
                  desc: "前衛は敵に狙われやすい。後衛も攻撃できるが、近接攻撃の威力は半分になる。",
                })),
              },
            ]}
            action={(row) =>
              `${others.find((entry) => entry.id === row.key)?.name ?? ""}と入れ替える`
            }
            onAction={(row, at) => {
              const result = eventsOf(
                inPhase(game, "town")?.swapRows(member.id, row.key)
              )
              if (fail(result)) return
              burst(at, "")
              close()
            }}
            onClose={close}
          />
        </div>
      ) : null}
    </>
  )
}
