import { CanvasBox } from "@/client/components/canvas/canvas-box"
import { CanvasImage } from "@/client/components/canvas/canvas-image"
import { PALETTE } from "@/client/components/canvas/tokens"
import { createPortal } from "react-dom"
import { useStage } from "@/client/components/stage/use-stage"
import { useGame } from "@/client/contexts/use-game"
import { useGameState } from "@/client/contexts/use-game-state"
import { inPhase } from "@/lib/wiz/phases/in-phase"
import { useLayoutEffect, useRef, useState } from "react"
import { DiscoveryButton } from "@/client/components/game/discovery-button"

export const DISCOVERY_ART: Record<
  string,
  { image: string; description: string }
> = {
  渓谷の祝福: {
    image: "/tmp/scenes/discovery-blessing-fisheye-comic-v3.webp",
    description: "祝福を授ける石の祭壇と、その隣に置かれたスキルの書",
  },
  血の祭壇と休憩所: {
    image: "/tmp/scenes/discovery-altar-rest-fisheye-comic-v4.webp",
    description: "血を捧げる石の祭壇と荷物、休むための長椅子",
  },
  薬草の乾燥室: {
    image: "/tmp/scenes/discovery-herb-rest-fisheye-comic-v4.webp",
    description: "薬草を干す棚と種・乳鉢の作業台、休むための椅子",
  },
  巡礼者の最後の灯: {
    image: "/tmp/scenes/discovery-pilgrim-rest-fisheye-comic-v4.webp",
    description: "灯火と封蝋の作業台、巡礼者が休むための長椅子",
  },
  墓守の灯: {
    image: "/tmp/scenes/discovery-gravekeeper-rest-fisheye-comic-v3.webp",
    description: "墓地の石の腰掛けと灯り、補充に使う骨片",
  },
  橋脚の整備小屋: {
    image: "/tmp/scenes/discovery-bridge-rest-fisheye-comic-v4.webp",
    description: "橋脚の作業小屋と歯車の作業台、休むための椅子",
  },
  見捨てられた野営地: {
    image: "/tmp/scenes/discovery-camp-fisheye-comic-v3.webp",
    description: "古いテントと寝袋、消えた焚き火と残された荷物",
  },
  封じられた宝箱: {
    image: "/tmp/scenes/discovery-sealed-chest-fisheye-comic-v4.webp",
    description: "鎖と錠で閉じられた宝箱と、手前に残された荷物",
  },
  ククルスの露店: {
    image: "/tmp/scenes/discovery-kukulus-stall-fisheye-comic-v3.webp",
    description: "回復薬と包みを並べるククルス",
  },
  魔物の交換屋: {
    image: "/tmp/scenes/discovery-monster-trade-fisheye-comic-v3.webp",
    description: "ガラクタと本を天秤で交換する魔物の荷車",
  },
  墓守の供物台: {
    image: "/tmp/scenes/discovery-graveyard-fisheye-comic-v3.webp",
    description: "骨片と供物皿が置かれた石の供物台、奥に崩れた墓と掘り跡",
  },
  鉄橋の巻き上げ機: {
    image: "/tmp/scenes/discovery-bridge-fisheye-comic-v3.webp",
    description: "壊れた鉄橋の足場と歯車の巻き上げ機、下の足場に落ちた部品",
  },
  温室の種床: {
    image: "/tmp/scenes/discovery-greenhouse-fisheye-comic-v4.webp",
    description: "毒の植物の種床と、薬を煎じるやかん",
  },
  封蝋の巡礼所: {
    image: "/tmp/scenes/discovery-wax-fisheye-comic-v4.webp",
    description: "封蝋を納める石の祭壇と、古い封印が残る遺物の箱",
  },
}

export function Discovery() {
  const stage = useStage()
  const game = useGame()
  const state = useGameState()
  const [selected, setSelected] = useState<{
    choice: string
    skill: string
  } | null>(null)
  const discovery = state.conversation?.active
    ? undefined
    : game.queries.route(state)?.discovery
  const dialog = useRef<HTMLDivElement>(null)
  const previousFocus = useRef<HTMLElement | null>(null)
  const title = discovery?.title
  useLayoutEffect(() => {
    const element = dialog.current
    if (!element) return
    const focused = document.activeElement
    if (focused instanceof HTMLElement && !element.contains(focused))
      previousFocus.current = focused
    return () => {
      queueMicrotask(() => {
        if (!element.isConnected && previousFocus.current?.isConnected)
          previousFocus.current.focus({ preventScroll: true })
      })
    }
  }, [title])
  useLayoutEffect(() => {
    dialog.current
      ?.querySelector<HTMLButtonElement>("button:not(:disabled)")
      ?.focus({ preventScroll: true })
  }, [title, selected?.skill])
  const root = stage.canvas.current?.parentElement
  if (!discovery || !root) return null
  const artwork = DISCOVERY_ART[discovery.title]
  const selectedChoice = discovery.choices.find(
    (choice) => choice.id === selected?.choice
  )
  const selectedBlessing = selectedChoice?.blessings?.find(
    (skill) => skill.id === selected?.skill
  )
  return createPortal(
    <>
      <CanvasBox
        aria-hidden="true"
        data-discovery-backdrop=""
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 50,
          pointerEvents: "auto",
        }}
      />
      <CanvasBox
        ref={dialog}
        role="dialog"
        aria-modal="true"
        data-gamepad-scroll=""
        aria-label={discovery.title}
        onKeyDown={(event) => {
          if (event.ctrlKey || event.metaKey || event.altKey) return
          if (event.key !== "Tab") return
          const buttons = [
            ...event.currentTarget.querySelectorAll<HTMLButtonElement>(
              "button:not(:disabled)"
            ),
          ]
          if (!buttons.length) return
          event.preventDefault()
          const current = buttons.indexOf(
            document.activeElement as HTMLButtonElement
          )
          const next =
            (current + (event.shiftKey ? -1 : 1) + buttons.length) %
            buttons.length
          buttons[next]?.focus()
        }}
        style={{
          position: "absolute",
          inset: "6% 4% 8%",
          maxWidth: 620,
          margin: "0 auto",
          overflowY: "auto",
          background: PALETTE.paper,
          color: PALETTE.ink,
          border: "3px solid",
          padding: 14,
          zIndex: 51,
          pointerEvents: "auto",
        }}
      >
        <CanvasBox style={{ fontSize: 23, fontWeight: 900 }}>
          {discovery.title}
        </CanvasBox>
        <CanvasBox
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            margin: "8px 0",
          }}
        >
          <CanvasBox
            style={{ flex: 1, minWidth: 0, fontSize: 14, lineHeight: 1.5 }}
          >
            {discovery.description}
          </CanvasBox>
          {artwork ? (
            <CanvasImage
              src={artwork.image}
              alt={artwork.description}
              style={{
                width: "36%",
                maxWidth: 144,
                height: "auto",
                objectFit: "contain",
                display: "block",
                flexShrink: 0,
              }}
            />
          ) : null}
        </CanvasBox>
        {discovery.choices.some(
          (choice) => choice.cost || choice.costGoods?.length
        ) ? (
          <CanvasBox style={{ fontSize: 14, fontWeight: 800 }}>
            所持金 {state.gold}G・取引は一度だけ
          </CanvasBox>
        ) : null}
        {selected ? (
          <>
            <CanvasBox style={{ fontWeight: 800, marginTop: 12 }}>
              誰に「{selectedBlessing?.name}」を授ける？
            </CanvasBox>
            {selectedBlessing ? (
              <CanvasBox
                data-selected-blessing=""
                style={{ fontSize: 13, marginTop: 8, lineHeight: 1.5 }}
              >
                {selectedBlessing.uses}回：{selectedBlessing.desc}
              </CanvasBox>
            ) : null}
            {selectedChoice?.payment.length ? (
              <CanvasBox
                style={{ fontSize: 13, marginTop: 8, lineHeight: 1.5 }}
              >
                代償：
                {selectedChoice.payment
                  .map(
                    (entry) => `${entry.name} HP ${entry.before}→${entry.after}`
                  )
                  .join(" ／ ")}
              </CanvasBox>
            ) : null}
            {discovery.recipients.map((member) => (
              <DiscoveryButton
                key={member.id}
                disabled={!selectedChoice?.available}
                style={{
                  display: "block",
                  width: "100%",
                  padding: 9,
                  marginTop: 8,
                  border: "2px solid",
                  background: "#ddd7c9",
                }}
                onClick={() =>
                  inPhase(game, "pending")?.discover(
                    selected.choice,
                    selected.skill,
                    member.id
                  )
                }
              >
                {member.name}：
                {member.blessing
                  ? `「${member.blessing}」を上書き`
                  : "祝福なし → 授ける"}
                <CanvasBox style={{ fontSize: 13, marginTop: 5 }}>
                  HP（生命力） {member.hp}/{member.maxHp}
                  {member.hp === 0 ? "・戦闘不能（復活するまで使えない）" : ""}
                </CanvasBox>
              </DiscoveryButton>
            ))}
            <DiscoveryButton
              data-modal-close
              onClick={() => setSelected(null)}
              style={{ padding: 12, marginTop: 10 }}
            >
              選び直す
            </DiscoveryButton>
          </>
        ) : (
          discovery.choices.map((choice) =>
            choice.blessings ? (
              <CanvasBox key={choice.id}>
                {choice.blessings.map((skill) => (
                  <DiscoveryButton
                    key={skill.id}
                    disabled={!choice.available}
                    onClick={() =>
                      setSelected({ choice: choice.id, skill: skill.id })
                    }
                    style={{
                      display: "block",
                      width: "100%",
                      border: "2px solid",
                      padding: 12,
                      marginTop: 10,
                      background: "#ddd7c9",
                      textAlign: "left",
                      opacity: choice.available ? 1 : 0.45,
                    }}
                  >
                    <CanvasBox style={{ fontSize: 16, fontWeight: 800 }}>
                      {skill.name}・{skill.uses}回
                    </CanvasBox>
                    <CanvasBox style={{ fontSize: 13, marginTop: 5 }}>
                      {skill.desc}
                    </CanvasBox>
                    <CanvasBox style={{ fontSize: 12, marginTop: 6 }}>
                      {choice.description}
                      {choice.payment
                        .map(
                          (entry) =>
                            `${entry.name} HP ${entry.before}→${entry.after}`
                        )
                        .join(" ／ ")}
                      {choice.healthChanges.length
                        ? ` ／ ${choice.healthChanges
                            .map(
                              (entry) =>
                                `${entry.name} HP ${entry.before}→${entry.after}`
                            )
                            .join(" ／ ")}`
                        : ""}
                      {choice.reason ? `（${choice.reason}）` : ""}
                    </CanvasBox>
                  </DiscoveryButton>
                ))}
              </CanvasBox>
            ) : (
              <DiscoveryButton
                key={choice.id}
                data-modal-close={choice.id === "leave" ? "" : undefined}
                disabled={!choice.available}
                onClick={() => inPhase(game, "pending")?.discover(choice.id)}
                style={{
                  width: "100%",
                  border: "2px solid",
                  padding: 9,
                  marginTop: 8,
                  background: "#ddd7c9",
                  opacity: choice.available ? 1 : 0.45,
                }}
              >
                <CanvasBox style={{ fontSize: 16, fontWeight: 800 }}>
                  {choice.label}
                </CanvasBox>
                <CanvasBox
                  style={{ fontSize: 13, marginTop: 5, lineHeight: 1.5 }}
                >
                  {choice.description}
                  {choice.cost !== undefined && choice.cost > 0
                    ? ` ／ 支払い ${choice.cost}G`
                    : ""}
                  {choice.materials
                    .map(
                      (entry) =>
                        ` ／ ${entry.name}：所持${entry.owned}・必要${entry.count}`
                    )
                    .join("")}
                  {choice.payment
                    .map(
                      (entry) =>
                        `${entry.name} HP ${entry.before}→${entry.after}`
                    )
                    .join(" ／ ")}
                  {choice.healthChanges.length
                    ? ` ／ ${choice.healthChanges.map((entry) => `${entry.name} HP ${entry.before}→${entry.after}`).join(" ／ ")}`
                    : ""}
                  {choice.reason ? `（${choice.reason}）` : ""}
                </CanvasBox>
              </DiscoveryButton>
            )
          )
        )}
      </CanvasBox>
    </>,
    root
  )
}
